import { useMemo, useState } from "react";
import type { BoardType, WorkOrder } from "../domain/types";
import {
  SERVICE_CATALOG,
  WAX_LABEL,
  needsBaseRepair,
  quoteOf,
  requiredWax,
  servicesByCodes,
} from "../domain/catalog";
import { invalidateQuoteAndSchedule } from "../domain/scheduleRules";

const BOARD_TYPES: BoardType[] = ["全地域", "公园板", "竞速板", "粉雪板"];

export interface OrderDraftValue {
  customer: string;
  phone: string;
  brand: string;
  lengthCm: number | "";
  boardType: BoardType | "";
  serviceCodes: string[];
}

function blankDraft(): OrderDraftValue {
  return {
    customer: "",
    phone: "",
    brand: "",
    lengthCm: "",
    boardType: "",
    serviceCodes: [],
  };
}

function sameServices(a: string[], b: string[]): boolean {
  return JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
}

/**
 * 接单与核价面板：
 * - 新建工单记录客户/品牌/长度/板型/项目（蜡型由所选打蜡项目决定）；
 * - 顾客改板型或项目 → 原报价失效、占用释放（invalidateQuoteAndSchedule），
 *   工单退回“待核价”，由前台重新核价；
 * - 已完工工单只读。
 * 取板时间与指定师傅在排期台录入。
 */
export function OrderForm({
  editing,
  onCreate,
  onUpdate,
  onCancelEdit,
}: {
  editing: WorkOrder | null;
  onCreate: (value: OrderDraftValue) => void;
  onUpdate: (patch: Partial<WorkOrder>) => void;
  onCancelEdit: () => void;
}) {
  const [draft, setDraft] = useState<OrderDraftValue>(blankDraft);

  const value: OrderDraftValue = editing
    ? {
        customer: editing.customer,
        phone: editing.phone,
        brand: editing.brand,
        lengthCm: editing.lengthCm,
        boardType: editing.boardType,
        serviceCodes: editing.serviceCodes,
      }
    : draft;

  const quote = useMemo(() => quoteOf(value.serviceCodes), [value.serviceCodes]);
  const wax = useMemo(() => requiredWax(value.serviceCodes), [value.serviceCodes]);
  const needRepair = needsBaseRepair(value.serviceCodes);

  function patch<K extends keyof OrderDraftValue>(key: K, v: OrderDraftValue[K]) {
    setDraft((d) => ({ ...d, [key]: v }));
  }

  function toggleService(code: string) {
    const next = value.serviceCodes.includes(code)
      ? value.serviceCodes.filter((c) => c !== code)
      : [...value.serviceCodes, code];
    if (editing) {
      // 改项目：先应用“报价失效 + 释放占用”，再写新项目，工单退回待核价
      onUpdate({ ...invalidateQuoteAndSchedule(editing), serviceCodes: next });
    } else {
      patch("serviceCodes", next);
    }
  }

  function changeBoardType(boardType: BoardType) {
    if (editing) {
      onUpdate({ ...invalidateQuoteAndSchedule(editing), boardType });
    } else {
      patch("boardType", boardType);
    }
  }

  const changed =
    editing !== null &&
    (!sameServices(editing.serviceCodes, value.serviceCodes) ||
      editing.boardType !== value.boardType);

  const formValid =
    value.customer.trim() &&
    value.brand.trim() &&
    value.lengthCm !== "" &&
    Number(value.lengthCm) > 0 &&
    value.boardType !== "" &&
    value.serviceCodes.length > 0;

  return (
    <section className="panel form-panel">
      <div className="heading">
        <div>
          <p>接单台</p>
          <h2>{editing ? `改单 ${editing.id}` : "新增保养工单"}</h2>
        </div>
        {editing && (
          <button className="ghost" onClick={onCancelEdit}>
            取消改单
          </button>
        )}
      </div>

      <div className="field-grid">
        <label>
          <span>客户姓名 *</span>
          <input
            value={value.customer}
            placeholder="如：陈岭"
            disabled={!!editing}
            onChange={(e) => patch("customer", e.target.value)}
          />
        </label>
        <label>
          <span>联系电话</span>
          <input
            value={value.phone}
            placeholder="取板联系用"
            disabled={!!editing}
            onChange={(e) => patch("phone", e.target.value)}
          />
        </label>
        <label>
          <span>雪板品牌 *</span>
          <input
            value={value.brand}
            placeholder="如：Burton / Fischer"
            disabled={!!editing}
            onChange={(e) => patch("brand", e.target.value)}
          />
        </label>
        <label>
          <span>长度（cm）*</span>
          <input
            type="number"
            min={80}
            max={220}
            value={value.lengthCm}
            placeholder="如：156"
            disabled={!!editing}
            onChange={(e) =>
              patch("lengthCm", e.target.value === "" ? "" : Number(e.target.value))
            }
          />
        </label>
        <label className="full">
          <span>板型 *（改动后原报价失效并释放排期）</span>
          <div className="chips">
            {BOARD_TYPES.map((bt) => (
              <button
                type="button"
                key={bt}
                className={value.boardType === bt ? "chip on" : "chip"}
                onClick={() => changeBoardType(bt)}
              >
                {bt}
              </button>
            ))}
          </div>
        </label>

        <label className="full">
          <span>
            保养项目 *（蜡型随项目确定：低温蜡 / 全温蜡 / 热蜡；改动项目会释放原排期）
          </span>
          <div className="service-list">
            {SERVICE_CATALOG.map((item) => {
              const on = value.serviceCodes.includes(item.code);
              return (
                <button
                  type="button"
                  key={item.code}
                  className={on ? "service on" : "service"}
                  onClick={() => toggleService(item.code)}
                >
                  <b>{item.name}</b>
                  <small>
                    ¥{item.price} · {WAX_LABEL[item.wax]}
                    {item.needsBaseRepair ? " · 含底板修补" : ""}
                  </small>
                </button>
              );
            })}
          </div>
        </label>

        {wax !== "none" && (
          <div className="full wax-hint">
            本单蜡型：<b>{WAX_LABEL[wax]}</b>
            {wax === "hot"
              ? "，只能排入高温区工位与高温蜡锅"
              : "，低温区/高温区工位均可，蜡锅须匹配温区"}
          </div>
        )}
      </div>

      <div className="quote-bar">
        <div>
          <small>
            当前核价（{servicesByCodes(value.serviceCodes).length} 项
            {needRepair ? "，含底板修补" : ""}）
          </small>
          <strong>¥{quote}</strong>
          {editing && changed && editing.quote !== null && (
            <em className="stale">原报价 ¥{editing.quote} 已失效，等待重新核价</em>
          )}
        </div>
        {!editing ? (
          <button
            className="primary"
            disabled={!formValid}
            onClick={() => {
              onCreate({ ...value });
              setDraft(blankDraft());
            }}
          >
            接单并核价
          </button>
        ) : (
          <button
            className="primary"
            disabled={!changed}
            onClick={() =>
              onUpdate({
                serviceCodes: value.serviceCodes,
                boardType: value.boardType,
                quote,
                quotedAt: new Date().toISOString(),
                status: "quoted",
                updatedAt: new Date().toISOString(),
              })
            }
          >
            重新核价
          </button>
        )}
      </div>
    </section>
  );
}
