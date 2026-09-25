import { useMemo, useState } from "react";
import type { Order, OrderStatus } from "../rules/types";
import { serviceSummary } from "../rules/scheduling";
import { slotById, technicianById, waxPotById } from "../rules/masterData";
import { formatPickup } from "../storage/dates";

interface OrderListProps {
  orders: Order[];
  onPickOrder: (id: string) => void;
}

const TABS: (OrderStatus | "全部")[] = [
  "全部",
  "待核价",
  "待排期",
  "已排期",
  "已完成",
];

function statusOf(o: Order): OrderStatus {
  if (o.completion) return "已完成";
  if (o.schedule) return "已排期";
  if (o.priceConfirmed) return "待排期";
  return "待核价";
}

export function OrderList({ orders, onPickOrder }: OrderListProps) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("全部");
  const [keyword, setKeyword] = useState("");

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return orders.filter((o) => {
      if (tab !== "全部" && statusOf(o) !== tab) return false;
      if (!kw) return true;
      const hay = `${o.id} ${o.customer} ${o.phone} ${o.brand} ${o.boardType}`.toLowerCase();
      return hay.includes(kw);
    });
  }, [orders, tab, keyword]);

  return (
    <div className="order-list">
      <div className="list-toolbar">
        <div className="tabs">
          {TABS.map((t) => (
            <button
              key={t}
              className={`tab ${tab === t ? "on" : ""}`}
              onClick={() => setTab(t)}
            >
              {t}
              {t !== "全部" && (
                <i className="tab-count">{orders.filter((o) => statusOf(o) === t).length}</i>
              )}
            </button>
          ))}
        </div>
        <input
          className="search-box"
          placeholder="搜单号 / 客户 / 品牌"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <p className="empty-tip">当前筛选下没有工单。</p>
      ) : (
        <div className="cards">
          {filtered.map((o) => {
            const status = statusOf(o);
            const tech = o.schedule
              ? technicianById.get(o.schedule.techId)
              : o.preferredTechId
                ? technicianById.get(o.preferredTechId)
                : null;
            const pot = o.schedule?.potId ? waxPotById.get(o.schedule.potId) : null;
            return (
              <button
                type="button"
                key={o.id}
                className={`order-card st-card-${status}`}
                onClick={() => onPickOrder(o.id)}
              >
                <div className="card-top">
                  <b>{o.id}</b>
                  <span className={`status-pill st-${status}`}>{status}</span>
                </div>
                <h4>
                  {o.customer} · {o.brand} {o.lengthCm}
                </h4>
                <p className="card-meta">{o.boardType} · {serviceSummary(o.services)}{o.waxType ? ` · ${o.waxType}` : ""}</p>
                <div className="card-bottom">
                  <span>取板 {formatPickup(o.pickupAt)}</span>
                  {o.schedule ? (
                    <span>
                      {o.schedule.date} {slotById.get(o.schedule.slot)?.label} · {tech?.name}
                      {pot ? ` · ${pot.name}` : ""}
                    </span>
                  ) : (
                    <span>{tech ? `指定 ${tech.name}` : "未分配师傅"}</span>
                  )}
                  <span className={o.priceConfirmed ? "" : "price-stale"}>
                    {o.priceConfirmed && o.price !== null
                      ? `¥${o.price}`
                      : o.price !== null
                        ? `试算 ¥${o.price} · 待核价`
                        : "报价已失效"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
