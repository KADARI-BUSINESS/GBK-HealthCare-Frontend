import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  createInvestigation,
  createPrescription,
  createReferral,
  listInvestigations,
  listPrescriptions,
  listReferrals,
  setInvestigationStatus,
  setReferralStatus,
  signPrescription,
  updatePrescription,
  type Investigation,
  type Prescription,
  type PrescriptionItem,
  type Referral,
} from "../api/clinicalOrders";
import "./ClinicalOrdersPanel.css";

const emptyItem = (): PrescriptionItem => ({
  medicineName: "",
  dosage: "",
  route: "Oral",
  frequency: "",
  duration: "",
  quantity: 1,
  instructions: "",
  startDate: new Date().toISOString().slice(0, 10),
});
type Props = { queueEntryId: number; encounterStatus: string };
function ClinicalOrdersPanel({ queueEntryId, encounterStatus }: Props) {
  const [tab, setTab] = useState<
    "prescriptions" | "investigations" | "referrals"
  >("prescriptions");
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [investigations, setInvestigations] = useState<Investigation[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [items, setItems] = useState<PrescriptionItem[]>([emptyItem()]);
  const [notes, setNotes] = useState("");
  const [editing, setEditing] = useState<number | null>(null);
  const [supersedes, setSupersedes] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const canOrder = [
    "IN_CONSULTATION",
    "ON_HOLD",
    "CONSULTATION_SIGNED",
  ].includes(encounterStatus);
  async function reload() {
    const [p, i, r] = await Promise.all([
      listPrescriptions(queueEntryId),
      listInvestigations(queueEntryId),
      listReferrals(queueEntryId),
    ]);
    setPrescriptions(p);
    setInvestigations(i);
    setReferrals(r);
  }
  useEffect(() => {
    let alive = true;
    Promise.all([
      listPrescriptions(queueEntryId),
      listInvestigations(queueEntryId),
      listReferrals(queueEntryId),
    ])
      .then(([p, i, r]) => {
        if (alive) {
          setPrescriptions(p);
          setInvestigations(i);
          setReferrals(r);
        }
      })
      .catch((e) => {
        if (alive)
          setError(
            e instanceof Error ? e.message : "Could not load clinical orders.",
          );
      });
    return () => {
      alive = false;
    };
  }, [queueEntryId]);
  async function run(
    task: () => Promise<unknown>,
    success: string,
  ): Promise<boolean> {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await task();
      await reload();
      setMessage(success);
      return true;
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Clinical order update failed.",
      );
      return false;
    } finally {
      setBusy(false);
    }
  }
  function startEdit(p?: Prescription) {
    setEditing(p?.status === "DRAFT" ? p.id : null);
    setSupersedes(null);
    setNotes(p?.notes || "");
    setItems(p?.items.map(({ id: _id, ...item }) => item) || [emptyItem()]);
  }
  function replace(p: Prescription) {
    setEditing(null);
    setSupersedes(p.id);
    setNotes(p.notes || "");
    setItems(p.items.map(({ id: _id, ...item }) => item));
    setTab("prescriptions");
  }
  async function savePrescription(e: FormEvent) {
    e.preventDefault();
    const payload = { notes, items };
    await run(async () => {
      if (editing) await updatePrescription(queueEntryId, editing, payload);
      else
        await createPrescription(queueEntryId, {
          ...payload,
          supersedesPrescriptionId: supersedes,
        });
      setEditing(null);
      setSupersedes(null);
      setItems([emptyItem()]);
      setNotes("");
    }, "Prescription draft saved.");
  }
  async function saveInvestigation(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    if (
      await run(
        () =>
          createInvestigation(queueEntryId, {
            type: f.get("type") as Investigation["type"],
            name: String(f.get("name")),
            indication: String(f.get("indication")),
            priority: f.get("priority") as Investigation["priority"],
          }),
        "Investigation order created.",
      )
    )
      form.reset();
  }
  async function saveReferral(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    if (
      await run(
        () =>
          createReferral(queueEntryId, {
            specialty: String(f.get("specialty")),
            providerOrFacility: String(f.get("providerOrFacility")),
            clinicalReason: String(f.get("clinicalReason")),
            priority: f.get("priority") as Referral["priority"],
            instructions: String(f.get("instructions")),
          }),
        "Referral created.",
      )
    )
      form.reset();
  }
  return (
    <section
      className="clinical-orders"
      aria-label="Prescription, investigation and referral orders"
    >
      <header className="clinical-orders-heading">
        <div>
          <span className="doctor-opd-eyebrow">CARE PLAN</span>
          <h4>Prescriptions & orders</h4>
          <p>
            Orders are attached to this encounter and available to the future
            checkout workflow.
          </p>
        </div>
        <span className="clinical-orders-state">
          Checkout:{" "}
          {encounterStatus === "CONSULTATION_SIGNED"
            ? "Ready for checkout"
            : "Pending consultation"}
        </span>
      </header>
      {error && (
        <p className="clinical-orders-alert" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="clinical-orders-success" role="status">
          {message}
        </p>
      )}
      <nav className="clinical-orders-tabs" aria-label="Clinical order types">
        {(
          [
            ["prescriptions", "Prescriptions"],
            ["investigations", "Investigations"],
            ["referrals", "Referrals"],
          ] as const
        ).map(([key, label]) => (
          <button
            type="button"
            key={key}
            aria-pressed={tab === key}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </nav>
      {tab === "prescriptions" && (
        <div className="clinical-orders-content">
          <form
            className="clinical-order-form"
            onSubmit={(e) => void savePrescription(e)}
          >
            <h5>
              {supersedes
                ? `Replacement for prescription #${supersedes}`
                : editing
                  ? "Edit prescription draft"
                  : "New prescription draft"}
            </h5>
            {items.map((item, index) => (
              <fieldset className="medication-item" key={index}>
                <legend>Medicine {index + 1}</legend>
                <div className="clinical-order-grid">
                  <label>
                    Medicine name
                    <input
                      required
                      maxLength={180}
                      value={item.medicineName}
                      onChange={(e) =>
                        setItems((v) =>
                          v.map((x, i) =>
                            i === index
                              ? { ...x, medicineName: e.target.value }
                              : x,
                          ),
                        )
                      }
                    />
                  </label>
                  <label>
                    Dosage
                    <input
                      required
                      maxLength={120}
                      placeholder="e.g. 500 mg"
                      value={item.dosage}
                      onChange={(e) =>
                        setItems((v) =>
                          v.map((x, i) =>
                            i === index ? { ...x, dosage: e.target.value } : x,
                          ),
                        )
                      }
                    />
                  </label>
                  <label>
                    Route
                    <input
                      required
                      maxLength={80}
                      value={item.route}
                      onChange={(e) =>
                        setItems((v) =>
                          v.map((x, i) =>
                            i === index ? { ...x, route: e.target.value } : x,
                          ),
                        )
                      }
                    />
                  </label>
                  <label>
                    Frequency
                    <input
                      required
                      maxLength={120}
                      placeholder="e.g. twice daily"
                      value={item.frequency}
                      onChange={(e) =>
                        setItems((v) =>
                          v.map((x, i) =>
                            i === index
                              ? { ...x, frequency: e.target.value }
                              : x,
                          ),
                        )
                      }
                    />
                  </label>
                  <label>
                    Duration
                    <input
                      required
                      maxLength={80}
                      placeholder="e.g. 5 days"
                      value={item.duration}
                      onChange={(e) =>
                        setItems((v) =>
                          v.map((x, i) =>
                            i === index
                              ? { ...x, duration: e.target.value }
                              : x,
                          ),
                        )
                      }
                    />
                  </label>
                  <label>
                    Quantity
                    <input
                      required
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={item.quantity}
                      onChange={(e) =>
                        setItems((v) =>
                          v.map((x, i) =>
                            i === index
                              ? { ...x, quantity: Number(e.target.value) }
                              : x,
                          ),
                        )
                      }
                    />
                  </label>
                  <label>
                    Start date
                    <input
                      required
                      type="date"
                      value={item.startDate}
                      onChange={(e) =>
                        setItems((v) =>
                          v.map((x, i) =>
                            i === index
                              ? { ...x, startDate: e.target.value }
                              : x,
                          ),
                        )
                      }
                    />
                  </label>
                  <label className="wide">
                    Instructions
                    <input
                      maxLength={4000}
                      value={item.instructions}
                      onChange={(e) =>
                        setItems((v) =>
                          v.map((x, i) =>
                            i === index
                              ? { ...x, instructions: e.target.value }
                              : x,
                          ),
                        )
                      }
                    />
                  </label>
                </div>
                {items.length > 1 && (
                  <button
                    className="clinical-link-button"
                    type="button"
                    onClick={() =>
                      setItems((v) => v.filter((_, i) => i !== index))
                    }
                  >
                    Remove medicine
                  </button>
                )}
              </fieldset>
            ))}
            <button
              className="clinical-link-button"
              type="button"
              onClick={() => setItems((v) => [...v, emptyItem()])}
            >
              + Add medicine
            </button>
            <label>
              Prescription notes
              <textarea
                rows={2}
                maxLength={5000}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </label>
            <div className="clinical-order-actions">
              <button type="submit" disabled={busy || !canOrder}>
                Save draft
              </button>
              {editing && (
                <button
                  type="button"
                  onClick={() => startEdit()}
                  disabled={busy}
                >
                  New draft
                </button>
              )}
            </div>
          </form>
          <div className="clinical-order-history">
            <h5>Prescription history</h5>
            {prescriptions.length === 0 ? (
              <p>No prescriptions have been created for this encounter.</p>
            ) : (
              prescriptions.map((p) => (
                <article className="clinical-order-record" key={p.id}>
                  <header>
                    <strong>Prescription v{p.revision}</strong>
                    <span
                      className={`clinical-order-badge ${p.status.toLowerCase()}`}
                    >
                      {p.status}
                    </span>
                  </header>
                  <p>
                    {p.items
                      .map(
                        (m) =>
                          `${m.medicineName} · ${m.dosage} · ${m.frequency} · ${m.duration}`,
                      )
                      .join("; ")}
                  </p>
                  {p.notes && <small>{p.notes}</small>}
                  <div className="clinical-order-actions">
                    {p.status === "DRAFT" && (
                      <>
                        <button
                          type="button"
                          disabled={busy || !canOrder}
                          onClick={() => startEdit(p)}
                        >
                          Edit draft
                        </button>
                        <button
                          type="button"
                          disabled={busy || !canOrder}
                          onClick={() =>
                            void run(
                              () => signPrescription(queueEntryId, p.id),
                              "Prescription signed.",
                            )
                          }
                        >
                          Sign
                        </button>
                      </>
                    )}
                    {p.status === "SIGNED" && (
                      <>
                        <button type="button" onClick={() => window.print()}>
                          Print
                        </button>
                        <button
                          type="button"
                          disabled={busy || !canOrder}
                          onClick={() => replace(p)}
                        >
                          Create replacement
                        </button>
                      </>
                    )}
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      )}
      {tab === "investigations" && (
        <div className="clinical-orders-content">
          <form
            className="clinical-order-form"
            onSubmit={(e) => void saveInvestigation(e)}
          >
            <h5>New investigation</h5>
            <div className="clinical-order-grid">
              <label>
                Type
                <select name="type">
                  <option value="LAB">Laboratory</option>
                  <option value="IMAGING">Diagnostic imaging</option>
                  <option value="OTHER">Other</option>
                </select>
              </label>
              <label>
                Priority
                <select name="priority">
                  <option>ROUTINE</option>
                  <option>URGENT</option>
                  <option>STAT</option>
                </select>
              </label>
              <label className="wide">
                Investigation
                <input name="name" required maxLength={180} />
              </label>
              <label className="wide">
                Clinical indication
                <textarea name="indication" maxLength={10000} rows={2} />
              </label>
            </div>
            <button type="submit" disabled={busy || !canOrder}>
              Create order
            </button>
          </form>
          <div className="clinical-order-history">
            <h5>Investigation orders</h5>
            {investigations.map((o) => (
              <article className="clinical-order-record" key={o.id}>
                <header>
                  <strong>{o.name}</strong>
                  <span className="clinical-order-badge">{o.status}</span>
                </header>
                <p>
                  {o.type} · {o.priority} ·{" "}
                  {new Date(o.orderedAt).toLocaleString()}
                </p>
                {o.indication && <small>{o.indication}</small>}
                <small>Order status only; no result is recorded.</small>
                {o.status === "ORDERED" && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void run(
                        () =>
                          setInvestigationStatus(
                            queueEntryId,
                            o.id,
                            "IN_PROGRESS",
                          ),
                        "Investigation marked in progress.",
                      )
                    }
                  >
                    Start
                  </button>
                )}
                {o.status === "IN_PROGRESS" && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void run(
                        () =>
                          setInvestigationStatus(
                            queueEntryId,
                            o.id,
                            "COMPLETED",
                          ),
                        "Investigation marked complete.",
                      )
                    }
                  >
                    Mark complete
                  </button>
                )}
              </article>
            ))}
          </div>
        </div>
      )}
      {tab === "referrals" && (
        <div className="clinical-orders-content">
          <form
            className="clinical-order-form"
            onSubmit={(e) => void saveReferral(e)}
          >
            <h5>New referral</h5>
            <div className="clinical-order-grid">
              <label>
                Specialty
                <input name="specialty" required maxLength={160} />
              </label>
              <label>
                Priority
                <select name="priority">
                  <option>ROUTINE</option>
                  <option>URGENT</option>
                  <option>STAT</option>
                </select>
              </label>
              <label className="wide">
                Provider or facility
                <input name="providerOrFacility" maxLength={200} />
              </label>
              <label className="wide">
                Clinical reason
                <textarea
                  name="clinicalReason"
                  required
                  maxLength={10000}
                  rows={3}
                />
              </label>
              <label className="wide">
                Instructions
                <textarea name="instructions" maxLength={10000} rows={2} />
              </label>
            </div>
            <button type="submit" disabled={busy || !canOrder}>
              Create referral
            </button>
          </form>
          <div className="clinical-order-history">
            <h5>Referrals</h5>
            {referrals.map((r) => (
              <article className="clinical-order-record" key={r.id}>
                <header>
                  <strong>{r.specialty}</strong>
                  <span className="clinical-order-badge">{r.status}</span>
                </header>
                <p>
                  {r.priority} ·{" "}
                  {r.providerOrFacility || "Provider not specified"}
                </p>
                <small>{r.clinicalReason}</small>
                {r.instructions && <small>{r.instructions}</small>}
                {r.status === "CREATED" && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void run(
                        () => setReferralStatus(queueEntryId, r.id, "SENT"),
                        "Referral marked sent.",
                      )
                    }
                  >
                    Mark sent
                  </button>
                )}
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
export default ClinicalOrdersPanel;
