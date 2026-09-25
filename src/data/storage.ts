// 本地资料存取层：只负责 localStorage 的读写与种子数据，
// 不含任何排期规则，也不渲染界面。
import type { ShopData, WorkOrder } from "../domain/types";

const STORAGE_KEY = "ski-shop-schedule-v1";
const DATA_VERSION = 1;

/** 用固定“今天”生成种子排期，保证首次打开就能看到撞档拦截效果 */
function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function seedData(): ShopData {
  const today = isoToday();
  const now = new Date().toISOString();
  const orders: WorkOrder[] = [
    {
      id: "ORD-106",
      customer: "陈岭",
      phone: "138****0621",
      brand: "Burton",
      lengthCm: 156,
      boardType: "全地域",
      serviceCodes: ["EDGE", "WAX_ALL", "BASE_FILL"],
      quote: 380,
      quotedAt: now,
      status: "scheduled",
      scheduleDate: today,
      slot: "AM",
      technicianId: "T1",
      stationId: "S1",
      potId: "P1",
      finish: null,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "ORD-112",
      customer: "高翔",
      phone: "139****8842",
      brand: "Fischer",
      lengthCm: 165,
      boardType: "竞速板",
      serviceCodes: ["WAX_HOT", "EDGE"],
      quote: 300,
      quotedAt: now,
      status: "scheduled",
      scheduleDate: today,
      slot: "PM",
      technicianId: "T2",
      stationId: "S3",
      potId: "P2",
      finish: null,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "ORD-118",
      customer: "林小满",
      phone: "137****1190",
      brand: "Jones",
      lengthCm: 158,
      boardType: "粉雪板",
      serviceCodes: ["WAX_LOW"],
      quote: 80,
      quotedAt: now,
      status: "quoted",
      scheduleDate: null,
      slot: null,
      technicianId: null,
      stationId: null,
      potId: null,
      finish: null,
      createdAt: now,
      updatedAt: now,
    },
  ];

  return {
    version: DATA_VERSION,
    technicians: [
      { id: "T1", name: "赵师傅" },
      { id: "T2", name: "钱师傅" },
      { id: "T3", name: "孙师傅" },
    ],
    pots: [
      { id: "P1", name: "低温蜡锅 A", zone: "low" },
      { id: "P2", name: "高温蜡锅 B（热蜡）", zone: "hot" },
    ],
    stations: [
      { id: "S1", name: "1 号工位 · 低温区", zone: "low" },
      { id: "S2", name: "2 号工位 · 低温区", zone: "low" },
      { id: "S3", name: "3 号工位 · 高温区", zone: "hot" },
    ],
    orders,
  };
}

export function loadData(): ShopData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seeded = seedData();
      saveData(seeded);
      return seeded;
    }
    const parsed = JSON.parse(raw) as ShopData;
    if (parsed.version !== DATA_VERSION) {
      const seeded = seedData();
      saveData(seeded);
      return seeded;
    }
    return parsed;
  } catch {
    const seeded = seedData();
    saveData(seeded);
    return seeded;
  }
}

export function saveData(data: ShopData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/** 恢复演示数据 */
export function resetData(): ShopData {
  const seeded = seedData();
  saveData(seeded);
  return seeded;
}

export function nextOrderId(existing: WorkOrder[]): string {
  const maxNum = existing.reduce((max, o) => {
    const n = Number(o.id.replace(/\D/g, ""));
    return Number.isFinite(n) && n > max ? n : max;
  }, 100);
  return `ORD-${maxNum + 1}`;
}
