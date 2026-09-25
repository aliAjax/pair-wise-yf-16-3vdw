import { useMemo, useState } from "react";
import type {
  SlotCode,
  Station,
  Technician,
  WaxPot,
  WorkOrder,
} from "../domain/types";
import {
  SLOT_LABEL,
  SLOT_ORDER,
  WAX_LABEL,
  ZONE_LABEL,
  requiredWax,
  servicesByCodes,
} from "../domain/catalog";
import {
  potBusy,
  potZoneOk,
  stationZoneOk,
  technicianBusy,
  validateSchedule,
  type ScheduleInput,
} from "../domain/scheduleRules";

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

interface TargetState {
  date: string;
  slot: SlotCode;
  technicianId: string;
  stationId: string;
  potId: string;
}

/**
 * 排期台：录入取板时间（日期+时段）与指定师傅，分配工位与蜡锅。
 * 师傅撞档 / 蜡锅撞档 / 蜡型温区不合 → 直接拦住并展示原因，原排期不动。
 */
export function ScheduleBoard({
  orders,
  technicians,
  stations,
  pots,
  onSchedule,
  onRelease,
  onAdvance,
}: {
  orders: WorkOrder[];
  technicians: Technician[];
  stations: Station[];
  pots: WaxPot[];
  onSchedule: (orderId: string, input: ScheduleInput) => string[];
  onRelease: (orderId: string) => void;
  onAdvance: (orderId: string, status: WorkOrder["status"]) => void;
}) {
  const [targetId, setTargetId] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [okMsg, setOkMsg] = useState<string>("");
  const [form, setForm] = useState<TargetState>({
    date: todayStr(),
    slot: "AM",
    technicianId: "",
    stationId: "",
    potId: "",
  });

  // 已核价待排期 + 已排期（允许改期）+ 施工中/待交板（只读占用）
  const visible = useMemo(
    () =>
      orders.filter((o) =>
        ["quoted", "scheduled", "inProgress", "ready"].includes(o.status),
      ),
    [orders],
  );

  const target = orders.find((o) => o.id === targetId) ?? null;
  const wax = target ? requiredWax(target.serviceCodes) : "none";

  function selectOrder(o: WorkOrder) {
    setTargetId(o.id);
    setErrors([]);
    setOkMsg("");
    setForm({
      date: o.scheduleDate ?? todayStr(),
      slot: o.slot ?? "AM",
      technicianId: o.technicianId ?? "",
      stationId: o.stationId ?? "",
      potId: o.potId ?? "",
    });
  }

  function trySchedule() {
    if (!target) return;
    const input: ScheduleInput = {
      date: form.date,
      slot: form.slot,
      technicianId: form.technicianId,
      stationId: form.stationId,
      potId: wax === "none" ? null : form.potId || null,
      wax,
    };
    const result = validateSchedule(input, {
      orders,
      selfId: target.id,
      technicians,
      stations,
      pots,
    });
    if (!result.ok) {
      // 拦住：不写任何数据，原排期不动
      setErrors(result.errors);
      setOkMsg("");
      return;
    }
    const errs = onSchedule(target.id, input);
    if (errs.length) {
      setErrors(errs);
      setOkMsg("");
    } else {
      setErrors([]);
      setOkMsg(
        `已排入 ${input.date} ${SLOT_LABEL[input.slot]}，原占用已自动调整。`,
      );
    }
  }

  return (
    <section className="panel">
      <div className="heading">
        <div>
          <p>排期台</p>
          <h2>取板时间 · 师傅 · 工位 · 蜡锅</h2>
        </div>
      </div>

      <div className="schedule-layout">
        <div className="order-queue">
          <h3>待排 / 在排工单</h3>
          {visible.length === 0 && <p className="muted">暂无可排期工单。</p>}
          {visible.map((o) => {
            const busy =
              o.status === "scheduled" || o.status === "inProgress" || o.status === "ready";
            return (
              <article
                key={o.id}
                className={
                  targetId === o.id
                    ? "queue-item selected"
                    : busy
                      ? "queue-item booked"
                      : "queue-item"
                }
                onClick={() => selectOrder(o)}
              >
                <div className="q-head">
                  <b>{o.id}</b>
                  <span className={`status ${o.status}`}>{STATUS_LABEL[o.status]}</span>
                </div>
                <p>
                  {o.customer} · {o.brand} {o.lengthCm}cm · {o.boardType}
                </p>
                <p className="muted">
                  {servicesByCodes(o.serviceCodes).map((s) => s.name).join("、")}
                </p>
                {busy && o.scheduleDate && o.slot && (
                  <p className="booked-line">
                    🕒 {o.scheduleDate} {SLOT_LABEL[o.slot]} ·{" "}
                    {technicians.find((t) => t.id === o.technicianId)?.name} ·{" "}
                    {stations.find((s) => s.id === o.stationId)?.name}
                    {o.potId && ` · ${pots.find((p) => p.id === o.potId)?.name}`}
                  </p>
                )}
              </article>
            );
          })}
        </div>

        <div className="schedule-edit">
          {!target ? (
            <p className="muted">从左侧选择一张板开始排期。</p>
          ) : (
            <>
              <h3>
                {target.id} · {target.customer} 的{target.brand}
                {target.lengthCm}cm（{target.boardType}）
              </h3>
              <div className="wax-banner" data-wax={wax}>
                蜡型需求：<b>{WAX_LABEL[wax]}</b>
                {wax === "hot"
                  ? "（热蜡仅限高温区工位 + 高温蜡锅）"
                  : wax === "none"
                    ? "（本单不占用蜡锅）"
                    : "（低温区/高温区工位均可）"}
              </div>

              <div className="field-grid">
                <label>
                  <span>取板日期</span>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, date: e.target.value }))
                    }
                  />
                </label>
                <label>
                  <span>取板时段</span>
                  <select
                    value={form.slot}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, slot: e.target.value as SlotCode }))
                    }
                  >
                    {SLOT_ORDER.map((s) => (
                      <option key={s} value={s}>
                        {SLOT_LABEL[s]}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="full">
                  <span>指定师傅（该时段已撞档的师傅不可选）</span>
                  <div className="chips">
                    {technicians.map((t) => {
                      const busyNow =
                        form.technicianId !== t.id &&
                        technicianBusy(orders, form.date, form.slot, t.id, target.id);
                      return (
                        <button
                          type="button"
                          key={t.id}
                          className={form.technicianId === t.id ? "chip on" : "chip"}
                          disabled={busyNow}
                          title={busyNow ? "该时段师傅已有一张板" : ""}
                          onClick={() =>
                            setForm((f) => ({ ...f, technicianId: t.id }))
                          }
                        >
                          {t.name}
                          {busyNow ? " · 已排" : ""}
                        </button>
                      );
                    })}
                  </div>
                </label>

                <label className="full">
                  <span>工位（温区不合的工位已隐藏）</span>
                  <div className="chips">
                    {stations.map((s) => {
                      const zoneOk = stationZoneOk(s, wax);
                      return (
                        <button
                          type="button"
                          key={s.id}
                          className={form.stationId === s.id ? "chip on" : "chip"}
                          disabled={!zoneOk}
                          title={zoneOk ? "" : `工位为${ZONE_LABEL[s.zone]}，与蜡型不合`}
                          onClick={() => setForm((f) => ({ ...f, stationId: s.id }))}
                        >
                          {s.name}
                        </button>
                      );
                    })}
                  </div>
                </label>

                {wax !== "none" && (
                  <label className="full">
                    <span>蜡锅（该时段已占用 / 温区不合的蜡锅不可选）</span>
                    <div className="chips">
                      {pots.map((p) => {
                        const zoneOk = potZoneOk(p, wax);
                        const busyNow =
                          form.potId !== p.id &&
                          potBusy(orders, form.date, form.slot, p.id, target.id);
                        const dis = !zoneOk || busyNow;
                        return (
                          <button
                            type="button"
                            key={p.id}
                            className={form.potId === p.id ? "chip on" : "chip"}
                            disabled={dis}
                            title={
                              !zoneOk
                                ? `蜡锅为${ZONE_LABEL[p.zone]}，与蜡型不合`
                                : busyNow
                                  ? "该时段蜡锅已用于另一张板"
                                  : ""
                            }
                            onClick={() => setForm((f) => ({ ...f, potId: p.id }))}
                          >
                            {p.name}
                            {busyNow ? " · 占用" : ""}
                          </button>
                        );
                      })}
                    </div>
                  </label>
                )}
              </div>

              {errors.length > 0 && (
                <div className="notice error">
                  <b>已拦住，原排期未改动：</b>
                  <ul>
                    {errors.map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                </div>
              )}
              {okMsg && <div className="notice ok">{okMsg}</div>}

              <div className="action-row">
                <button className="primary" onClick={trySchedule}>
                  确认排期
                </button>
                {target.status !== "quoted" && (
                  <>
                    {target.status === "scheduled" && (
                      <button onClick={() => onAdvance(target.id, "inProgress")}>
                        开始施工
                      </button>
                    )}
                    {(target.status === "inProgress" || target.status === "ready") && (
                      <button onClick={() => onAdvance(target.id, "ready")}>
                        标记待交板
                      </button>
                    )}
                    <button className="danger ghost" onClick={() => onRelease(target.id)}>
                      释放占用（退回待排）
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

export const STATUS_LABEL: Record<WorkOrder["status"], string> = {
  draft: "草稿",
  quoted: "待核价/待排",
  scheduled: "已排期",
  inProgress: "施工中",
  ready: "待交板",
  done: "已完工",
};
