import type { Order } from "../rules/types";
import { seedOrders } from "./seed";

// ---------------------------------------------------------------------------
// 本地资料存取层：只负责 localStorage 的序列化读取 / 写入 / 重置。
// 页面和规则层不直接碰 localStorage。
// ---------------------------------------------------------------------------

const STORAGE_KEY = "ski-bench:orders:v1";

export function loadOrders(): Order[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seeded = seedOrders();
      saveOrders(seeded);
      return seeded;
    }
    const parsed = JSON.parse(raw) as Order[];
    if (!Array.isArray(parsed)) return seedOrders();
    return parsed;
  } catch {
    return seedOrders();
  }
}

export function saveOrders(orders: Order[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
  } catch {
    // 存储不可用时静默降级为内存态，页面仍可操作
  }
}

export function resetOrders(): Order[] {
  const seeded = seedOrders();
  saveOrders(seeded);
  return seeded;
}
