import { useMemo } from "react";
import type { Order, SlotId } from "../rules/types";
import {
  SLOTS,
  TECHNICIANS,
  WAX_POTS,
} from "../rules/masterData";
import { deriveStatus } from "../rules/scheduling";

interface ScheduleBoardProps {
  date: string;
  orders: Order[];
  onPickOrder: (id: string) => void;
}

interface Cell {
  order: Order;
  via: "tech" | "pot";
}

export function ScheduleBoard({ date, orders, onPickOrder }: ScheduleBoardProps) {
  // 当天各格的占用：师傅列按 techId 归位，蜡锅列按 potId 归位
  const grid = useMemo(() => {
    const map = new Map<string, Cell>();
    for (const order of orders) {
      const s = order.schedule;
      if (!s || s.date !== date) continue;
      map.set(`tech:${s.techId}:${s.slot}`, { order, via: "tech" });
      if (s.potId) map.set(`pot:${s.potId}:${s.slot}`, { order, via: "pot" });
    }
    return map;
  }, [orders, date]);

  const cellKey = (kind: "tech" | "pot", id: string, slot: SlotId) =>
    `${kind}:${id}:${slot}`;

  const renderChip = (cell: Cell | undefined) => {
    if (!cell) return <span className="empty-cell">空</span>;
    const { order, via } = cell;
    const done = deriveStatus(order) === "已完成";
    return (
      <button
        type="button"
        className={`board-chip ${done ? "is-done" : ""} ${via === "pot" ? "via-pot" : "via-tech"}`}
        onClick={() => onPickOrder(order.id)}
        title={`${order.id} ${order.customer} · ${order.brand}${via === "pot" ? "（蜡锅占用）" : ""}`}
      >
        <b>{order.id}</b>
        <span>
          {order.customer} · {order.brand} {order.lengthCm}
        </span>
        {order.waxType && <em>{order.waxType}</em>}
        {done && <i className="done-flag">已完工</i>}
      </button>
    );
  };

  return (
    <div className="board-wrap">
      <div className="board-legend">
        <span><i className="dot dot-low" /> 低温区 · 低温蜡</span>
        <span><i className="dot dot-all" /> 全温区 · 全温蜡</span>
        <span><i className="dot dot-hot" /> 高温区 · 热蜡</span>
        <em className="legend-note">
          蜡型与工位温区不合直接拦截；同一时段一位师傅、一只蜡锅各只能承接一张板。
        </em>
      </div>

      <div className="board-scroll">
        <table className="board-table">
          <thead>
            <tr>
              <th className="slot-col">时段</th>
              {TECHNICIANS.map((t) => (
                <th key={t.id}>
                  <b>{t.name}</b>
                  <small>{t.title}</small>
                </th>
              ))}
              {WAX_POTS.map((p) => (
                <th key={p.id} className={`zone-${p.zone}`}>
                  <b>{p.name}</b>
                  <small>{p.zone}</small>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SLOTS.map((slot) => (
              <tr key={slot.id}>
                <td className="slot-col">
                  <b>{slot.label}</b>
                  <small>{slot.window}</small>
                </td>
                {TECHNICIANS.map((t) => (
                  <td key={t.id} className="board-cell">
                    {renderChip(grid.get(cellKey("tech", t.id, slot.id)))}
                  </td>
                ))}
                {WAX_POTS.map((p) => (
                  <td key={p.id} className={`board-cell zone-cell-${p.zone}`}>
                    {renderChip(grid.get(cellKey("pot", p.id, slot.id)))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="board-foot">
        共 {TECHNICIANS.length} 位师傅、{WAX_POTS.length} 只蜡锅（
        {WAX_POTS.map((p) => `${p.name}属${p.zone}`).join("，")}）。点击任意工单卡片查看详情。
      </p>
    </div>
  );
}
