import { useState } from "react";
import type { OrderDraft } from "../rules/types";
import type { ActionResult } from "../state/useOrders";
import { IntakeForm } from "./IntakeForm";

interface IntakeDialogProps {
  draft: OrderDraft;
  setDraft: (d: OrderDraft) => void;
  onClose: () => void;
  onCreate: (d: OrderDraft) => ActionResult;
}

export function IntakeDialog({ draft, setDraft, onClose, onCreate }: IntakeDialogProps) {
  const [errors, setErrors] = useState<string[]>([]);

  const submit = () => {
    const res = onCreate(draft);
    if (res.ok) {
      onClose();
    } else {
      setErrors(res.errors);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <p className="eyebrow">接单登记</p>
            <h3>新建保养工单</h3>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>
        <div className="modal-body">
          <IntakeForm draft={draft} onChange={setDraft} />
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
            保存并生成试算价
          </button>
        </div>
      </div>
    </div>
  );
}
