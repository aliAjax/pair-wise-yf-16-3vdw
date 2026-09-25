import {
  BOARD_TYPES,
  SERVICES,
  TECHNICIANS,
  WAX_IRON_HINT,
  WAX_TYPES,
  isWaxService,
} from "../rules/masterData";
import type { OrderDraft, ServiceCode } from "../rules/types";

interface IntakeFormProps {
  draft: OrderDraft;
  onChange: (next: OrderDraft) => void;
}

/** 接单表单：客户 / 品牌长度 / 板型 / 项目 / 蜡型 / 取板时间 / 指定师傅 */
export function IntakeForm({ draft, onChange }: IntakeFormProps) {
  const set = <K extends keyof OrderDraft>(key: K, value: OrderDraft[K]) =>
    onChange({ ...draft, [key]: value });

  const toggleService = (code: ServiceCode) => {
    const has = draft.services.includes(code);
    const services = has
      ? draft.services.filter((c) => c !== code)
      : [...draft.services, code];
    // 取消打蜡时清掉蜡型，避免脏数据
    const waxType = code === "wax" && has ? "" : draft.waxType;
    onChange({
      ...draft,
      services,
      waxType: services.includes("wax") ? waxType : "",
    });
  };

  const waxEnabled = isWaxService(draft.services);

  return (
    <div className="form-grid">
      <label className="col-2">
        <span>客户姓名 *</span>
        <input
          value={draft.customer}
          placeholder="如：王雪"
          onChange={(e) => set("customer", e.target.value)}
        />
      </label>
      <label>
        <span>联系电话</span>
        <input
          value={draft.phone}
          placeholder="选填"
          onChange={(e) => set("phone", e.target.value)}
        />
      </label>
      <label>
        <span>取板时间 *</span>
        <input
          type="datetime-local"
          value={draft.pickupAt}
          onChange={(e) => set("pickupAt", e.target.value)}
        />
      </label>

      <label>
        <span>雪板品牌 *</span>
        <input
          value={draft.brand}
          placeholder="如：Burton Custom"
          onChange={(e) => set("brand", e.target.value)}
        />
      </label>
      <label>
        <span>长度（cm）*</span>
        <input
          type="number"
          min={100}
          max={220}
          value={draft.lengthCm}
          placeholder="100–220"
          onChange={(e) => set("lengthCm", e.target.value)}
        />
      </label>

      <label>
        <span>板型 *</span>
        <select
          value={draft.boardType}
          onChange={(e) =>
            set("boardType", e.target.value as OrderDraft["boardType"])
          }
        >
          {BOARD_TYPES.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>指定师傅</span>
        <select
          value={draft.preferredTechId}
          onChange={(e) => set("preferredTechId", e.target.value)}
        >
          <option value="">不指定（前台分配）</option>
          {TECHNICIANS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} · {t.title}
            </option>
          ))}
        </select>
      </label>

      <div className="col-2 field-block">
        <span>保养项目（可多选）*</span>
        <div className="check-row">
          {SERVICES.map((s) => (
            <button
              type="button"
              key={s.code}
              className={`check-chip ${draft.services.includes(s.code) ? "on" : ""}`}
              onClick={() => toggleService(s.code)}
            >
              <b>{s.name}</b>
              <small>
                ¥{s.basePrice} · {s.desc}
              </small>
            </button>
          ))}
        </div>
      </div>

      <div className={`col-2 field-block ${waxEnabled ? "" : "disabled"}`}>
        <span>蜡型（含打蜡时必选）*</span>
        <div className="check-row">
          {WAX_TYPES.map((w) => (
            <button
              type="button"
              key={w}
              disabled={!waxEnabled}
              className={`radio-chip ${draft.waxType === w ? "on" : ""}`}
              onClick={() => set("waxType", w)}
            >
              <b>{w}</b>
              <small>{WAX_IRON_HINT[w]}</small>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
