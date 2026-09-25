// 基础资料目录：服务项目、温区、时段等可维护常量
import type { ServiceItem, SlotCode, StationZone, WaxKind } from "./types";

export const WAX_LABEL: Record<WaxKind, string> = {
  none: "不打蜡",
  low: "低温蜡",
  allTemp: "全温蜡",
  hot: "热蜡",
};

/** 排期时可选的蜡型（对应需求：按项目选择低温蜡、全温蜡或热蜡） */
export const WAX_OPTIONS: WaxKind[] = ["low", "allTemp", "hot"];

export const ZONE_LABEL: Record<StationZone, string> = {
  low: "低温区",
  hot: "高温区",
};

/** 蜡型要求的工位/蜡锅温区：只有热蜡必须进高温区 */
export const WAX_REQUIRED_ZONE: Record<Exclude<WaxKind, "none">, StationZone> = {
  low: "low",
  allTemp: "low",
  hot: "hot",
};

/** 温区是否容纳某蜡型（低温区也能熔全温蜡；热蜡只允许高温区） */
export function zoneAcceptsWax(zone: StationZone, wax: WaxKind): boolean {
  if (wax === "none") return true;
  const required = WAX_REQUIRED_ZONE[wax];
  if (required === "hot") return zone === "hot";
  return zone === "low" || zone === "hot";
}

export const SLOT_LABEL: Record<SlotCode, string> = {
  AM: "上午 09:00-12:00",
  PM: "下午 13:00-17:00",
  NIGHT: "晚间 18:00-20:30",
};

export const SLOT_ORDER: SlotCode[] = ["AM", "PM", "NIGHT"];

/**
 * 服务项目目录。保养旺季调价/增项只改这里，规则与界面不用动。
 * wax 默认值仅用于展示，排期时由前台按项目确认蜡型。
 */
export const SERVICE_CATALOG: ServiceItem[] = [
  { code: "EDGE", name: "修刃（侧刃+底刃）", price: 120, wax: "none", needsBaseRepair: false },
  { code: "WAX_LOW", name: "低温打蜡", price: 80, wax: "low", needsBaseRepair: false },
  { code: "WAX_ALL", name: "全温打蜡", price: 100, wax: "allTemp", needsBaseRepair: false },
  { code: "WAX_HOT", name: "热蜡深度护理", price: 180, wax: "hot", needsBaseRepair: false },
  { code: "BASE_FILL", name: "底板 P-Tex 修补", price: 160, wax: "none", needsBaseRepair: true },
  { code: "FULL", name: "全套保养（修刃+打蜡+底板检查）", price: 260, wax: "allTemp", needsBaseRepair: true },
];

export function servicesByCodes(codes: string[]): ServiceItem[] {
  return codes
    .map((code) => SERVICE_CATALOG.find((item) => item.code === code))
    .filter((item): item is ServiceItem => Boolean(item));
}

/** 订单所选项目合并出的蜡型需求；项目之间无打蜡需求时为 none */
export function requiredWax(codes: string[]): WaxKind {
  const picked = servicesByCodes(codes);
  const rank: Record<WaxKind, number> = { none: 0, low: 1, allTemp: 2, hot: 3 };
  let result: WaxKind = "none";
  for (const item of picked) {
    if (rank[item.wax] > rank[result]) result = item.wax;
  }
  return result;
}

export function needsBaseRepair(codes: string[]): boolean {
  return servicesByCodes(codes).some((item) => item.needsBaseRepair);
}

export function quoteOf(codes: string[]): number {
  return servicesByCodes(codes).reduce((sum, item) => sum + item.price, 0);
}
