// 排期规则：全部为纯函数，不触碰存储与 DOM。
// 需求要点：
// 1) 同一时段一位师傅只承接一张板；
// 2) 同一时段一只蜡锅只承接一张板；
// 3) 蜡型与工位（及蜡锅）温区不合直接拦住，原排期不动；
// 4) 交板前必须录入侧刃、底刃、打蜡温度；含底板修补时还必须有修补结果。
import type {
  SlotCode,
  Station,
  Technician,
  WaxKind,
  WaxPot,
  WorkOrder,
} from "./types";
import { WAX_LABEL, ZONE_LABEL, zoneAcceptsWax, needsBaseRepair } from "./catalog";

/** 仍在占用师傅/工位/蜡锅的工单状态（完工即释放） */
const OCCUPYING: WorkOrder["status"][] = ["scheduled", "inProgress", "ready"];

export interface ScheduleInput {
  date: string;
  slot: SlotCode;
  technicianId: string;
  stationId: string;
  potId: string | null;
  wax: WaxKind;
}

export interface ScheduleResult {
  ok: boolean;
  errors: string[];
}

function occupyingOrders(orders: WorkOrder[], selfId: string): WorkOrder[] {
  return orders.filter((o) => o.id !== selfId && OCCUPYING.includes(o.status));
}

/**
 * 校验一次排期/改期。校验失败时调用方必须保持原排期不动
 * （本函数不修改任何数据）。
 */
export function validateSchedule(
  input: ScheduleInput,
  context: {
    orders: WorkOrder[];
    selfId: string;
    technicians: Technician[];
    stations: Station[];
    pots: WaxPot[];
  },
): ScheduleResult {
  const errors: string[] = [];
  const { orders, selfId, technicians, stations, pots } = context;

  if (!input.date) errors.push("请选择排期日期");
  if (!input.slot) errors.push("请选择时段");
  if (!input.technicianId) errors.push("请指定师傅");
  if (!input.stationId) errors.push("请分配工位");
  if (input.wax !== "none" && !input.potId) errors.push("该项目需要打蜡，请选择蜡锅");
  if (errors.length > 0) return { ok: false, errors };

  const technician = technicians.find((t) => t.id === input.technicianId);
  const station = stations.find((s) => s.id === input.stationId);
  const pot = input.potId ? pots.find((p) => p.id === input.potId) : null;
  if (!technician) errors.push("指定师傅不存在");
  if (!station) errors.push("分配工位不存在");
  if (input.wax !== "none" && !pot) errors.push("所选蜡锅不存在");
  if (errors.length > 0) return { ok: false, errors };

  // —— 规则 3：蜡型 × 工位温区 ——
  if (!zoneAcceptsWax(station!.zone, input.wax)) {
    errors.push(
      `温区不合：${WAX_LABEL[input.wax]}不能安排在${ZONE_LABEL[station!.zone]}工位「${station!.name}」`,
    );
  }

  // 蜡锅温区同样要容纳蜡型
  if (pot && !zoneAcceptsWax(pot.zone, input.wax)) {
    errors.push(
      `温区不合：${WAX_LABEL[input.wax]}不能使用${ZONE_LABEL[pot.zone]}蜡锅「${pot.name}」`,
    );
  }

  const clashBase = { date: input.date, slot: input.slot };
  for (const other of occupyingOrders(orders, selfId)) {
    if (other.scheduleDate !== clashBase.date || other.slot !== clashBase.slot) continue;
    // —— 规则 1：师傅撞档 ——
    if (other.technicianId === input.technicianId) {
      errors.push(
        `师傅「${technician!.name}」该时段已有工单 ${other.id}（${other.customer}）`,
      );
    }
    // —— 规则 2：蜡锅撞档 ——
    if (input.potId && other.potId === input.potId) {
      errors.push(`蜡锅「${pot!.name}」该时段已被工单 ${other.id} 占用`);
    }
  }

  return { ok: errors.length === 0, errors };
}

/** 某时段某位师傅是否已被占（供排期台置灰展示） */
export function technicianBusy(
  orders: WorkOrder[],
  date: string,
  slot: SlotCode,
  technicianId: string,
  selfId?: string,
): boolean {
  return occupyingOrders(orders, selfId ?? "").some(
    (o) =>
      o.scheduleDate === date &&
      o.slot === slot &&
      o.technicianId === technicianId,
  );
}

/** 某时段某只蜡锅是否已被占 */
export function potBusy(
  orders: WorkOrder[],
  date: string,
  slot: SlotCode,
  potId: string,
  selfId?: string,
): boolean {
  return occupyingOrders(orders, selfId ?? "").some(
    (o) => o.scheduleDate === date && o.slot === slot && o.potId === potId,
  );
}

/** 工位温区是否接受蜡型（供下拉框过滤） */
export function stationZoneOk(station: Station, wax: WaxKind): boolean {
  return zoneAcceptsWax(station.zone, wax);
}

export function potZoneOk(pot: WaxPot, wax: WaxKind): boolean {
  return zoneAcceptsWax(pot.zone, wax);
}

/**
 * 顾客改板型或项目后：报价失效、排期占用释放。
 * 返回新的工单字段，由调用方写回；不改原对象。
 */
export function invalidateQuoteAndSchedule(order: WorkOrder): Partial<WorkOrder> {
  return {
    quote: null,
    quotedAt: null,
    // 草稿仍是草稿；已核价及之后的状态都退回“待核价”，由前台重新核价
    status: order.status === "draft" ? "draft" : "quoted",
    scheduleDate: null,
    slot: null,
    technicianId: null,
    stationId: null,
    potId: null,
    // 完工记录也一并作废，需重新施工录入
    finish: null,
    updatedAt: new Date().toISOString(),
  };
}

export interface FinishInput {
  edgeSide: string;
  edgeBase: string;
  waxTemp: string;
  baseRepairResult?: string;
}

/**
 * 交板前置校验。未录入侧刃/底刃/打蜡温度，或含底板修补却缺修补结果，一律挡住。
 */
export function validateFinish(
  order: WorkOrder,
  input: FinishInput,
): ScheduleResult {
  const errors: string[] = [];
  if (!input.edgeSide.trim()) errors.push("未录入侧刃角度");
  if (!input.edgeBase.trim()) errors.push("未录入底刃角度");
  if (!input.waxTemp.trim()) errors.push("未录入打蜡温度");
  if (needsBaseRepair(order.serviceCodes) && !input.baseRepairResult?.trim()) {
    errors.push("底板修补结果仍缺失，不能交板");
  }
  return { ok: errors.length === 0, errors };
}

/** 已完工工单是否只读（完工记录只能查看） */
export function isLocked(order: WorkOrder): boolean {
  return order.status === "done";
}
