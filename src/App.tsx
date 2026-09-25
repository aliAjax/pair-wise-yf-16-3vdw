import { useMemo, useState } from "react";
import "./styles.css";
import type { ShopData, WorkOrder } from "./domain/types";
import {
  WAX_LABEL,
  requiredWax,
  servicesByCodes,
} from "./domain/catalog";
import {
  isLocked,
  validateFinish,
  validateSchedule,
  type FinishInput,
  type ScheduleInput,
} from "./domain/scheduleRules";
import { loadData, nextOrderId, resetData, saveData } from "./data/storage";
import { OrderForm, type OrderDraftValue } from "./components/OrderForm";
import { ScheduleBoard, STATUS_LABEL } from "./components/ScheduleBoard";
import { FinishPanel } from "./components/FinishPanel";

type Tab = "intake" | "schedule" | "finish" | "all";

const TABS: { key: Tab; label: string }[] = [
  { key: "intake", label: "接单 / 核价" },
  { key: "schedule", label: "排期台" },
  { key: "finish", label: "交板录入" },
  { key: "all", label: "工单总览" },
];

function App() {
  const [data, setData] = useState<ShopData>(() => loadData());
  const [tab, setTab] = useState<Tab>("intake");
  const [editingId, setEditingId] = useState<string | null>(null);

  function commit(next: ShopData) {
    setData(next);
    saveData(next);
  }

  function updateOrder(id: string, patch: Partial<WorkOrder>) {
    commit({
      ...data,
      orders: data.orders.map((o) =>
        o.id === id ? { ...o, ...patch, updatedAt: new Date().toISOString() } : o,
      ),
    });
  }

  // —— 接单 ——
  function handleCreate(value: OrderDraftValue) {
    const now = new Date().toISOString();
    const order: WorkOrder = {
      id: nextOrderId(data.orders),
      customer: value.customer,
      phone: value.phone,
      brand: value.brand,
      lengthCm: value.lengthCm,
      boardType: value.boardType,
      serviceCodes: value.serviceCodes,
      quote: servicesByCodes(value.serviceCodes).reduce((s, i) => s + i.price, 0),
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
    };
    commit({ ...data, orders: [order, ...data.orders] });
    setTab("schedule");
  }

  // —— 排期：由规则层校验，通过才写回；校验失败原排期不动 ——
  function handleSchedule(orderId: string, input: ScheduleInput): string[] {
    const order = data.orders.find((o) => o.id === orderId);
    if (!order) return ["工单不存在"];
    // 写回前在数据层再过一遍规则，界面绕过也不会破坏占用约束
    const result = validateSchedule(input, {
      orders: data.orders,
      selfId: order.id,
      technicians: data.technicians,
      stations: data.stations,
      pots: data.pots,
    });
    if (!result.ok) return result.errors;
    updateOrder(orderId, {
      scheduleDate: input.date,
      slot: input.slot,
      technicianId: input.technicianId,
      stationId: input.stationId,
      potId: input.potId,
      status: order.status === "quoted" || order.status === "draft" ? "scheduled" : order.status,
    });
    return [];
  }

  function handleRelease(orderId: string) {
    updateOrder(orderId, {
      scheduleDate: null,
      slot: null,
      technicianId: null,
      stationId: null,
      potId: null,
      status: "quoted",
      finish: null,
    });
  }

  function handleAdvance(orderId: string, status: WorkOrder["status"]) {
    updateOrder(orderId, { status });
  }

  // —— 交板：前置条件不满足直接挡住 ——
  function handleComplete(orderId: string, input: FinishInput): string[] {
    const order = data.orders.find((o) => o.id === orderId);
    if (!order) return ["工单不存在"];
    const result = validateFinish(order, input);
    if (!result.ok) return result.errors;
    updateOrder(orderId, {
      status: "done",
      finish: {
        edgeSide: input.edgeSide.trim(),
        edgeBase: input.edgeBase.trim(),
        waxTemp: input.waxTemp.trim(),
        baseRepairResult: input.baseRepairResult?.trim() || undefined,
        finishedAt: new Date().toISOString(),
      },
    });
    return [];
  }

  const editing = data.orders.find((o) => o.id === editingId) ?? null;

  const metrics = useMemo(() => {
    const scheduled = data.orders.filter((o) =>
      ["scheduled", "inProgress", "ready"].includes(o.status),
    ).length;
    const done = data.orders.filter((o) => o.status === "done").length;
    const waiting = data.orders.filter((o) => o.status === "quoted").length;
    const busyTech = new Set(
      data.orders
        .filter((o) => ["scheduled", "inProgress", "ready"].includes(o.status))
        .map((o) => `${o.scheduleDate}|${o.slot}|${o.technicianId}`),
    ).size;
    return [
      { label: "待排期", value: waiting },
      { label: "在排/施工中", value: scheduled },
      { label: "已完工", value: done },
      { label: "今日占用师傅位", value: busyTech },
    ];
  }, [data.orders]);

  return (
    <main className="app">
      <section className="hero">
        <p>hxyfront-62004 · 保养旺季排期台 · Port 62004</p>
        <h1>滑雪板保养排期台</h1>
        <span>
          接单核价、师傅/蜡锅时段防撞档、蜡型与工位温区校验、交板完工参数把关。
          排期规则、本地资料存取、操作页三层分开维护。
        </span>
      </section>

      <section className="metrics">
        {metrics.map((m) => (
          <article key={m.label}>
            <small>{m.label}</small>
            <strong>{m.value}</strong>
          </article>
        ))}
      </section>

      <nav className="tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={tab === t.key ? "tab on" : "tab"}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
        <button
          className="tab reset"
          onClick={() => {
            if (confirm("恢复为内置演示数据？当前本地排期将被覆盖。")) {
              commit(resetData());
              setEditingId(null);
            }
          }}
        >
          重置演示数据
        </button>
      </nav>

      {tab === "intake" && (
        <div className="workspace">
          <aside className="panel">
            <h2>保养旺季提示</h2>
            <ul className="tips">
              <li>同一时段一位师傅只接一张板，一只蜡锅也只服务一张板。</li>
              <li>热蜡必须进高温区工位与高温蜡锅，选错会被直接拦住。</li>
              <li>顾客改板型或项目，原报价立即失效并释放师傅/工位/蜡锅。</li>
              <li>交板前必须录侧刃、底刃、打蜡温度；含底板修补还要补结果。</li>
            </ul>
          </aside>
          <OrderForm
            editing={editing}
            onCreate={handleCreate}
            onUpdate={(patch) => editingId && updateOrder(editingId, patch)}
            onCancelEdit={() => setEditingId(null)}
          />
        </div>
      )}

      {tab === "schedule" && (
        <ScheduleBoard
          orders={data.orders}
          technicians={data.technicians}
          stations={data.stations}
          pots={data.pots}
          onSchedule={handleSchedule}
          onRelease={handleRelease}
          onAdvance={handleAdvance}
        />
      )}

      {tab === "finish" && (
        <FinishPanel orders={data.orders} onComplete={handleComplete} />
      )}

      {tab === "all" && (
        <section className="panel">
          <div className="heading">
            <div>
              <p>工单总览</p>
              <h2>全部本地工单（{data.orders.length}）</h2>
            </div>
          </div>
          <div className="table-wrap">
            <table className="order-table">
              <thead>
                <tr>
                  <th>工单号</th>
                  <th>客户 / 雪板</th>
                  <th>板型</th>
                  <th>项目 / 蜡型</th>
                  <th>报价</th>
                  <th>状态</th>
                  <th>排期</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {data.orders.map((o) => {
                  const locked = isLocked(o);
                  return (
                    <tr key={o.id}>
                      <td>{o.id}</td>
                      <td>
                        {o.customer}
                        <br />
                        <small className="muted">
                          {o.brand} {o.lengthCm}cm
                        </small>
                      </td>
                      <td>{o.boardType}</td>
                      <td>
                        {servicesByCodes(o.serviceCodes)
                          .map((s) => s.name)
                          .join("、")}
                        <br />
                        <small className="muted">蜡型：{WAX_LABEL[requiredWax(o.serviceCodes)]}</small>
                      </td>
                      <td>{o.quote === null ? <em className="stale">已失效</em> : `¥${o.quote}`}</td>
                      <td>
                        <span className={`status ${o.status}`}>{STATUS_LABEL[o.status]}</span>
                      </td>
                      <td>
                        {o.scheduleDate
                          ? `${o.scheduleDate} ${o.slot ? STATUS_SLOT[o.slot] : ""}`
                          : "—"}
                      </td>
                      <td>
                        {locked ? (
                          <button
                            onClick={() => {
                              setTab("finish");
                            }}
                          >
                            查看记录
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setEditingId(o.id);
                              setTab("intake");
                            }}
                          >
                            改板型/项目
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}

const STATUS_SLOT: Record<string, string> = {
  AM: "上午",
  PM: "下午",
  NIGHT: "晚间",
};

export default App;
