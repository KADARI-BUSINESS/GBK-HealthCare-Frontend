import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  addConsultationAddendum,
  claimDoctorEncounter,
  getConsultation,
  getConsultationAddenda,
  getDoctorNursingIntake,
  getDoctorOpdQueue,
  getRelevantPatientHistory,
  holdDoctorConsultation,
  resumeDoctorConsultation,
  saveConsultationDraft,
  signConsultation,
  startDoctorConsultation,
  type ConsultationAddendum,
  type ConsultationDraft,
  type DoctorConsultation,
  type DoctorOpdQueueItem,
  type HistoricalVisit,
  type NursingIntake,
} from "../api/doctorOpd";
import ClinicalOrdersPanel from "./ClinicalOrdersPanel";
import "./DoctorOpdWorkspace.css";

const blankDraft: ConsultationDraft = {
  chiefComplaints: "",
  presentIllness: "",
  generalExamination: "",
  heartExamination: "",
  lungsExamination: "",
  abdomenExamination: "",
  rectalExamination: "",
  diagnosis: "",
  assessment: "",
  treatmentPlan: "",
  doctorNotes: "",
};
const waiting = (seconds: number) =>
  seconds < 60 ? "< 1 min" : `${Math.floor(seconds / 60)} min`;
const display = (value: string | number | null | undefined) =>
  value === null || value === undefined || value === ""
    ? "Not recorded"
    : String(value);

