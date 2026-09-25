import { useState } from "react";
import type { WorkOrder } from "../domain/types";
import { needsBaseRepair } from "../domain/catalog";
import { validateFinish, type FinishInput } from "../domain/scheduleRules";
import { STATUS_LABEL } from "./ScheduleBoard";

/**
 * 交板面板：
 * - 交板前必须录入侧刃、底刃、打蜡温度；含底板修补的工单还必须录入修补结果，否则挡住；
 * - 已完工记录只能查看，不能再改。
 */
export function FinishPanel({
  orders,
  onComplete,
}: {
  orders: WorkOrder[];
  onComplete: (orderId: string, input: FinishInput) => string[];
}) {
  const [targetId, setTargetId] = useState<string | null>(null);
  const [form, setForm] = useState<FinishInput>({
    edgeSide: "",
    edgeBase: "",
    waxTemp: "",
    baseRepairResult: "",
  });
  const [errors, setErrors] = useState<string[]>([]);
  const [ok, setOk] = useState("");

  const readyOrders = orders.filter((o) =>
    ["ready", "inProgress", "scheduled"].includes(o.status),
  );
  const doneOrders = orders.filter((o) => o.status === "done");

  const target = orders.find((o) => o.id === targetId) ?? null;
  const repairRequired = target ? needsBaseRepair(target.serviceCodes) : false;

  function pick(o: WorkOrder) {
    setTargetId(o.id);
    setErrors([]);
    setOk("");
    setForm({
      edgeSide: o.finish?.edgeSide ?? "",
      edgeBase: o.finish?.edgeBase ?? "",
      waxTemp: o.finish?.waxTemp ?? "",
      baseRepairResult: o.finish?.baseRepairResult ?? "",
    });
  }

  function submit() {
    if (!target) return;
    const result = validateFinish(target, form);
    if (!result.ok) {
      setErrors(result.errors);
      setOk("");
      return;
    }
    const errs = onComplete(target.id, form);
    if (errs.length) {
      setErrors(errs);
    } else {
      setErrors([]);
      setOk(`${target.id} 已完工交板，记录转为只读。`);
      setTargetId(null);
    }
  }

  return (
    <section className="panel">
      <div className="heading">
        <div>
          <p>交板台</p>
          <h2>完工参数录入</h2>
        </div>
      </div>

      <div className="finish-layout">
        <div className="finish-col">
          <h3>待录入工单</h3>
          {readyOrders.length === 0 && <p className="muted">暂无施工中工单。</p>}
          {readyOrders.map((o) => (
            <article
              key={o.id}
              className={targetId === o.id ? "queue-item selected" : "queue-item"}
              onClick={() => pick(o)}
            >
              <div className="q-head">
                <b>{o.id}</b>
                <span className={`status ${o.status}`}>{STATUS_LABEL[o.status]}</span>
              </div>
              <p>
                {o.customer} · {o.brand} {o.lengthCm}cm
              </p>
              {needsBaseRepair(o.serviceCodes) && (
                <p className="warn-text">本单含底板修补，交板前须填修补结果</p>
              )}
            </article>
          ))}
        </div>

        <div className="finish-col">
          {target && target.status !== "done" ? (
            <>
              <h3>{target.id} 完工参数</h3>
              <div className="field-grid">
                <label>
                  <span>侧刃角度 *（如 88°）</span>
                  <input
                    value={form.edgeSide}
                    placeholder="如 88°"
                    onChange={(e) => setForm((f) => ({ ...f, edgeSide: e.target.value }))}
                  />
                </label>
                <label>
                  <span>底刃角度 *（如 1°）</span>
                  <input
                    value={form.edgeBase}
                    placeholder="如 1°"
                    onChange={(e) => setForm((f) => ({ ...f, edgeBase: e.target.value }))}
                  />
                </label>
                <label className="full">
                  <span>打蜡温度 *（如 120℃）</span>
                  <input
                    value={form.waxTemp}
                    placeholder="如 120℃"
                    onChange={(e) => setForm((f) => ({ ...f, waxTemp: e.target.value }))}
                  />
                </label>
                {repairRequired && (
                  <label className="full">
                    <span>底板修补结果 *</span>
                    <textarea
                      rows={3}
                      value={form.baseRepairResult}
                      placeholder="如：板底 12cm 划痕已用 P-Tex 填平打磨"
                      onChange={(e) =>
                        setForm((f) => ({ ...f, baseRepairResult: e.target.value }))
                      }
                    />
                  </label>
                )}
              </div>
              {errors.length > 0 && (
                <div className="notice error">
                  <b>无法交板：</b>
                  <ul>
                    {errors.map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="action-row">
                <button className="primary" onClick={submit}>
                  确认完工交板
                </button>
              </div>
            </>
          ) : (
            <p className="muted">从左侧选择工单录入侧刃、底刃与打蜡温度。</p>
          )}
        </div>

        <div className="finish-col">
          <h3>完工记录（只读）</h3>
          {doneOrders.length === 0 && <p className="muted">暂无已完工记录。</p>}
          {doneOrders.map((o) => (
            <article key={o.id} className="queue-item done-card">
              <div className="q-head">
                <b>{o.id}</b>
                <span className="status done">{STATUS_LABEL.done}</span>
              </div>
              <p>
                {o.customer} · {o.brand} {o.lengthCm}cm · {o.boardType}
              </p>
              <dl className="finish-view">
                <div>
                  <dt>侧刃</dt>
                  <dd>{o.finish?.edgeSide}</dd>
                </div>
                <div>
                  <dt>底刃</dt>
                  <dd>{o.finish?.edgeBase}</dd>
                </div>
                <div>
                  <dt>打蜡温度</dt>
                  <dd>{o.finish?.waxTemp}</dd>
                </div>
                {o.finish?.baseRepairResult && (
                  <div className="full">
                    <dt>底板修补结果</dt>
                    <dd>{o.finish.baseRepairResult}</dd>
                  </div>
                )}
              </dl>
              <small className="muted">
                完工时间 {o.finish?.finishedAt.slice(0, 16).replace("T", " ")}
              </small>
            </article>
          ))}
        </div>
      </div>
      {ok && <div className="notice ok">{ok}</div>}
    </section>
  );
}
