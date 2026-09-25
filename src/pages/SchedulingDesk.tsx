import { useMemo, useState } from "react";
import { useOrders } from "../state/useOrders";
import type { OrderDraft } from "../rules/types";
import { deriveStatus } from "../rules/scheduling";
import { addDays, todayKey } from "../storage/dates";
import { ScheduleBoard } from "./ScheduleBoard";
import { OrderList } from "./OrderList";
import { IntakeDialog } from "./IntakeDialog";
import { ScheduleDialog } from "./ScheduleDialog";
import { CompletionDialog } from "./CompletionDialog";
import { ReviseDialog } from "./ReviseDialog";
import { OrderDetail } from "./OrderDetail";

type Modal =
  | { kind: "none" }
  | { kind: "intake" }
  | { kind: "detail"; id: string }
  | { kind: "schedule"; id: string }
  | { kind: "complete"; id: string }
  | { kind: "revise"; id: string };

export function SchedulingDesk() {
  const {
    orders,
    emptyDraft,
    createOrder,
    confirmPrice,
    reviseOrder,
    scheduleOrder,
    releaseSchedule,
    completeOrder,
    resetAll,
  } = useOrders();

  const [date, setDate] = useState(todayKey());
  const [modal, setModal] = useState<Modal>({ kind: "none" });
  const [draft, setDraft] = useState<OrderDraft>(emptyDraft);

  const current = useMemo(() => {
    if (modal.kind === "none" || modal.kind === "intake") return null;
    return orders.find((o) => o.id === modal.id) ?? null;
  }, [modal, orders]);

  const metrics = useMemo(() => {
    const counts = { pending: 0, scheduled: 0, done: 0, conflicts: 0 };
    // 统计当前展示日的师傅 / 蜡锅占用是否出现同人同档重复（规则已拦截，用于提示历史异常）
    const seen = new Set<string>();
    for (const o of orders) {
      const s = deriveStatus(o);
      if (s === "已完成") counts.done += 1;
      else if (s === "已排期") counts.scheduled += 1;
      else if (s === "待核价" || s === "待排期") counts.pending += 1;

      if (o.schedule) {
        const techKey = `t:${o.schedule.techId}:${o.schedule.date}:${o.schedule.slot}`;
        const potKey = o.schedule.potId
          ? `p:${o.schedule.potId}:${o.schedule.date}:${o.schedule.slot}`
          : null;
        if (seen.has(techKey) || (potKey && seen.has(potKey))) counts.conflicts += 1;
        seen.add(techKey);
        if (potKey) seen.add(potKey);
      }
    }
    return counts;
  }, [orders]);

  const openIntake = () => {
    setDraft(emptyDraft());
    setModal({ kind: "intake" });
  };

  const pickOrder = (id: string) => setModal({ kind: "detail", id });

  return (
    <main className="app">
      <header className="topbar">
        <div>
          <p className="eyebrow">滑雪板调校维护 · 保养旺季排期台</p>
          <h1>雪板保养排期台</h1>
          <span className="subtitle">
            接单核价 → 师傅 / 蜡锅分档排期 → 完工录入交板；撞档与温区不合直接拦截，原排期不动。
          </span>
        </div>
        <div className="topbar-actions">
          <button onClick={resetAll} title="清空本地改动并恢复演示数据">
            重置演示数据
          </button>
          <button className="primary" onClick={openIntake}>
            ＋ 接单登记
          </button>
        </div>
      </header>

      <section className="metrics">
        <article>
          <small>待处理（待核价 / 待排期）</small>
          <strong>{metrics.pending}</strong>
        </article>
        <article>
          <small>已排期待交板</small>
          <strong>{metrics.scheduled}</strong>
        </article>
        <article>
          <small>完工工单（只读）</small>
          <strong>{metrics.done}</strong>
        </article>
        <article>
          <small>撞档异常（规则应保持为 0）</small>
          <strong className={metrics.conflicts > 0 ? "danger-num" : ""}>
            {metrics.conflicts}
          </strong>
        </article>
      </section>

      <section className="panel board-panel">
        <div className="heading">
          <div>
            <p>排期看板</p>
            <h2>{date} 工位分档</h2>
          </div>
          <div className="date-nav">
            <button onClick={() => setDate((d) => addDays(d, -1))}>‹ 前一天</button>
            <input
              type="date"
              value={date}
              onChange={(e) => e.target.value && setDate(e.target.value)}
            />
            <button onClick={() => setDate((d) => addDays(d, 1))}>后一天 ›</button>
            <button className="link-btn" onClick={() => setDate(todayKey())}>
              今天
            </button>
          </div>
        </div>
        <ScheduleBoard date={date} orders={orders} onPickOrder={pickOrder} />
      </section>

      <section className="panel">
        <div className="heading">
          <div>
            <p>工单总览</p>
            <h2>接单与处理队列</h2>
          </div>
          <button className="primary" onClick={openIntake}>
            ＋ 接单登记
          </button>
        </div>
        <OrderList orders={orders} onPickOrder={pickOrder} />
      </section>

      <footer className="page-foot">
        排期规则（rules）、本地资料存取（storage）、操作页（pages）分开维护；资料保存在浏览器
        localStorage，换机不保留。
      </footer>

      {modal.kind === "intake" && (
        <IntakeDialog
          draft={draft}
          setDraft={setDraft}
          onClose={() => setModal({ kind: "none" })}
          onCreate={createOrder}
        />
      )}

      {current && modal.kind === "detail" && (
        <OrderDetail
          order={current}
          onClose={() => setModal({ kind: "none" })}
          onConfirmPrice={() => confirmPrice(current.id)}
          onOpenSchedule={() => setModal({ kind: "schedule", id: current.id })}
          onOpenRevise={() => setModal({ kind: "revise", id: current.id })}
          onOpenComplete={() => setModal({ kind: "complete", id: current.id })}
          onRelease={() => {
            releaseSchedule(current.id);
          }}
        />
      )}

      {current && modal.kind === "schedule" && (
        <ScheduleDialog
          order={current}
          orders={orders}
          onClose={() => setModal({ kind: "detail", id: current.id })}
          onSchedule={(input) => {
            const res = scheduleOrder(current.id, input);
            if (res.ok) setModal({ kind: "detail", id: current.id });
            return res;
          }}
        />
      )}

      {current && modal.kind === "complete" && (
        <CompletionDialog
          order={current}
          onClose={() => setModal({ kind: "detail", id: current.id })}
          onComplete={(input) => {
            const res = completeOrder(current.id, input);
            if (res.ok) setModal({ kind: "detail", id: current.id });
            return res;
          }}
        />
      )}

      {current && modal.kind === "revise" && (
        <ReviseDialog
          order={current}
          onClose={() => setModal({ kind: "detail", id: current.id })}
          onRevise={(patch) => {
            const res = reviseOrder(current.id, patch);
            if (res.ok) setModal({ kind: "detail", id: current.id });
            return res;
          }}
        />
      )}
    </main>
  );
}
