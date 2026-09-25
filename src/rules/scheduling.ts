import {
  BOARD_COEFFICIENT,
  WAX_SURCHARGE,
  WAX_ZONE_MATCH,
  isWaxService,
  needsBaseRepair,
  serviceByCode,
  slotById,
  technicianById,
  waxPotById,
} from "./masterData";
import type {
  CompletionInput,
  Order,
  OrderDraft,
  OrderStatus,
  Schedule,
  ScheduleInput,
  ScheduleIssue,
  ServiceCode,
  WaxPot,
  WaxType,
} from "./types";

/** 顾客改板型 / 项目时提交的补丁（长度已转数字） */
export type RevisePatch = Pick<
  OrderDraft,
  "brand" | "boardType" | "services" | "waxType"
> & { lengthCm: number };

// ---------------------------------------------------------------------------
// 排期规则层：全部是纯函数。
// 页面只读取判定结果；任何“拦住”都不会改动原排期。
// ---------------------------------------------------------------------------

/** 阶段状态由工单数据推导，避免多处状态不一致 */
export function deriveStatus(order: Order): OrderStatus {
  if (order.completion) return "已完成";
  if (order.schedule) return "已排期";
  if (order.priceConfirmed && order.price !== null) return "待排期";
  return "待核价";
}

/** 试算报价（顾客还没确认前也可先看到金额） */
export function quotePrice(input: {
  services: ServiceCode[];
  waxType: WaxType | null;
  boardType: Order["boardType"];
}): number {
  const subtotal = input.services.reduce((sum, code) => {
    return sum + (serviceByCode.get(code)?.basePrice ?? 0);
  }, 0);
  const waxExtra =
    isWaxService(input.services) && input.waxType
      ? WAX_SURCHARGE[input.waxType]
      : 0;
  return Math.round((subtotal + waxExtra) * BOARD_COEFFICIENT[input.boardType]);
}

export interface DraftCheck {
  ok: boolean;
  errors: string[];
  lengthCm: number;
  price: number;
}

/** 接单表单校验 + 试算价 */
export function evaluateDraft(draft: OrderDraft): DraftCheck {
  const errors: string[] = [];
  if (!draft.customer.trim()) errors.push("请填写客户姓名");
  if (!draft.brand.trim()) errors.push("请填写雪板品牌");
  const lengthCm = Number(draft.lengthCm);
  if (!Number.isFinite(lengthCm) || lengthCm < 100 || lengthCm > 220) {
    errors.push("雪板长度需在 100–220 cm 之间");
  }
  if (draft.services.length === 0) errors.push("请至少选择一个保养项目");
  if (isWaxService(draft.services)) {
    if (!draft.waxType) errors.push("打蜡项目必须选择低温蜡、全温蜡或热蜡");
  }
  if (!draft.pickupAt) errors.push("请选择取板时间");

  const price = quotePrice({
    services: draft.services,
    waxType: draft.waxType === "" ? null : draft.waxType,
    boardType: draft.boardType,
  });
  return { ok: errors.length === 0, errors, lengthCm, price };
}

function findConflicts(
  orders: Order[],
  input: ScheduleInput,
  selfId: string | null,
): { techOrder?: Order; potOrder?: Order } {
  const sameCell = (o: Order) =>
    o.id !== selfId &&
    o.schedule !== null &&
    deriveStatus(o) !== "已完成" &&
    o.schedule.date === input.date &&
    o.schedule.slot === input.slot;

  let techOrder: Order | undefined;
  let potOrder: Order | undefined;
  for (const o of orders) {
    if (!sameCell(o) || !o.schedule) continue;
    if (o.schedule.techId === input.techId && !techOrder) techOrder = o;
    if (input.potId && o.schedule.potId === input.potId && !potOrder) {
      potOrder = o;
    }
  }
  return { techOrder, potOrder };
}

export interface ScheduleCheck {
  ok: boolean;
  issues: ScheduleIssue[];
  /** 校验通过后推导好的排期（工位由蜡锅推出），页面据此落库 */
  schedule: Schedule | null;
}

/**
 * 排期前置校验：
 * 1. 打蜡必须选蜡锅；
 * 2. 蜡型必须与蜡锅所在工位温区一致，不合直接拦住；
 * 3. 同一时段一位师傅只承接一张板；
 * 4. 同一时段一只蜡锅只服务一张板。
 * 本函数不修改任何工单。
 */
