import type { SlotId } from "../rules/types";

/** 本地日期工具：统一按 YYYY-MM-DD，避免 toISOString 的时区偏移 */

export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(base: string, delta: number): string {
  const d = new Date(base + "T00:00:00");
  d.setDate(d.getDate() + delta);
  return toDateKey(d);
}

export function todayKey(): string {
  return toDateKey(new Date());
}

export function formatPickup(value: string): string {
  // datetime-local：YYYY-MM-DDTHH:mm
  if (!value) return "—";
  const [date, time] = value.split("T");
  return `${date} ${time ?? ""}`.trim();
}

export function formatDateTime(value: string): string {
  if (!value) return "—";
  return value.replace("T", " ").slice(0, 16);
}

export function formatSlot(slot: SlotId): string {
  const map: Record<SlotId, string> = {
    morning: "上午",
    midday: "下午",
    evening: "晚间",
  };
  return map[slot];
}
