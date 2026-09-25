import { useCallback, useMemo, useState } from "react";
import type {
  CompletionInput,
  Order,
  OrderDraft,
  ScheduleInput,
} from "../rules/types";
import {
  evaluateCompletion,
  evaluateDraft,
  evaluateSchedule,
  quotePrice,
  revise,
  type RevisePatch,
} from "../rules/scheduling";
import { loadOrders, resetOrders, saveOrders } from "../storage/localStore";
import { todayKey } from "../storage/dates";

export interface ActionResult {
  ok: boolean;
  errors: string[];
  orderId?: string;
}

/** 从现有工单生成最大编号 ORD-xxx 的下一号 */
function nextOrderId(orders: Order[]): string {
  let max = 100;
  for (const o of orders) {
    const n = Number(o.id.replace(/^ORD-/, ""));
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `ORD-${max + 1}`;
}

function emptyDraft(): OrderDraft {
  return {
    customer: "",
    phone: "",
    brand: "",
    lengthCm: "",
    boardType: "全地域",
    services: [],
    waxType: "",
    pickupAt: "",
    preferredTechId: "",
  };
}

export function useOrders() {
  const [orders, setOrders] = useState<Order[]>(() => loadOrders());

  const commit = useCallback((updater: (prev: Order[]) => Order[]) => {
    setOrders((prev) => {
      const next = updater(prev);
      saveOrders(next);
      return next;
    });
  }, []);

  const createOrder = useCallback(
    (draft: OrderDraft): ActionResult => {
      const check = evaluateDraft(draft);
      if (!check.ok) return { ok: false, errors: check.errors };

      let newId = "";
      commit((prev) => {
        newId = nextOrderId(prev);
        const order: Order = {
          id: newId,
          customer: draft.customer.trim(),
          phone: draft.phone.trim(),
          brand: draft.brand.trim(),
          lengthCm: check.lengthCm,
          boardType: draft.boardType,
          services: draft.services,
          waxType: draft.waxType === "" ? null : draft.waxType,
          pickupAt: draft.pickupAt,
          preferredTechId: draft.preferredTechId === "" ? null : draft.preferredTechId,
          price: check.price,
          priceConfirmed: false,
          schedule: null,
          completion: null,
          createdAt: `${todayKey()}T${new Date().toTimeString().slice(0, 5)}`,
        };
        return [order, ...prev];
      });
      return { ok: true, errors: [], orderId: newId };
    },
    [commit],
  );

  /** 前台核价确认：金额以当前板型 / 项目 / 蜡型重新试算后锁定 */
  const confirmPrice = useCallback(
    (orderId: string): ActionResult => {
      let result: ActionResult = { ok: false, errors: ["工单不存在"] };
      commit((prev) =>
        prev.map((o) => {
          if (o.id !== orderId || o.completion) return o;
          const price = quotePrice({
            services: o.services,
            waxType: o.waxType,
            boardType: o.boardType,
          });
          result = { ok: true, errors: [], orderId };
          return { ...o, price, priceConfirmed: true };
        }),
      );
      return result;
    },
    [commit],
  );

  /** 改取板时间 / 联系方式等不动报价、不动排期的字段 */
  const updateContact = useCallback(
    (orderId: string, patch: Pick<Order, "customer" | "phone" | "pickupAt">): ActionResult => {
      let result: ActionResult = { ok: false, errors: ["工单不存在"] };
      commit((prev) =>
        prev.map((o) => {
          if (o.id !== orderId || o.completion) return o;
          result = { ok: true, errors: [], orderId };
          return { ...o, ...patch };
        }),
      );
      return result;
    },
    [commit],
  );

  /** 顾客改板型 / 项目 / 蜡型：报价失效、释放占用 */
  const reviseOrder = useCallback(
    (orderId: string, patch: RevisePatch): ActionResult => {
      let result: ActionResult = { ok: false, errors: ["工单不存在或已完工，不能改单"] };
      commit((prev) =>
        prev.map((o) => {
          if (o.id !== orderId) return o;
          if (o.completion) return o;
          result = { ok: true, errors: [], orderId };
          return revise(o, patch);
        }),
      );
      return result;
    },
    [commit],
  );

  /** 排期：规则不通过就整体拦住，返回 issues，原排期保持不动 */
  const scheduleOrder = useCallback(
    (orderId: string, input: ScheduleInput): ActionResult => {
      const target = orders.find((o) => o.id === orderId);
      if (!target) return { ok: false, errors: ["工单不存在"] };
      if (target.completion) return { ok: false, errors: ["工单已完工"] };
      if (!target.priceConfirmed) return { ok: false, errors: ["请先完成核价再排期"] };

      const check = evaluateSchedule(target, orders, input);
      if (!check.ok || !check.schedule) {
        return { ok: false, errors: check.issues.map((i) => i.message) };
      }

      const schedule = check.schedule;
      commit((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, schedule } : o)),
      );
      return { ok: true, errors: [], orderId };
    },
    [orders, commit],
  );

  /** 取消排期：释放师傅与蜡锅占用（已确认报价保留） */
  const releaseSchedule = useCallback(
    (orderId: string): ActionResult => {
      let result: ActionResult = { ok: false, errors: ["工单不存在"] };
      commit((prev) =>
        prev.map((o) => {
          if (o.id !== orderId || o.completion || !o.schedule) return o;
          result = { ok: true, errors: [], orderId };
          return { ...o, schedule: null };
        }),
      );
      return result;
    },
    [commit],
  );

  /** 交板：完工录入门槛不通过就挡住 */
  const completeOrder = useCallback(
    (orderId: string, input: CompletionInput): ActionResult => {
      const target = orders.find((o) => o.id === orderId);
      if (!target) return { ok: false, errors: ["工单不存在"] };
      const check = evaluateCompletion(target, input);
      if (!check.ok) return { ok: false, errors: check.errors };

      const now = new Date();
      const completedAt = `${todayKey()}T${now.toTimeString().slice(0, 5)}`;
      commit((prev) =>
        prev.map((o) =>
          o.id === orderId ? { ...o, completion: { ...input, completedAt } } : o,
        ),
      );
      return { ok: true, errors: [], orderId };
    },
    [orders, commit],
  );

  const resetAll = useCallback(() => {
    setOrders(resetOrders());
  }, []);

  const byStatus = useMemo(() => {
    const groups: Record<string, Order[]> = {
      待核价: [],
      待排期: [],
      已排期: [],
      已完成: [],
    };
    for (const o of orders) {
      const status = o.completion
        ? "已完成"
        : o.schedule
          ? "已排期"
          : o.priceConfirmed
            ? "待排期"
            : "待核价";
      groups[status].push(o);
    }
    return groups;
  }, [orders]);

  return {
    orders,
    byStatus,
    emptyDraft,
    createOrder,
    confirmPrice,
    updateContact,
    reviseOrder,
    scheduleOrder,
    releaseSchedule,
    completeOrder,
    resetAll,
  };
}
