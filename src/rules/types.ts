// 排期领域模型：只描述数据形状，与界面、存储无关。

export type BoardType = "全地域" | "公园板" | "竞速板" | "粉雪板";

/** 蜡型：低温蜡 / 全温蜡 / 热蜡 */
export type WaxType = "低温蜡" | "全温蜡" | "热蜡";

/** 工位温区 */
export type TempZone = "低温区" | "全温区" | "高温区";

export type ServiceCode = "edge" | "wax" | "baseRepair";

/** 一天划分三个作业时段 */
export type SlotId = "morning" | "midday" | "evening";

export type OrderStatus = "待核价" | "待排期" | "已排期" | "已完成";

export interface Technician {
  id: string;
  name: string;
  title: string;
}

export interface Workstation {
  id: string;
  name: string;
  zone: TempZone;
}

/** 蜡锅固定放在某一温区的工位上 */
export interface WaxPot {
  id: string;
  name: string;
  stationId: string;
  zone: TempZone;
}

export interface SlotDef {
  id: SlotId;
  label: string;
  window: string;
}

export interface ServiceDef {
  code: ServiceCode;
  name: string;
  desc: string;
  basePrice: number;
}

/** 排期弹窗提交的候选占用 */
export interface ScheduleInput {
  date: string; // YYYY-MM-DD
  slot: SlotId;
  techId: string;
  potId: string | null; // 无打蜡项目时为空
}

/** 落到工单上的排期：工位由蜡锅推导 */
export interface Schedule extends ScheduleInput {
  stationId: string | null;
}

export interface CompletionInput {
  sideEdgeDeg: string; // 侧刃角度，如 88°
  baseEdgeDeg: string; // 底刃角度，如 1°
  waxTempC: string; // 打蜡温度（℃）
  baseRepairResult: string; // 底板修补结果
}

export interface CompletionRecord extends CompletionInput {
  completedAt: string;
}

export interface Order {
  id: string;
  customer: string;
  phone: string;
  brand: string;
  lengthCm: number;
  boardType: BoardType;
  services: ServiceCode[];
  waxType: WaxType | null;
  pickupAt: string; // datetime-local：YYYY-MM-DDTHH:mm
  preferredTechId: string | null; // 指定师傅（可空）
  price: number | null;
  priceConfirmed: boolean;
  schedule: Schedule | null;
  completion: CompletionRecord | null;
  createdAt: string;
}

/** 接单 / 顾客改单表单草稿（字段都是字符串，落库时再转换） */
export interface OrderDraft {
  customer: string;
  phone: string;
  brand: string;
  lengthCm: string;
  boardType: BoardType;
  services: ServiceCode[];
  waxType: WaxType | "";
  pickupAt: string;
  preferredTechId: string | "";
}

export type ScheduleErrorCode =
  | "POT_REQUIRED"
  | "WAX_ZONE_MISMATCH"
  | "TECH_BUSY"
  | "POT_BUSY";

export interface ScheduleIssue {
  code: ScheduleErrorCode;
  message: string;
}