function DoctorOpdWorkspace() {
  const [queue, setQueue] = useState<DoctorOpdQueueItem[]>([]);
  const [selected, setSelected] = useState<DoctorOpdQueueItem | null>(null);
  const [consultation, setConsultation] = useState<DoctorConsultation | null>(
    null,
  );
  const [draft, setDraft] = useState<ConsultationDraft>(blankDraft);
  const [intake, setIntake] = useState<NursingIntake | null>(null);
  const [history, setHistory] = useState<HistoricalVisit[]>([]);
  const [addenda, setAddenda] = useState<ConsultationAddendum[]>([]);
  const [addendumText, setAddendumText] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pendingQueueActions, setPendingQueueActions] = useState<Set<number>>(
    new Set(),
  );
  const queueActionsInFlight = useRef(new Set<number>());
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const refresh = useCallback(async () => {
    const result = await getDoctorOpdQueue();
    setQueue(result);
    setSelected((current) =>
      current
        ? (result.find((item) => item.queueEntryId === current.queueEntryId) ??
          current)
        : null,
    );
  }, []);
  useEffect(() => {
    let alive = true;
    getDoctorOpdQueue()
      .then((items) => {
        if (alive) setQueue(items);
      })
      .catch((cause) => {
        if (alive)
          setError(
            cause instanceof Error
              ? cause.message
              : "Could not load Doctor queue.",
          );
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  async function open(item: DoctorOpdQueueItem) {
    setSelected(item);
    setError("");
    setSuccess("");
    setConsultation(null);
    setIntake(null);
    setHistory([]);
    setAddenda([]);
    setDraft(blankDraft);
    setBusy(true);
    try {
      const [consult, signedIntake, prior, amendments] = await Promise.all([
        getConsultation(item.queueEntryId),
        getDoctorNursingIntake(item.queueEntryId),
        getRelevantPatientHistory(item.queueEntryId),
        getConsultationAddenda(item.queueEntryId),
      ]);
      setConsultation(consult);
      setIntake(signedIntake);
      setHistory(prior);
      setAddenda(amendments);
      setDraft({
        chiefComplaints: consult.chiefComplaints || "",
        presentIllness: consult.presentIllness || "",
        generalExamination: consult.generalExamination || "",
        heartExamination: consult.heartExamination || "",
        lungsExamination: consult.lungsExamination || "",
        abdomenExamination: consult.abdomenExamination || "",
        rectalExamination: consult.rectalExamination || "",
        diagnosis: consult.diagnosis || "",
        assessment: consult.assessment || "",
        treatmentPlan: consult.treatmentPlan || "",
        doctorNotes: consult.doctorNotes || "",
      });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not load this encounter workspace.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function action(
    queueEntryId: number,
    run: (id: number) => Promise<DoctorOpdQueueItem>,
    done: string,
  ) {
    if (!Number.isSafeInteger(queueEntryId) || queueEntryId < 1) {
      setError("This encounter has an invalid queue ID. Refresh the queue and try again.");
      setSuccess("");
      return;
    }
    if (queueActionsInFlight.current.has(queueEntryId)) return;

    queueActionsInFlight.current.add(queueEntryId);
    setPendingQueueActions((current) => new Set(current).add(queueEntryId));
    setError("");
    setSuccess("");
    try {
      const updated = await run(queueEntryId);
      setQueue((current) =>
        current.map((item) =>
          item.queueEntryId === queueEntryId ? updated : item,
        ),
      );
      setSelected((current) =>
        current?.queueEntryId === queueEntryId ? updated : current,
      );
      setSuccess(done);
      await refresh();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Encounter update failed.",
      );
      await refresh().catch(() => undefined);
    } finally {
      queueActionsInFlight.current.delete(queueEntryId);
      setPendingQueueActions((current) => {
        const next = new Set(current);
        next.delete(queueEntryId);
        return next;
      });
    }
  }
  async function saveDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const saved = await saveConsultationDraft(selected.queueEntryId, draft);
      setConsultation(saved);
      setSuccess("Consultation draft saved.");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not save draft.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function sign() {
    if (
      !selected ||
      !window.confirm(
        "Sign this consultation? The signed clinical record cannot be edited; corrections must be added as an addendum.",
      )
    )
      return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const signed = await signConsultation(selected.queueEntryId);
      setConsultation(signed);
      setSuccess(
        selected.encounterType === "FOLLOW_UP"
          ? "Consultation signed; the linked follow-up is complete and the encounter is ready for checkout."
          : "Consultation signed and marked ready for checkout.",
      );
      await refresh();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not sign consultation.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function submitAddendum(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !addendumText.trim()) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const saved = await addConsultationAddendum(
        selected.queueEntryId,
        addendumText.trim(),
      );
      setAddenda((current) => [...current, saved]);
      setAddendumText("");
      setSuccess("Auditable addendum recorded.");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not save addendum.",
      );
    } finally {
      setBusy(false);
    }
  }
  function updateDraft(key: keyof ConsultationDraft, value: string) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  return (
    <section className="doctor-opd" aria-labelledby="doctor-opd-title">
      <div className="doctor-opd-intro">
        <div>
          <span className="doctor-opd-eyebrow">
            OUTPATIENT CLINICAL WORKSPACE
          </span>
          <h2 id="doctor-opd-title">Consultation queue</h2>
          <p>
            Encounters handed off by nursing and assigned to your Doctor
            account.
          </p>
        </div>
        <button
          type="button"
          className="button-secondary"
          onClick={() => {
            setError("");
            void refresh().catch((cause) =>
              setError(
                cause instanceof Error
                  ? cause.message
                  : "Queue refresh failed.",
              ),
            );
          }}
        >
          ↻ Refresh queue
        </button>
      </div>
      {error && (
        <p className="doctor-opd-error" role="alert">
          {error}
        </p>
      )}
      {success && (
        <p className="doctor-opd-success" role="status">
          {success}
        </p>
      )}
      <div className="doctor-opd-layout">
        <section
          className="doctor-opd-queue"
          aria-label="Assigned Doctor queue"
        >
          <header>
            <h3>Assigned encounters</h3>
            <span>{queue.length}</span>
          </header>
          {loading ? (
            <p className="doctor-opd-state" role="status">
              Loading your queue…
            </p>
          ) : queue.length === 0 ? (
            <p className="doctor-opd-state">
              No encounters have been handed off to you.
            </p>
          ) : (
            <div className="doctor-opd-queue-list">
              {queue.map((item) => (
                <article
                  key={item.queueEntryId}
                  className={`${item.emergencyPriority ? "is-emergency" : ""}${selected?.queueEntryId === item.queueEntryId ? " is-selected" : ""}`}
                >
                  <div className="doctor-opd-card-top">
                    <strong>{item.patientName}</strong>
                    {item.emergencyPriority && (
                      <span className="doctor-opd-priority">Emergency</span>
                    )}
                  </div>
                  <small>
                    Patient #{item.patientId} · {item.patientAge} yrs ·{" "}
                    {item.patientGender} · {item.patientMobile}
                  </small>
                  <small>
                    Checked in{" "}
                    {new Date(item.checkedInAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    · waiting {waiting(item.waitingSeconds)}
                  </small>
                  <span
                    className={`doctor-opd-status ${item.status.toLowerCase().replaceAll("_", "-")}`}
                  >
                    {item.status.replaceAll("_", " ")}
                  </span>
                  <div className="doctor-opd-card-actions">
                    {item.status === "WAITING" && (
                      <button
                        type="button"
                        disabled={pendingQueueActions.has(item.queueEntryId)}
                        onClick={() =>
                          void action(
                            item.queueEntryId,
                            claimDoctorEncounter,
                            "Encounter claimed.",
                          )
                        }
                      >
                        {pendingQueueActions.has(item.queueEntryId)
                          ? "Claiming…"
                          : "Claim"}
                      </button>
                    )}
                    {item.status === "CLAIMED" && (
                      <button
                        type="button"
                        disabled={pendingQueueActions.has(item.queueEntryId)}
                        onClick={() =>
                          void action(
                            item.queueEntryId,
                            startDoctorConsultation,
                            "Consultation started.",
                          )
                        }
                      >
                        Start consultation
                      </button>
                    )}
                    {item.status === "IN_CONSULTATION" && (
                      <button
                        type="button"
                        disabled={pendingQueueActions.has(item.queueEntryId)}
                        onClick={() =>
                          void action(
                            item.queueEntryId,
                            holdDoctorConsultation,
                            "Consultation placed on hold.",
                          )
                        }
                      >
                        On hold
                      </button>
                    )}
                    {item.status === "ON_HOLD" && (
                      <button
                        type="button"
                        disabled={pendingQueueActions.has(item.queueEntryId)}
                        onClick={() =>
                          void action(
                            item.queueEntryId,
                            resumeDoctorConsultation,
                            "Consultation resumed.",
                          )
                        }
                      >
                        Resume
                      </button>
                    )}
                    <button
                      type="button"
                      className="open-workspace"
                      disabled={busy}
                      onClick={() => void open(item)}
                    >
                      {item.status === "CONSULTATION_SIGNED"
                        ? "View signed record"
                        : "Open workspace"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
        <section
          className="doctor-opd-workspace"
          aria-label="Encounter workspace"
        >
          {!selected ? (
            <div className="doctor-opd-state doctor-opd-prompt">
              <strong>Select an assigned encounter</strong>
              <p>
                Claim an encounter, then start the consultation to edit clinical
                notes.
              </p>
            </div>
          ) : (
            <>
              <header className="doctor-opd-workspace-header">
                <div>
                  <span className="doctor-opd-eyebrow">
                    PATIENT #{selected.patientId} · ENCOUNTER #
                    {selected.patientVisitId}
                  </span>
                  <h3>{selected.patientName}</h3>
                  <p>
                    {selected.patientAge} yrs · {selected.patientGender} ·{" "}
                    {selected.patientMobile}
                  </p>
                </div>
                {selected.emergencyPriority && (
                  <span className="doctor-opd-priority">
                    Emergency priority
                  </span>
                )}
              </header>
              {selected.encounterType === "FOLLOW_UP" && (
                <aside className="doctor-opd-follow-up-context" role="status">
                  <strong>Follow-up #{selected.followUpId}</strong>
                  <span>
                    Scheduled {selected.followUpDate || "date unavailable"} ·{" "}
                    {selected.followUpStatus || "SCHEDULED"}
                  </span>
                  <small>
                    Reception check-in keeps the appointment scheduled. It moves
                    to in progress when you start this consultation and
                    completes when you sign.
                  </small>
                </aside>
              )}
              {selected.emergencyNote && (
                <p className="doctor-opd-emergency-note">
                  Reception note: {selected.emergencyNote}
                </p>
              )}
              <details className="doctor-opd-panel" open>
                <summary>Nursing handoff</summary>
                {intake ? (
                  <>
                    <p className="doctor-opd-nurse-meta">
                      Nurse {intake.nurseName} (Staff #{intake.nurseStaffId}) ·
                      handed off {new Date(intake.handoffAt).toLocaleString()}
                    </p>
                    <div className="doctor-opd-vitals">
                      <span>
                        Blood pressure
                        <strong>
                          {display(intake.intake.bpSystolic)}/
                          {display(intake.intake.bpDiastolic)} mmHg
                        </strong>
                      </span>
                      <span>
                        Pulse
                        <strong>{display(intake.intake.pulseRate)} bpm</strong>
                      </span>
                      <span>
                        Temperature
                        <strong>
                          {display(intake.intake.temperatureC)} °C
                        </strong>
                      </span>
                      <span>
                        Respiratory
                        <strong>
                          {display(intake.intake.respiratoryRate)} /min
                        </strong>
                      </span>
                      <span>
                        SpO₂
                        <strong>
                          {display(intake.intake.oxygenSaturation)}%
                        </strong>
                      </span>
                      <span>
                        Height / weight
                        <strong>
                          {display(intake.intake.heightCm)} cm /{" "}
                          {display(intake.intake.weightKg)} kg
                        </strong>
                      </span>
                      <span>
                        BMI<strong>{display(intake.intake.bmi)}</strong>
                      </span>
                    </div>
                    <div className="doctor-opd-clinical-text">
                      <h4>Allergies</h4>
                      <p>{display(intake.intake.allergies)}</p>
                      <h4>Medication reconciliation</h4>
                      <p>{display(intake.intake.medicationReconciliation)}</p>
                      <h4>Nursing notes</h4>
                      <p>{display(intake.intake.nursingNotes)}</p>
                    </div>
                  </>
                ) : (
                  <p role="status">Loading signed nursing handoff…</p>
                )}
              </details>
              <details className="doctor-opd-panel">
                <summary>
                  Relevant patient history (up to 20 prior clinical visits)
                </summary>
                {history.length === 0 ? (
                  <p>No prior clinical history was found for this patient.</p>
                ) : (
                  history.map((item) => (
                    <article
                      className="doctor-opd-history-item"
                      key={item.visitId}
                    >
                      <strong>{item.visitDate || "Prior visit"}</strong>
                      {item.chiefComplaints && (
                        <p>
                          <b>Complaints:</b> {item.chiefComplaints}
                        </p>
                      )}
                      {item.presentIllness && (
                        <p>
                          <b>History:</b> {item.presentIllness}
                        </p>
                      )}
                      {item.diagnosis && (
                        <p>
                          <b>Diagnosis:</b> {item.diagnosis}
                        </p>
                      )}
                      {item.treatmentPlan && (
                        <p>
                          <b>Plan:</b> {item.treatmentPlan}
                        </p>
                      )}
                      {(item.temperatureC ||
                        item.pulseRate ||
                        item.oxygenSaturation ||
                        item.bpSystolic) && (
                        <p>
                          <b>Vitals:</b> {item.temperatureC ?? "—"} °C ·{" "}
                          {item.pulseRate ?? "—"} bpm · SpO₂{" "}
                          {item.oxygenSaturation ?? "—"}% · BP{" "}
                          {item.bpSystolic ?? "—"}/{item.bpDiastolic ?? "—"}
                        </p>
                      )}
                    </article>
                  ))
                )}
              </details>
              <section className="doctor-opd-panel consultation-form-panel">
                <header>
                  <div>
                    <span className="doctor-opd-eyebrow">CONSULTATION</span>
                    <h4>Clinical record</h4>
                  </div>
                  <span
                    className={`doctor-opd-status ${(consultation?.consultationStatus || "draft").toLowerCase()}`}
                  >
                    {consultation?.consultationStatus || "DRAFT"}
                  </span>
                </header>
                {!consultation ? (
                  <p role="status">Loading consultation…</p>
                ) : consultation.consultationStatus === "SIGNED" ? (
                  <>
                    <div className="doctor-opd-signed-grid">
                      {(
                        [
                          [
                            "Presenting complaints",
                            consultation.chiefComplaints,
                          ],
                          [
                            "History of present illness",
                            consultation.presentIllness,
                          ],
                          [
                            "General examination",
                            consultation.generalExamination,
                          ],
                          ["Heart examination", consultation.heartExamination],
                          ["Lungs examination", consultation.lungsExamination],
                          [
                            "Abdomen examination",
                            consultation.abdomenExamination,
                          ],
                          [
                            "Rectal examination",
                            consultation.rectalExamination,
                          ],
                          ["Diagnosis", consultation.diagnosis],
                          ["Assessment", consultation.assessment],
                          ["Treatment plan", consultation.treatmentPlan],
                          ["Doctor notes", consultation.doctorNotes],
                        ] as const
                      ).map(([label, value]) => (
                        <div key={label}>
                          <strong>{label}</strong>
                          <p>{display(value)}</p>
                        </div>
                      ))}
                    </div>
                    <p className="doctor-opd-nurse-meta">
                      Signed{" "}
                      {consultation.signedAt
                        ? new Date(consultation.signedAt).toLocaleString()
                        : ""}
                      . The signed record is read-only.
                    </p>
                    <div className="doctor-opd-addenda">
                      <h4>Auditable addenda</h4>
                      {addenda.map((item) => (
                        <article key={item.id}>
                          <small>
                            {new Date(item.createdAt).toLocaleString()} · Doctor
                            #{item.doctorId}
                          </small>
                          <p>{item.text}</p>
                        </article>
                      ))}
                      <form onSubmit={(event) => void submitAddendum(event)}>
                        <label>
                          Add a correction or clarification
                          <textarea
                            value={addendumText}
                            onChange={(event) =>
                              setAddendumText(event.target.value)
                            }
                            maxLength={20000}
                            rows={3}
                            required
                          />
                        </label>
                        <button
                          type="submit"
                          disabled={busy || !addendumText.trim()}
                        >
                          Addendum
                        </button>
                      </form>
                    </div>
                  </>
                ) : (
                  <form onSubmit={(event) => void saveDraft(event)}>
                    <div className="doctor-opd-form-grid">
                      {(
                        [
                          ["chiefComplaints", "Presenting complaints"],
                          ["presentIllness", "History of present illness"],
                          ["generalExamination", "General examination"],
                          ["heartExamination", "Heart examination"],
                          ["lungsExamination", "Lungs examination"],
                          ["abdomenExamination", "Abdomen examination"],
                          ["rectalExamination", "Rectal examination"],
                          ["diagnosis", "Diagnosis"],
                          ["assessment", "Assessment"],
                          ["treatmentPlan", "Treatment plan"],
                          ["doctorNotes", "Doctor notes"],
                        ] as const
                      ).map(([key, label]) => (
                        <label key={key}>
                          {label}
                          <textarea
                            rows={
                              key === "chiefComplaints" || key === "diagnosis"
                                ? 2
                                : 3
                            }
                            maxLength={20000}
                            value={draft[key]}
                            onChange={(event) =>
                              updateDraft(key, event.target.value)
                            }
                            disabled={
                              busy ||
                              !["IN_CONSULTATION", "ON_HOLD"].includes(
                                selected.status,
                              )
                            }
                          />
                        </label>
                      ))}
                    </div>
                    <div className="doctor-opd-form-actions">
                      <button
                        type="submit"
                        className="button-secondary"
                        disabled={
                          busy ||
                          !["IN_CONSULTATION", "ON_HOLD"].includes(
                            selected.status,
                          )
                        }
                      >
                        Save draft
                      </button>
                      <button
                        type="button"
                        className="button-primary"
                        onClick={() => void sign()}
                        disabled={
                          busy ||
                          selected.status !== "IN_CONSULTATION" ||
                          !draft.diagnosis.trim()
                        }
                      >
                        Sign consultation
                      </button>
                    </div>
                  </form>
                )}
              </section>
              <section className="doctor-opd-panel">
                <ClinicalOrdersPanel
                  key={selected.queueEntryId}
                  queueEntryId={selected.queueEntryId}
                  encounterStatus={selected.status}
                />
              </section>
            </>
          )}
        </section>
      </div>
    </section>
  );
}
export default DoctorOpdWorkspace;
