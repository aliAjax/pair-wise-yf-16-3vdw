// 排期领域模型：只描述业务概念，不包含任何存储与界面逻辑

/** 板型 */
export type BoardType = "全地域" | "公园板" | "竞速板" | "粉雪板";

/**
 * 蜡型。
 * - none：该项目不打蜡（修刃/底板修补单项）
 * - low：低温蜡
 * - allTemp：全温蜡
 * - hot：热蜡
 */
export type WaxKind = "none" | "low" | "allTemp" | "hot";

/** 工位温区：低温区可上低温蜡/全温蜡，高温区才能上热蜡 */
export type StationZone = "low" | "hot";

/** 营业时段（同一天内互不重叠的三个时段） */
export type SlotCode = "AM" | "PM" | "NIGHT";

/** 工单状态 */
export type OrderStatus =
  | "draft" // 草稿：接单信息未核价
  | "quoted" // 已核价：等待排期
  | "scheduled" // 已排期：师傅/工位/蜡锅已占用
  | "inProgress" // 施工中
  | "ready" // 待交板：需录入完工参数
  | "done"; // 已完工：记录只读

/** 服务项目目录项 */
export interface ServiceItem {
  code: string;
  name: string;
  price: number;
  /** 该项目要求的蜡型；none 表示不需要蜡锅 */
  wax: WaxKind;
  /** 是否包含底板修补（交板前必须有修补结果） */
  needsBaseRepair: boolean;
}

export interface Technician {
  id: string;
  name: string;
}

export interface WaxPot {
  id: string;
  name: string;
  zone: StationZone;
}

export interface Station {
  id: string;
  name: string;
  zone: StationZone;
}

/** 交板前必须录入的完工记录 */
export interface FinishRecord {
  edgeSide: string; // 侧刃角度，如 88°
  edgeBase: string; // 底刃角度，如 1°
  waxTemp: string; // 打蜡温度，如 120℃
  baseRepairResult?: string; // 底板修补结果（含修补项目时必填）
  finishedAt: string; // ISO 时间
}

export interface WorkOrder {
  id: string; // 工单号，如 ORD-106
  customer: string;
  phone: string;
  brand: string;
  lengthCm: number | "";
  boardType: BoardType | "";
  serviceCodes: string[];
  /** 核价后锁定的报价（元）；改板型/项目后清空 */
  quote: number | null;
  /** 核价时间，改板型/项目后与报价一起失效 */
  quotedAt: string | null;
  status: OrderStatus;
  // —— 排期占用信息（同一时段唯一）——
  scheduleDate: string | null; // YYYY-MM-DD
  slot: SlotCode | null;
  technicianId: string | null;
  stationId: string | null;
  /** 不打蜡的项目为空字符串 */
  potId: string | null;
  // —— 完工 ——
  finish: FinishRecord | null;
  createdAt: string;
  updatedAt: string;
}

export interface ShopData {
  version: number;
  technicians: Technician[];
  pots: WaxPot[];
  stations: Station[];
  orders: WorkOrder[];
}
