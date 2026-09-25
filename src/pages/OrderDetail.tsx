import {
  serviceSummary,
} from "../rules/scheduling";
import {
  slotById,
  technicianById,
  waxPotById,
} from "../rules/masterData";
import type { Order } from "../rules/types";
import { deriveStatus } from "../rules/scheduling";
import { formatDateTime, formatPickup } from "../storage/dates";

interface OrderDetailProps {
  order: Order;
  onClose: () => void;
  onConfirmPrice: () => void;
  onOpenSchedule: () => void;
  onOpenRevise: () => void;
  onOpenComplete: () => void;
  onRelease: () => void;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail-row">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

export function OrderDetail({
  order,
  onClose,
  onConfirmPrice,
  onOpenSchedule,
  onOpenRevise,
  onOpenComplete,
  onRelease,
}: OrderDetailProps) {
  const status = deriveStatus(order);
  const completed = status === "已完成";
  const tech = order.preferredTechId
    ? technicianById.get(order.preferredTechId)
    : null;
  const sched = order.schedule;
  const schedTech = sched ? technicianById.get(sched.techId) : null;
  const pot = sched?.potId ? waxPotById.get(sched.potId) : null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <p className="eyebrow">
              {order.id} · <span className={`status-pill st-${status}`}>{status}</span>
            </p>
            <h3>
              {order.customer} · {order.brand} {order.lengthCm}cm
            </h3>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>

        <div className="modal-body">
          <section className="detail-section">
            <h4>接单资料</h4>
            <Row label="客户" value={order.customer + (order.phone ? `（${order.phone}）` : "")} />
            <Row label="雪板" value={`${order.brand} · ${order.lengthCm}cm · ${order.boardType}`} />
            <Row label="保养项目" value={serviceSummary(order.services)} />
            <Row label="蜡型" value={order.waxType ?? "—"} />
            <Row label="取板时间" value={formatPickup(order.pickupAt)} />
            <Row label="指定师傅" value={tech ? `${tech.name}（${tech.title}）` : "不指定"} />
          </section>

          <section className="detail-section">
            <h4>报价</h4>
            {order.priceConfirmed && order.price !== null ? (
              <Row label="已核价" value={`¥${order.price}`} />
            ) : (
              <Row
                label="报价状态"
                value={order.price !== null ? `试算 ¥${order.price}（待前台确认）` : "原报价已失效，待重新核价"}
              />
            )}
          </section>

          <section className="detail-section">
            <h4>排期</h4>
            {sched ? (
              <>
                <Row
                  label="时间"
                  value={`${sched.date} ${slotById.get(sched.slot)?.label ?? sched.slot}`}
                />
                <Row label="师傅" value={schedTech ? `${schedTech.name}（${schedTech.title}）` : sched.techId} />
                <Row label="蜡锅" value={pot ? `${pot.name}（${pot.zone}）` : "不占用"} />
              </>
            ) : (
              <Row label="状态" value="未排期（师傅与蜡锅均未占用）" />
            )}
          </section>

          {completed && order.completion && (
            <section className="detail-section completion-view">
              <h4>完工记录（只读）</h4>
              <Row label="侧刃" value={order.completion.sideEdgeDeg} />
              <Row label="底刃" value={order.completion.baseEdgeDeg} />
              <Row label="打蜡温度" value={`${order.completion.waxTempC} ℃`} />
              <Row
                label="底板修补结果"
                value={order.completion.baseRepairResult || "无修补项目"}
              />
              <Row label="完成时间" value={formatDateTime(order.completion.completedAt)} />
            </section>
          )}

          {!completed && (
            <div className="action-row">
              {status === "待核价" && (
                <button className="primary" onClick={onConfirmPrice}>
                  确认核价 ¥{order.price ?? ""}
                </button>
              )}
              {status === "待排期" && (
                <button className="primary" onClick={onOpenSchedule}>
                  安排排期
                </button>
              )}
              {status === "已排期" && (
                <button className="primary" onClick={onOpenComplete}>
                  交板录入
                </button>
              )}
              <button onClick={onOpenRevise}>改板型 / 项目（报价作废）</button>
              {status === "已排期" && (
                <button className="danger-btn" onClick={onRelease}>
                  取消排期
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
