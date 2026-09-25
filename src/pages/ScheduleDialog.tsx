import { useMemo, useState } from "react";
import {
  SLOTS,
  TECHNICIANS,
  WAX_POTS,
  WAX_ZONE_MATCH,
  isWaxService,
  slotById,
  technicianById,
  waxPotById,
} from "../rules/masterData";
import { previewCell } from "../rules/scheduling";
import type { Order, ScheduleInput, SlotId } from "../rules/types";
import { addDays, todayKey } from "../storage/dates";

interface ScheduleDialogProps {
  order: Order;
  orders: Order[];
  onClose: () => void;
  onSchedule: (input: ScheduleInput) => { ok: boolean; errors: string[] };
}

export function ScheduleDialog({
  order,
  orders,
  onClose,
  onSchedule,
}: ScheduleDialogProps) {
  const waxNeeded = isWaxService(order.services);
  const orderWax = order.waxType;
  const requiredZone = orderWax ? WAX_ZONE_MATCH[orderWax] : null;
  const matchingPot =
    waxNeeded && orderWax
      ? WAX_POTS.find((p) => p.zone === WAX_ZONE_MATCH[orderWax])
      : undefined;
  const defaultPotId = matchingPot ? matchingPot.id : "";

  const [date, setDate] = useState(
    order.schedule?.date ??
      (order.pickupAt ? order.pickupAt.slice(0, 10) : addDays(todayKey(), 1)),
  );
  const [slot, setSlot] = useState<SlotId>(order.schedule?.slot ?? "morning");
  const [techId, setTechId] = useState(
    order.schedule?.techId ?? order.preferredTechId ?? TECHNICIANS[0].id,
  );
  const [potId, setPotId] = useState<string>(
    order.schedule?.potId ?? matchingPot?.id ?? "",
  );
  const [errors, setErrors] = useState<string[]>([]);

  const input: ScheduleInput = {
    date,
    slot,
    techId,
    potId: waxNeeded ? potId || null : null,
  };

  // 即时预检：只提示、不落库；真正落库由规则层 evaluateSchedule 再拦一次
  const preview = useMemo(
    () => previewCell(orders, input, order.id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [orders, date, slot, techId, potId, waxNeeded, order.id],
  );

  const selectedPot = potId ? waxPotById.get(potId) : null;
  const zoneMismatch =
    waxNeeded && selectedPot && requiredZone
      ? selectedPot.zone !== requiredZone
      : false;

  const submit = () => {
    const res = onSchedule(input);
    if (res.ok) {
      onClose();
    } else {
      setErrors(res.errors);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <p className="eyebrow">{order.id} · 排期</p>
            <h3>
              {order.customer} · {order.brand} {order.lengthCm}cm（{order.boardType}）
            </h3>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>

        <div className="modal-body">
          <div className="kv-line">
            <span>已确认报价</span>
            <b className="price">¥{order.price ?? "-"}</b>
            {waxNeeded && order.waxType && (
              <em className={`zone-tag ${zoneMismatch ? "bad" : ""}`}>
                {order.waxType} → 需{requiredZone}
              </em>
            )}
          </div>

          <label className="field-block">
            <span>作业日期</span>
            <input
              type="date"
              value={date}
              min={todayKey()}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>

          <div className="field-block">
            <span>时段</span>
            <div className="check-row">
              {SLOTS.map((s) => (
                <button
                  type="button"
                  key={s.id}
                  className={`radio-chip ${slot === s.id ? "on" : ""}`}
                  onClick={() => setSlot(s.id)}
                >
                  <b>{s.label}</b>
                  <small>{s.window}</small>
                </button>
              ))}
            </div>
          </div>

          <label className="field-block">
            <span>师傅（同一时段只能承接一张板）</span>
            <select value={techId} onChange={(e) => setTechId(e.target.value)}>
              {TECHNICIANS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} · {t.title}
                  {order.preferredTechId === t.id ? "（顾客指定）" : ""}
                </option>
              ))}
            </select>
            {preview.techBusy && (
              <small className="warn-text">
                ⚠ {technicianById.get(techId)?.name}在该时段已有工单，提交将被拦截
              </small>
            )}
          </label>

          {waxNeeded ? (
            <label className="field-block">
              <span>蜡锅（一只蜡锅同一时段只服务一张板）</span>
              <select
                value={potId}
                onChange={(e) => setPotId(e.target.value)}
              >
                <option value="">请选择蜡锅</option>
                {WAX_POTS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}（{p.zone}）
                  </option>
                ))}
              </select>
              {selectedPot && zoneMismatch && (
                <small className="danger-text">
                  ✕ 蜡型与工位温区不合：{order.waxType}必须使用{requiredZone}蜡锅
                </small>
              )}
              {selectedPot && !zoneMismatch && (
                <small className="ok-text">
                  ✓ 温区匹配（{selectedPot.zone}）
                </small>
              )}
              {preview.potBusy && (
                <small className="warn-text">
                  ⚠ {selectedPot?.name ?? "该蜡锅"}在该时段已被占用，提交将被拦截
                </small>
              )}
            </label>
          ) : (
            <p className="hint-line">本单不含打蜡，无需占用蜡锅与固定工位。</p>
          )}

          {errors.length > 0 && (
            <div className="error-box">
              {errors.map((msg) => (
                <p key={msg}>✕ {msg}</p>
              ))}
            </div>
          )}
        </div>

        <div className="modal-foot">
          <button onClick={onClose}>取消</button>
          <button className="primary" onClick={submit}>
            确认排期（{date} {slotById.get(slot)?.label}）
          </button>
        </div>
      </div>
    </div>
  );
}
