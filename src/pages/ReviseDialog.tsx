import { useMemo, useState } from "react";
import { quotePrice, type RevisePatch } from "../rules/scheduling";
import type { Order, OrderDraft } from "../rules/types";
import { IntakeForm } from "./IntakeForm";

interface ReviseDialogProps {
  order: Order;
  onClose: () => void;
  onRevise: (patch: RevisePatch) => { ok: boolean; errors: string[] };
}

export function ReviseDialog({ order, onClose, onRevise }: ReviseDialogProps) {
  const [draft, setDraft] = useState<OrderDraft>({
    customer: order.customer,
    phone: order.phone,
    brand: order.brand,
    lengthCm: String(order.lengthCm),
    boardType: order.boardType,
    services: order.services,
    waxType: order.waxType ?? "",
    pickupAt: order.pickupAt,
    preferredTechId: order.preferredTechId ?? "",
  });
  const [errors, setErrors] = useState<string[]>([]);

  const previewPrice = useMemo(
    () =>
      quotePrice({
        services: draft.services,
        waxType: draft.waxType === "" ? null : draft.waxType,
        boardType: draft.boardType,
      }),
    [draft.services, draft.waxType, draft.boardType],
  );

  const submit = () => {
    const lengthCm = Number(draft.lengthCm);
    const localErrors: string[] = [];
    if (!draft.brand.trim()) localErrors.push("请填写雪板品牌");
    if (!Number.isFinite(lengthCm) || lengthCm < 100 || lengthCm > 220) {
      localErrors.push("雪板长度需在 100–220 cm 之间");
    }
    if (draft.services.length === 0) localErrors.push("请至少选择一个保养项目");
    if (draft.services.includes("wax") && !draft.waxType) {
      localErrors.push("打蜡项目必须选择蜡型");
    }
    if (localErrors.length > 0) {
      setErrors(localErrors);
      return;
    }

    const res = onRevise({
      brand: draft.brand.trim(),
      lengthCm,
      boardType: draft.boardType,
      services: draft.services,
      waxType: draft.waxType,
    });
    if (res.ok) onClose();
    else setErrors(res.errors);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <p className="eyebrow">{order.id} · 顾客改单</p>
            <h3>{order.customer} · 板型 / 项目调整</h3>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>

        <div className="modal-body">
          <div className="warn-box">
            板型或保养项目变更后，<b>原报价立即失效，原师傅 / 蜡锅 / 工位占用同步释放</b>
            ，需由前台按新内容重新核价后再排期。取板时间与联系方式不在此修改。
          </div>
          <IntakeForm draft={draft} onChange={setDraft} />

          <div className="kv-line price-preview">
            <span>按新内容试算（待重新确认）</span>
            <b className="price">¥{previewPrice}</b>
          </div>

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
            确认改单并释放占用
          </button>
        </div>
      </div>
    </div>
  );
}