export function evaluateSchedule(
  order: Order,
  orders: Order[],
  input: ScheduleInput,
): ScheduleCheck {
  const issues: ScheduleIssue[] = [];
  const techName = technicianById.get(input.techId)?.name ?? input.techId;
  const slotLabel = slotById.get(input.slot)?.label ?? input.slot;

  let pot: WaxPot | undefined;
  if (input.potId) pot = waxPotById.get(input.potId);

  if (isWaxService(order.services)) {
    // 规则 1：打蜡必须占一只蜡锅
    if (!input.potId || !pot) {
      issues.push({
        code: "POT_REQUIRED",
        message: "该单含打蜡项目，必须选择一只蜡锅",
      });
    } else if (order.waxType) {
      // 规则 2：蜡型 / 温区不合直接拦截
      const requireZone = WAX_ZONE_MATCH[order.waxType];
      if (pot.zone !== requireZone) {
        issues.push({
          code: "WAX_ZONE_MISMATCH",
          message: `${order.waxType}只能进入${requireZone}，「${pot.name}」位于${pot.zone}，已拦截。请换对应温区蜡锅`,
        });
      }
    }
  }

  // 规则 3、4：师傅 / 蜡锅同一时段唯一
  const { techOrder, potOrder } = findConflicts(orders, input, order.id);
  if (techOrder) {
    issues.push({
      code: "TECH_BUSY",
      message: `师傅${techName}在${input.date} ${slotLabel}已有工单 ${techOrder.id}（${techOrder.customer}），撞档已拦截`,
    });
  }
  if (pot && potOrder) {
    issues.push({
      code: "POT_BUSY",
      message: `「${pot.name}」在${input.date} ${slotLabel}已被工单 ${potOrder.id} 占用，一只蜡锅同一时段只能承接一张板`,
    });
  }

  if (issues.length > 0) return { ok: false, issues, schedule: null };

  return {
    ok: true,
    issues: [],
    schedule: {
      ...input,
      potId: isWaxService(order.services) ? input.potId : null,
      stationId: pot ? pot.stationId : null,
    },
  };
}

/** 候选时段冲突预检（供排期弹窗即时提示，不落库） */
export function previewCell(
  orders: Order[],
  input: Pick<ScheduleInput, "date" | "slot" | "techId" | "potId">,
  selfId: string | null,
): { techBusy: boolean; potBusy: boolean } {
  const { techOrder, potOrder } = findConflicts(
    orders,
    input as ScheduleInput,
    selfId,
  );
  return { techBusy: Boolean(techOrder), potBusy: Boolean(potOrder) };
}

/**
 * 顾客改板型或保养项目（含蜡型）：
 * 原报价作废、释放原师傅 / 蜡锅 / 工位占用，由前台重新核价。
 * 只改客户联系方式或取板时间不经过这里。
 */
export function revise(
  order: Order,
  patch: RevisePatch,
): Order {
  return {
    ...order,
    brand: patch.brand,
    lengthCm: patch.lengthCm,
    boardType: patch.boardType,
    services: patch.services,
    waxType: patch.waxType === "" ? null : patch.waxType,
    price: null,
    priceConfirmed: false,
    schedule: null, // 释放占用
  };
}

export interface CompletionCheck {
  ok: boolean;
  errors: string[];
}

/**
 * 交板门槛：
 * - 侧刃、底刃、打蜡温度必须录入；
 * - 含底板修补时，还必须录入底板修补结果。
 * 任一不满足就挡住，工单保持“已排期”。
 */
export function evaluateCompletion(
  order: Order,
  input: CompletionInput,
): CompletionCheck {
  const errors: string[] = [];
  if (!input.sideEdgeDeg.trim()) errors.push("请录入侧刃角度（如 88°）");
  if (!input.baseEdgeDeg.trim()) errors.push("请录入底刃角度（如 1°）");
  if (!input.waxTempC.trim()) errors.push("请录入打蜡温度（℃）");
  if (needsBaseRepair(order.services) && !input.baseRepairResult.trim()) {
    errors.push("该单含底板修补，请录入底板修补结果后再交板");
  }
  return { ok: errors.length === 0, errors };
}

export function serviceSummary(services: ServiceCode[]): string {
  return services.map((code) => serviceByCode.get(code)?.name ?? code).join("、");
}
