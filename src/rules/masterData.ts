import type {
  BoardType,
  ServiceCode,
  ServiceDef,
  SlotDef,
  TempZone,
  WaxPot,
  WaxType,
  Workstation,
  Technician,
} from "./types";

// ---------------------------------------------------------------------------
// 主数据：师傅、工位（温区）、蜡锅、时段、板型、项目、价格。
// 改排班资源或调价只动这一个文件，规则与页面不用动。
// ---------------------------------------------------------------------------

export const BOARD_TYPES: BoardType[] = ["全地域", "公园板", "竞速板", "粉雪板"];

export const WAX_TYPES: WaxType[] = ["低温蜡", "全温蜡", "热蜡"];

export const TEMP_ZONES: TempZone[] = ["低温区", "全温区", "高温区"];

export const TECHNICIANS: Technician[] = [
  { id: "T1", name: "陈峰", title: "首席调校师" },
  { id: "T2", name: "李岩", title: "打蜡 / 刃磨" },
  { id: "T3", name: "赵磊", title: "底板修补" },
];

export const WORKSTATIONS: Workstation[] = [
  { id: "W1", name: "1 号位", zone: "低温区" },
  { id: "W2", name: "2 号位", zone: "全温区" },
  { id: "W3", name: "3 号位", zone: "高温区" },
];

// 一只蜡锅固定属于一个工位温区
export const WAX_POTS: WaxPot[] = [
  { id: "P1", name: "蜡锅 A", stationId: "W1", zone: "低温区" },
  { id: "P2", name: "蜡锅 B", stationId: "W2", zone: "全温区" },
  { id: "P3", name: "蜡锅 C", stationId: "W3", zone: "高温区" },
];

export const SLOTS: SlotDef[] = [
  { id: "morning", label: "上午", window: "09:00–12:00" },
  { id: "midday", label: "下午", window: "13:00–17:00" },
  { id: "evening", label: "晚间", window: "17:30–20:30" },
];

export const SERVICES: ServiceDef[] = [
  { code: "edge", name: "刃部调校", desc: "侧刃 / 底刃打磨", basePrice: 120 },
  { code: "wax", name: "打蜡", desc: "按雪况选蜡型", basePrice: 80 },
  { code: "baseRepair", name: "底板修补", desc: "P-Tex 填补、修复划痕", basePrice: 150 },
];

/** 蜡型在“打蜡”基础价上的加价 */
export const WAX_SURCHARGE: Record<WaxType, number> = {
  低温蜡: 0,
  全温蜡: 30,
  热蜡: 60,
};

/** 不同板型的项目系数 */
export const BOARD_COEFFICIENT: Record<BoardType, number> = {
  全地域: 1,
  公园板: 1,
  竞速板: 1.2,
  粉雪板: 1.1,
};

/**
 * 蜡型 ↔ 工位温区对照表。
 * 旺季规则从严：蜡型必须落在对应温区，全温区也不兜底，避免拿错锅化错蜡。
 *   低温蜡 → 低温区；全温蜡 → 全温区；热蜡 → 高温区
 */
export const WAX_ZONE_MATCH: Record<WaxType, TempZone> = {
  低温蜡: "低温区",
  全温蜡: "全温区",
  热蜡: "高温区",
};

/** 各类蜡建议的熨斗温度区间，供完工录入“打蜡温度”时提示 */
export const WAX_IRON_HINT: Record<WaxType, string> = {
  低温蜡: "约 110–120 ℃",
  全温蜡: "约 120–135 ℃",
  热蜡: "约 135–150 ℃",
};

// ---------------------------------------------------------------------------
// 便于查表的 Map
// ---------------------------------------------------------------------------

export const technicianById = new Map(TECHNICIANS.map((t) => [t.id, t]));
export const workstationById = new Map(WORKSTATIONS.map((w) => [w.id, w]));
export const waxPotById = new Map(WAX_POTS.map((p) => [p.id, p]));
export const slotById = new Map(SLOTS.map((s) => [s.id, s]));
export const serviceByCode = new Map<ServiceCode, ServiceDef>(
  SERVICES.map((s) => [s.code, s]),
);

export function isWaxService(services: ServiceCode[]): boolean {
  return services.includes("wax");
}

export function needsBaseRepair(services: ServiceCode[]): boolean {
  return services.includes("baseRepair");
}
