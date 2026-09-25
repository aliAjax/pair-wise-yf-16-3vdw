import { useState } from "react";
import {
  WAX_IRON_HINT,
  isWaxService,
  needsBaseRepair,
} from "../rules/masterData";
import { evaluateCompletion } from "../rules/scheduling";
import type { CompletionInput, Order } from "../rules/types";

interface CompletionDialogProps {
  order: Order;
  onClose: () => void;
  onComplete: (input: CompletionInput) => { ok: boolean; errors: string[] };
}

export function CompletionDialog({
  order,
  onClose,
  onComplete,
}: CompletionDialogProps) {
  const [form, setForm] = useState<CompletionInput>({
    sideEdgeDeg: order.completion?.sideEdgeDeg ?? "",
    baseEdgeDeg: order.completion?.baseEdgeDeg ?? "",
    waxTempC: order.completion?.waxTempC ?? "",
    baseRepairResult: order.completion?.baseRepairResult ?? "",
  });
  const [errors, setErrors] = useState<string[]>([]);

  const set = (key: keyof CompletionInput, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  // 本地即时提示，不替代规则层最终校验
  const liveCheck = evaluateCompletion(order, form);
  const repairNeeded = needsBaseRepair(order.services);

  const submit = () => {
    const res = onComplete(form);
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
            <p className="eyebrow">{order.id} · 交板录入</p>
            <h3>
              {order.customer} · {order.brand} {order.lengthCm}cm
            </h3>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>

        <div className="modal-body">
          <div className="form-grid">
            <label>
              <span>侧刃角度 *</span>
              <input
                value={form.sideEdgeDeg}
                placeholder="如 88°"
                onChange={(e) => set("sideEdgeDeg", e.target.value)}
              />
            </label>
            <label>
              <span>底刃角度 *</span>
              <input
                value={form.baseEdgeDeg}
                placeholder="如 1° 或 0.75°"
                onChange={(e) => set("baseEdgeDeg", e.target.value)}
              />
            </label>
            <label className="col-2">
              <span>打蜡温度（℃）*</span>
              <input
                value={form.waxTempC}
                placeholder="如 120"
                onChange={(e) => set("waxTempC", e.target.value)}
              />
              {order.waxType && isWaxService(order.services) && (
                <small className="hint-text">
                  本单为{order.waxType}，{WAX_IRON_HINT[order.waxType]}
                </small>
              )}
            </label>
            <label className="col-2">
              <span>
                底板修补结果{repairNeeded ? " *" : "（无修补项目可留空）"}
              </span>
              <textarea
                rows={3}
                value={form.baseRepairResult}
                placeholder={
                  repairNeeded ? "如：划痕两处已 P-Tex 填补、打磨平整" : "—"
                }
                onChange={(e) => set("baseRepairResult", e.target.value)}
              />
            </label>
          </div>

          {!liveCheck.ok && (
            <div className="warn-box">
              <b>交板前还缺：</b>
              <ul>
                {liveCheck.errors.map((msg) => (
                  <li key={msg}>{msg}</li>
                ))}
              </ul>
            </div>
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
            完成交板
          </button>
        </div>
      </div>
    </div>
  );
}
