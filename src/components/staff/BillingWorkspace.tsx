import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  addAdjustment,
  addPayment,
  BillingApiError,
  completeCheckout,
  createInvoice,
  getCheckoutQueue,
  getEncounterInvoices,
  getOutstandingInvoices,
  getServices,
  issueInvoice,
  refundPayment,
  type CheckoutQueueItem,
  type Invoice,
  type Payment,
  type Service,
  voidInvoice,
} from "../../api/billing";
import {
  beginBillingAttemptRequest,
  BillingAttemptError,
  clearBillingAttempt,
  getOrCreateBillingAttempt,
  paymentRequestFingerprint,
  replaceBillingAttemptWithNewKey,
  refundRequestFingerprint,
} from "../../api/billingIdempotency";
import "./BillingReceiptPrint.css";

function BillingWorkspace({ staffId }: { staffId: number }) {
  const [queue, setQueue] = useState<CheckoutQueueItem[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [outstanding, setOutstanding] = useState<Invoice[]>([]);
  const [selected, setSelected] = useState<CheckoutQueueItem | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [lines, setLines] = useState<{ serviceId: number; quantity: number }[]>([]);
  const [discount, setDiscount] = useState(0);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<Payment["method"]>("CASH");
  const [methodLabel, setMethodLabel] = useState("");
  const [reference, setReference] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [paymentAttemptsPending, setPaymentAttemptsPending] = useState<Set<number>>(
    () => new Set(),
  );
  const [refundAttemptsPending, setRefundAttemptsPending] = useState<Set<number>>(
    () => new Set(),
  );
  const busyRef = useRef(false);
  const refundPromptRef = useRef(false);

  async function reloadQueue() {
    const [q, s, o] = await Promise.all([
      getCheckoutQueue(),
      getServices(),
      getOutstandingInvoices(),
    ]);
    setQueue(q);
    setServices(s);
    setOutstanding(o);
    setSelected((current) =>
      current
        ? q.find((item) => item.patientVisitId === current.patientVisitId) || {
            ...current,
            checkoutStatus: "COMPLETE",
          }
        : null,
    );
  }

  useEffect(() => {
    let alive = true;
    Promise.all([getCheckoutQueue(), getServices(), getOutstandingInvoices()])
      .then(([q, s, o]) => {
        if (alive) {
          setQueue(q);
          setServices(s);
          setOutstanding(o);
        }
      })
      .catch((e) =>
        alive &&
        setError(e instanceof Error ? e.message : "Could not load billing workspace."),
      )
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  async function select(item: CheckoutQueueItem) {
    setSelected(item);
    setInvoice(null);
    setInvoices([]);
    setError("");
    try {
      const list = await getEncounterInvoices(item.patientVisitId);
      setInvoices(list);
      setInvoice(list.find((entry) => entry.status !== "VOID") || null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load invoice history.");
    }
  }

  async function syncInvoices(visitId: number) {
    const list = await getEncounterInvoices(visitId);
    setInvoices(list);
    setInvoice(list.find((entry) => entry.status !== "VOID") || null);
    await reloadQueue();
  }

  async function act(
    task: () => Promise<unknown>,
    message: string,
    attemptType?: "payment" | "refund",
  ): Promise<boolean> {
    if (!selected || busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await task();
      await syncInvoices(selected.patientVisitId);
      setSuccess(message);
      return true;
    } catch (e) {
      if (e instanceof BillingApiError && e.status === 409) {
        const keyConflict = e.message.toLowerCase().includes("idempotency-key");
        setError(
          keyConflict && attemptType
            ? `${e.message} This ${attemptType} attempt keeps its original key. Retry the same details, or explicitly start a new attempt only if you intend a separate ${attemptType}.`
            : `Billing conflict: ${e.message}`,
        );
      } else {
        setError(e instanceof Error ? e.message : "Billing action failed.");
      }
      return false;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  function addLine() {
    setLines((current) => [...current, { serviceId: services[0]?.id || 0, quantity: 1 }]);
  }

  const preview = lines.reduce((sum, row) => {
    const service = services.find((item) => item.id === row.serviceId);
    if (!service?.currentPrice) return sum;
    const base = service.currentPrice * row.quantity;
    return sum + base + (base * (service.taxRatePercent || 0)) / 100;
  }, 0);

  async function draft(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    await act(async () => {
      const created = await createInvoice(selected.patientVisitId, lines, discount);
      setInvoice(created);
      setInvoices((current) => [created, ...current]);
      setLines([]);
      setDiscount(0);
    }, "Draft invoice created.");
  }

  async function payment(e: FormEvent) {
    e.preventDefault();
    if (!invoice || busyRef.current) return;

    const request = {
      invoiceId: invoice.id,
      amount: Number(amount),
      method,
      methodLabel,
      paymentReference: reference,
    };
    let fingerprint: string;
    try {
      fingerprint = await paymentRequestFingerprint(request);
    } catch (cause) {
      setError(
        cause instanceof BillingAttemptError
          ? cause.message
          : "Could not fingerprint this payment. No request was sent.",
      );
      return;
    }

    let attempt: ReturnType<typeof getOrCreateBillingAttempt>;
    try {
      attempt = getOrCreateBillingAttempt(staffId, "payment", invoice.id, fingerprint);
    } catch (cause) {
      setPaymentAttemptsPending((current) => new Set(current).add(invoice.id));
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not load the saved payment attempt. No request was sent.",
      );
      return;
    }
    setPaymentAttemptsPending((current) => new Set(current).add(invoice.id));

    const finishRequest = beginBillingAttemptRequest(staffId);
    let completed: boolean;
    try {
      completed = await act(
        () =>
          addPayment(
            invoice.id,
            request.amount,
            method,
            methodLabel,
            reference,
            attempt.idempotencyKey,
          ),
        "Payment recorded. No payment gateway was contacted.",
        "payment",
      );
    } finally {
      finishRequest();
    }
    if (completed) {
      try {
        clearBillingAttempt(staffId, "payment", invoice.id);
        setPaymentAttemptsPending((current) => {
          const next = new Set(current);
          next.delete(invoice.id);
          return next;
        });
        setAmount("");
        setMethodLabel("");
        setReference("");
      } catch (cause) {
        setError(
          `Payment was recorded, but its retry key could not be cleared. Retry the same details to retrieve that payment. ${
            cause instanceof Error ? cause.message : ""
          }`,
        );
      }
    }
  }

  async function refund(payment: Payment) {
    if (busyRef.current || refundPromptRef.current) return;
    refundPromptRef.current = true;
    try {
      const reason = window.prompt("Refund reason");
      if (!reason) return;
      const already = invoice!.refunds
        .filter((refundEntry) => refundEntry.paymentId === payment.id)
        .reduce((total, refundEntry) => total + refundEntry.amount, 0);
      const refundable = payment.amount - already;
      if (refundable <= 0) return;
      const value = window.prompt(`Refund amount (up to ₹${refundable.toFixed(2)})`);
      if (!value) return;
      if (busyRef.current) {
        setError("Another billing action is in progress. Try again when it finishes.");
        return;
      }

      const request = {
        invoiceId: invoice!.id,
        paymentId: payment.id,
        amount: Number(value),
        reason,
        refundReference: "",
      };
      let fingerprint: string;
      try {
        fingerprint = await refundRequestFingerprint(request);
      } catch (cause) {
        setError(
          cause instanceof BillingAttemptError
            ? cause.message
            : "Could not fingerprint this refund. No request was sent.",
        );
        return;
      }

      let attempt: ReturnType<typeof getOrCreateBillingAttempt>;
      try {
        attempt = getOrCreateBillingAttempt(staffId, "refund", payment.id, fingerprint);
      } catch (cause) {
        setRefundAttemptsPending((current) => new Set(current).add(payment.id));
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not load the saved refund attempt. No request was sent.",
        );
        return;
      }
      setRefundAttemptsPending((current) => new Set(current).add(payment.id));

      const finishRequest = beginBillingAttemptRequest(staffId);
      let completed: boolean;
      try {
        completed = await act(
          () =>
            refundPayment(
              request.invoiceId,
              request.paymentId,
              request.amount,
              request.reason,
              request.refundReference,
              attempt.idempotencyKey,
            ),
          "Refund recorded.",
          "refund",
        );
      } finally {
        finishRequest();
      }
      if (completed) {
        try {
          clearBillingAttempt(staffId, "refund", payment.id);
          setRefundAttemptsPending((current) => {
            const next = new Set(current);
            next.delete(payment.id);
            return next;
          });
        } catch (cause) {
          setError(
            `Refund was recorded, but its retry key could not be cleared. Retry the same details to retrieve that refund. ${
              cause instanceof Error ? cause.message : ""
            }`,
          );
        }
      }
    } finally {
      refundPromptRef.current = false;
    }
  }

  async function startNewPaymentAttempt(invoiceId: number) {
    if (
      !window.confirm(
        "The previous payment request may already have succeeded. Starting a new attempt uses a new key and could record an additional payment. Continue only if this is a separate payment.",
      )
    ) {
      return;
    }
    if (!invoice || invoice.id !== invoiceId) {
      setError("The selected invoice changed. Reload it before starting a new payment attempt.");
      return;
    }
    const paymentAmount = Number(amount);
    if (
      !Number.isFinite(paymentAmount) ||
      paymentAmount <= 0 ||
      paymentAmount > invoice.outstandingAmount
    ) {
      setError(`Enter a payment amount greater than zero and no more than ₹${invoice.outstandingAmount.toFixed(2)}.`);
      return;
    }
    if (method === "OTHER" && !methodLabel.trim()) {
      setError("Enter a payment method label before starting a new attempt.");
      return;
    }
    let fingerprint: string;
    try {
      fingerprint = await paymentRequestFingerprint({
        invoiceId,
        amount: paymentAmount,
        method,
        methodLabel,
        paymentReference: reference,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not fingerprint the new payment attempt.");
      return;
    }
    try {
      replaceBillingAttemptWithNewKey(staffId, "payment", invoiceId, fingerprint);
      setPaymentAttemptsPending((current) => new Set(current).add(invoiceId));
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The new payment key could not be saved.");
    }
  }

  async function startNewRefundAttempt(paymentId: number) {
    if (
      !window.confirm(
        "The previous refund request may already have succeeded. Starting a new attempt uses a new key and could record an additional refund. Continue only if this is a separate refund.",
      )
    ) {
      return;
    }
    const paymentEntry = invoice?.payments.find((entry) => entry.id === paymentId);
    if (!invoice || !paymentEntry) {
      setError("Could not find the payment for this refund attempt.");
      return;
    }
    const reason = window.prompt("Refund reason");
    if (!reason) return;
    const already = invoice.refunds
      .filter((refundEntry) => refundEntry.paymentId === paymentId)
      .reduce((total, refundEntry) => total + refundEntry.amount, 0);
    const refundable = paymentEntry.amount - already;
    if (refundable <= 0) {
      setError("This payment has no refundable balance.");
      return;
    }
    const value = window.prompt(`Refund amount (up to ₹${refundable.toFixed(2)})`);
    if (!value) return;
    const refundAmount = Number(value);
    if (!Number.isFinite(refundAmount) || refundAmount <= 0 || refundAmount > refundable) {
      setError(`Enter a refund amount greater than zero and no more than ₹${refundable.toFixed(2)}.`);
      return;
    }
    let fingerprint: string;
    try {
      fingerprint = await refundRequestFingerprint({
        invoiceId: invoice.id,
        paymentId,
        amount: refundAmount,
        reason,
        refundReference: "",
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not fingerprint the new refund attempt.");
      return;
    }
    try {
      replaceBillingAttemptWithNewKey(staffId, "refund", paymentId, fingerprint);
      setRefundAttemptsPending((current) => new Set(current).add(paymentId));
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The new refund key could not be saved.");
    }
  }

  if (loading) {
    return (
      <section className="billing-workspace">
        <p role="status">Loading billing queue…</p>
      </section>
    );
  }

  return (
    <section className="billing-workspace">
      <div className="billing-heading">
        <div>
          <span className="staff-eyebrow">ENCOUNTER CHECKOUT</span>
          <h2>Billing workspace</h2>
          <p>
            Record clinic payments and reconcile outstanding balances. Payments are
            recorded manually; this workspace does not contact a payment gateway.
          </p>
        </div>
        <button type="button" onClick={() => void reloadQueue()}>
          Refresh
        </button>
      </div>
      <div className="billing-kpis">
        <article>
          <span>Encounters awaiting checkout</span>
          <strong>{queue.length}</strong>
        </article>
        <article>
          <span>Outstanding invoices</span>
          <strong>{outstanding.length}</strong>
        </article>
        <article>
          <span>Outstanding balance</span>
          <strong>₹{outstanding.reduce((total, item) => total + item.outstandingAmount, 0).toFixed(2)}</strong>
        </article>
      </div>
      {error && (
        <p className="staff-inline-error" role="alert">
          {error}
        </p>
      )}
      {success && (
        <p className="billing-success" role="status">
          {success}
        </p>
      )}

      <div className="billing-layout">
        <section className="billing-panel">
          <header>
            <h3>Checkout review</h3>
            <span>{queue.length}</span>
          </header>
          {queue.length === 0 ? (
            <p className="billing-muted">No signed encounters are awaiting checkout.</p>
          ) : (
            <div className="billing-encounters">
              {queue.map((item) => (
                <button
                  type="button"
                  key={item.patientVisitId}
                  className={
                    selected?.patientVisitId === item.patientVisitId ? "is-selected" : ""
                  }
                  onClick={() => void select(item)}
                >
                  <strong>{item.patientName}</strong>
                  <small>
                    Patient #{item.patientId} · Visit #{item.patientVisitId} ·{" "}
                    {item.assignedDoctorName || "Doctor not recorded"}
                  </small>
                  <small>
                    {item.patientMobile || "No mobile"} · {item.invoiceStatus || "No invoice"} ·
                    {" "}due ₹{item.outstandingBalance.toFixed(2)}
                  </small>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="billing-panel">
          {!selected ? (
            <p className="billing-muted">
              Select an encounter to review its invoice and payments.
            </p>
          ) : (
            <>
              <header>
                <div>
                  <span className="staff-eyebrow">
                    PATIENT #{selected.patientId} · VISIT #{selected.patientVisitId}
                  </span>
                  <h3>{selected.patientName}</h3>
                </div>
                <span className="billing-status">{selected.checkoutStatus}</span>
              </header>

              {!invoice ? (
                <form
                  className="billing-form"
                  onSubmit={(event) => void draft(event)}
                >
                  <h4>Create invoice draft</h4>
                  {lines.map((line, index) => (
                    <div className="billing-line-editor" key={index}>
                      <select
                        aria-label="Billable service"
                        required
                        value={line.serviceId}
                        onChange={(event) =>
                          setLines((current) =>
                            current.map((item, currentIndex) =>
                              currentIndex === index
                                ? { ...item, serviceId: Number(event.target.value) }
                                : item,
                            ),
                          )
                        }
                      >
                        {services.map((service) => (
                          <option
                            key={service.id}
                            value={service.id}
                            disabled={!service.currentPrice}
                          >
                            {service.name} ·{" "}
                            {service.currentPrice === null
                              ? "Price not set"
                              : `₹${service.currentPrice} + ${service.taxRatePercent || 0}%`}
                          </option>
                        ))}
                      </select>
                      <input
                        aria-label="Quantity"
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={line.quantity}
                        onChange={(event) =>
                          setLines((current) =>
                            current.map((item, currentIndex) =>
                              currentIndex === index
                                ? { ...item, quantity: Number(event.target.value) }
                                : item,
                            ),
                          )
                        }
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setLines((current) =>
                            current.filter((_, currentIndex) => currentIndex !== index),
                          )
                        }
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="billing-secondary"
                    onClick={addLine}
                    disabled={!services.length}
                  >
                    Add line item
                  </button>
                  <label>
                    Discount amount
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={discount}
                      onChange={(event) => setDiscount(Number(event.target.value))}
                    />
                    <small>Any discount requires Admin approval before invoice issue.</small>
                  </label>
                  <div className="billing-total">
                    Preview total{" "}
                    <strong>₹{Math.max(0, preview - discount).toFixed(2)}</strong>
                  </div>
                  <button type="submit" disabled={busy || lines.length === 0}>
                    Save invoice draft
                  </button>
                </form>
              ) : (
                <>
                  <div className="billing-invoice receipt-print">
                    <div className="billing-invoice-title">
                      <div>
                        <small>INVOICE</small>
                        <strong>{invoice.invoiceNumber}</strong>
                      </div>
                      <span className={`billing-status ${invoice.status.toLowerCase()}`}>
                        {invoice.status.replaceAll("_", " ")}
                      </span>
                    </div>
                    <p>
                      {invoice.patientName} · Visit #{invoice.patientVisitId} ·{" "}
                      {new Date(invoice.invoiceDate).toLocaleString()}
                    </p>
                    <div className="billing-invoice-lines">
                      {invoice.lines.map((line) => (
                        <div key={line.id}>
                          <span>
                            {line.serviceName} · {line.quantity} × ₹{line.unitPrice.toFixed(2)}
                            {line.taxRatePercent
                              ? ` + ${line.taxRatePercent}% tax`
                              : ""}
                          </span>
                          <strong>₹{line.lineTotal.toFixed(2)}</strong>
                        </div>
                      ))}
                    </div>
                    <dl>
                      <div>
                        <dt>Subtotal</dt>
                        <dd>₹{invoice.subtotal.toFixed(2)}</dd>
                      </div>
                      <div>
                        <dt>Discount · {invoice.discountStatus}</dt>
                        <dd>- ₹{invoice.discountAmount.toFixed(2)}</dd>
                      </div>
                      <div>
                        <dt>Tax</dt>
                        <dd>₹{invoice.taxAmount.toFixed(2)}</dd>
                      </div>
                      <div>
                        <dt>Total</dt>
                        <dd>₹{invoice.total.toFixed(2)}</dd>
                      </div>
                      <div>
                        <dt>Paid</dt>
                        <dd>₹{invoice.paidAmount.toFixed(2)}</dd>
                      </div>
                      <div className="outstanding">
                        <dt>Outstanding</dt>
                        <dd>₹{invoice.outstandingAmount.toFixed(2)}</dd>
                      </div>
                    </dl>
                    <div className="billing-ui-controls">
                      {invoice.status === "DRAFT" && (
                        <>
                          <button
                            type="button"
                            disabled={
                              busy ||
                              invoice.discountStatus === "PENDING" ||
                              invoice.discountStatus === "REJECTED"
                            }
                            onClick={() =>
                              void act(
                                () => issueInvoice(invoice.id),
                                "Invoice issued.",
                              )
                            }
                          >
                            Issue invoice
                          </button>
                          <button
                            type="button"
                            className="billing-secondary"
                            disabled={busy}
                            onClick={() =>
                              void act(() => voidInvoice(invoice.id), "Draft invoice voided.")
                            }
                          >
                            Void draft
                          </button>
                        </>
                      )}
                      {invoice.status !== "DRAFT" && invoice.status !== "VOID" && (
                        <>
                          <button
                            type="button"
                            className="billing-secondary"
                            onClick={() => window.print()}
                          >
                            Print receipt
                          </button>
                          <button
                            type="button"
                            className="billing-secondary"
                            disabled={busy || invoice.outstandingAmount <= 0}
                            onClick={() => {
                              const value = window.prompt(
                                "Adjustment amount (positive or negative)",
                              );
                              const reason = window.prompt("Reason for adjustment");
                              if (value && reason) {
                                void act(
                                  () => addAdjustment(invoice.id, Number(value), reason),
                                  "Invoice adjustment recorded.",
                                );
                              }
                            }}
                          >
                            Adjustment
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {invoice.payments.map((paymentEntry) => (
                    <article
                      className="billing-payment billing-receipt-print"
                      key={paymentEntry.id}
                    >
                      <div>
                        <strong>Receipt {paymentEntry.receiptNumber}</strong>
                        <small>
                          {paymentEntry.method === "OTHER"
                            ? paymentEntry.methodLabel || "Other"
                            : paymentEntry.method}{" "}
                          · {paymentEntry.reference || "No reference"} ·{" "}
                          {new Date(paymentEntry.paidAt).toLocaleString()}
                        </small>
                      </div>
                      <b>₹{paymentEntry.amount.toFixed(2)}</b>
                      <button
                        type="button"
                        className="billing-secondary"
                        onClick={() => window.print()}
                      >
                        Print receipt
                      </button>
                      <button
                        type="button"
                        className="billing-secondary"
                        disabled={busy}
                        onClick={() => void refund(paymentEntry)}
                      >
                        Refund
                      </button>
                      {refundAttemptsPending.has(paymentEntry.id) && (
                        <>
                          <small>
                            Retry the same details to reuse this key. The previous request
                            may already have succeeded; a new attempt can record another
                            refund.
                          </small>
                          <button
                            type="button"
                            className="billing-secondary"
                            disabled={busy}
                            onClick={() => startNewRefundAttempt(paymentEntry.id)}
                          >
                            Start new refund attempt
                          </button>
                        </>
                      )}
                    </article>
                  ))}
                  {invoice.refunds.map((refundEntry) => (
                    <article
                      className="billing-payment billing-ledger-entry"
                      key={`refund-${refundEntry.id}`}
                    >
                      <div>
                        <strong>Refund #{refundEntry.id}</strong>
                        <small>
                          {refundEntry.reason} ·{" "}
                          {new Date(refundEntry.refundedAt).toLocaleString()} · Staff #
                          {refundEntry.refundedByStaffId}
                        </small>
                      </div>
                      <b>- ₹{refundEntry.amount.toFixed(2)}</b>
                    </article>
                  ))}
                  {invoice.adjustments.map((adjustment) => (
                    <article
                      className="billing-payment billing-ledger-entry"
                      key={`adjustment-${adjustment.id}`}
                    >
                      <div>
                        <strong>Adjustment #{adjustment.id}</strong>
                        <small>
                          {adjustment.reason} ·{" "}
                          {new Date(adjustment.createdAt).toLocaleString()} · Staff #
                          {adjustment.createdByStaffId}
                        </small>
                      </div>
                      <b>
                        {adjustment.amount < 0 ? "-" : "+"} ₹
                        {Math.abs(adjustment.amount).toFixed(2)}
                      </b>
                    </article>
                  ))}
                  {["ISSUED", "PARTIALLY_PAID"].includes(invoice.status) && (
                    <form
                      className="billing-payment-form"
                      onSubmit={(event) => void payment(event)}
                    >
                      <h4>Collect payment</h4>
                      <label>
                        Amount
                        <input
                          type="number"
                          required
                          min="0.01"
                          max={invoice.outstandingAmount}
                          step="0.01"
                          value={amount}
                          onChange={(event) => setAmount(event.target.value)}
                        />
                        <small>Balance due: ₹{invoice.outstandingAmount.toFixed(2)}</small>
                      </label>
                      <label>
                        Method
                        <select
                          value={method}
                          onChange={(event) =>
                            setMethod(event.target.value as Payment["method"])
                          }
                        >
                          <option value="CASH">Cash</option>
                          <option value="UPI">UPI</option>
                          <option value="CARD">Card</option>
                          <option value="OTHER">Other</option>
                        </select>
                      </label>
                      <label>
                        Payment reference (optional)
                        <input
                          maxLength={180}
                          value={reference}
                          onChange={(event) => setReference(event.target.value)}
                        />
                      </label>
                      {method === "OTHER" && (
                        <label>
                          Other payment method
                          <input
                            maxLength={80}
                            required
                            value={methodLabel}
                            onChange={(event) => setMethodLabel(event.target.value)}
                          />
                        </label>
                      )}
                      <button type="submit" disabled={busy}>
                        Record payment
                      </button>
                      {paymentAttemptsPending.has(invoice.id) && (
                        <>
                          <small>
                            Retry unchanged details to reuse this key. The previous request
                            may already have succeeded; a new attempt can record another
                            payment.
                          </small>
                          <button
                            type="button"
                            className="billing-secondary"
                            disabled={busy}
                            onClick={() => startNewPaymentAttempt(invoice.id)}
                          >
                            Start new payment attempt
                          </button>
                        </>
                      )}
                    </form>
                  )}
                  {invoice.status === "PAID" && selected.checkoutStatus !== "COMPLETE" && (
                    <button
                      type="button"
                      disabled={busy || !selected.checkoutReady}
                      title={
                        !selected.checkoutReady
                          ? selected.checkoutBlockers.join(" ")
                          : undefined
                      }
                      onClick={() => {
                        if (window.confirm("Complete checkout for this encounter?")) {
                          void act(
                            () => completeCheckout(invoice.id),
                            "Checkout completed.",
                          );
                        }
                      }}
                    >
                      Complete checkout
                    </button>
                  )}
                </>
              )}
            </>
          )}
        </section>
      </div>

      {selected && (
        <section className="billing-panel billing-checkout-review">
          <header>
            <div>
              <span className="staff-eyebrow">CHECKOUT VALIDATION</span>
              <h3>
                {selected.patientName} · Visit #{selected.patientVisitId}
              </h3>
              <p>
                {selected.assignedDoctorName || "Doctor not recorded"} ·{" "}
                {selected.consultationStatus || "Consultation status unavailable"} · Invoice{" "}
                {selected.invoiceStatus || "not created"}
              </p>
            </div>
          </header>
          <dl className="billing-checkout-summary">
            <div>
              <dt>Invoice total</dt>
              <dd>₹{selected.invoiceTotal.toFixed(2)}</dd>
            </div>
            <div>
              <dt>Paid (net)</dt>
              <dd>₹{selected.amountPaid.toFixed(2)}</dd>
            </div>
            <div>
              <dt>Refunds</dt>
              <dd>₹{selected.refundedAmount.toFixed(2)}</dd>
            </div>
            <div>
              <dt>Adjustments</dt>
              <dd>₹{selected.adjustmentAmount.toFixed(2)}</dd>
            </div>
            <div className="outstanding">
              <dt>Outstanding</dt>
              <dd>₹{selected.outstandingBalance.toFixed(2)}</dd>
            </div>
          </dl>
          {!selected.checkoutReady && (
            <div className="billing-checkout-blockers" role="status">
              <strong>Checkout cannot be completed yet</strong>
              <ul>
                {selected.checkoutBlockers.map((blocker) => (
                  <li key={blocker}>{blocker}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {invoices.length > 1 && (
        <section className="billing-panel">
          <h3>Invoice history</h3>
          {invoices.map((historyInvoice) => (
            <button
              type="button"
              className="billing-history-row"
              key={historyInvoice.id}
              onClick={() => setInvoice(historyInvoice)}
            >
              {historyInvoice.invoiceNumber} · {historyInvoice.status} · ₹
              {historyInvoice.total.toFixed(2)}
            </button>
          ))}
        </section>
      )}
    </section>
  );
}

export default BillingWorkspace;
