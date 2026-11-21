import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { claimNursingEncounter, getNursingIntakes, getNursingQueue, handoffNursingEncounter, releaseNursingClaim, saveNursingIntake, type NursingIntake, type NursingIntakeDraft, type NursingQueueItem } from "../../api/nursing";
import ConfirmDialog from "../common/ConfirmDialog";

const emptyDraft = (): NursingIntakeDraft => ({ bpSystolic: null, bpDiastolic: null, pulseRate: null, temperatureC: null, respiratoryRate: null, oxygenSaturation: null, heightCm: null, weightKg: null, allergies: "", medicationReconciliation: "", nursingNotes: "" });
function draftFromIntake(record: NursingIntake): NursingIntakeDraft {
  return {
    bpSystolic: record.bpSystolic,
    bpDiastolic: record.bpDiastolic,
    pulseRate: record.pulseRate,
    temperatureC: record.temperatureC,
    respiratoryRate: record.respiratoryRate,
    oxygenSaturation: record.oxygenSaturation,
    heightCm: record.heightCm,
    weightKg: record.weightKg,
    allergies: record.allergies ?? "",
    medicationReconciliation: record.medicationReconciliation ?? "",
    nursingNotes: record.nursingNotes ?? "",
  };
}
function draftFromHistory(records: NursingIntake[]): NursingIntakeDraft {
  const latest = records[records.length - 1];
  return latest?.recordState === "DRAFT" ? draftFromIntake(latest) : emptyDraft();
}
const minutes = (seconds: number) => seconds < 60 ? "< 1 min" : `${Math.floor(seconds / 60)} min`;
function NursingWorkspace({ staffId }: { staffId: number }) {
  const [queue, setQueue] = useState<NursingQueueItem[]>([]); const [selected, setSelected] = useState<NursingQueueItem | null>(null);
  const [history, setHistory] = useState<NursingIntake[]>([]); const [draft, setDraft] = useState<NursingIntakeDraft>(emptyDraft());
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [handoffDialogOpen, setHandoffDialogOpen] = useState(false);
  const [releaseDialogOpen, setReleaseDialogOpen] = useState(false);
  const handoffInFlight = useRef(false);
  const releaseInFlight = useRef(false);
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [success, setSuccess] = useState("");
  const refresh = useCallback(async () => { const result = await getNursingQueue(); setQueue(result); setSelected((current) => current ? result.find((item) => item.queueEntryId === current.queueEntryId) ?? null : null); }, []);
  useEffect(() => { let alive = true; getNursingQueue().then((items) => { if (alive) setQueue(items); }).catch((cause) => { if (alive) setError(cause instanceof Error ? cause.message : "Could not load nursing queue."); }).finally(() => { if (alive) setLoading(false); }); return () => { alive = false; }; }, []);
  const bmi = useMemo(() => { const h = Number(draft.heightCm); const w = Number(draft.weightKg); return h > 0 && w > 0 ? (w / ((h / 100) ** 2)).toFixed(1) : "—"; }, [draft.heightCm, draft.weightKg]);

  async function claim(item: NursingQueueItem) { setBusy(true); setError(""); setSuccess(""); setHistoryLoaded(false); try { const claimed = await claimNursingEncounter(item.queueEntryId); const records = await getNursingIntakes(item.queueEntryId); setSelected(claimed); setHistory(records); setDraft(draftFromHistory(records)); setHistoryLoaded(true); await refresh(); } catch (cause) { setSelected(null); setHistory([]); setDraft(emptyDraft()); setError(cause instanceof Error ? cause.message : "Could not claim or load the encounter intake."); await refresh().catch(() => undefined); } finally { setBusy(false); } }
  async function selectClaimed(item: NursingQueueItem) { setSelected(item); setHistory([]); setHistoryLoaded(false); setError(""); setSuccess(""); setBusy(true); try { const records = await getNursingIntakes(item.queueEntryId); setHistory(records); setDraft(draftFromHistory(records)); setHistoryLoaded(true); } catch (cause) { setSelected(null); setHistory([]); setError(cause instanceof Error ? cause.message : "Could not load intake history."); } finally { setBusy(false); } }
  type NumericField = "bpSystolic" | "bpDiastolic" | "pulseRate" | "temperatureC" | "respiratoryRate" | "oxygenSaturation" | "heightCm" | "weightKg";
  function changeNumber(key: NumericField, raw: string) { setDraft((current) => ({ ...current, [key]: raw === "" ? null : Number(raw) })); }
  const latestRecord = history[history.length - 1];
  const canEditIntake = Boolean(selected && historyLoaded && selected.status === "CLAIMED"
    && (!latestRecord || latestRecord.recordState === "DRAFT"));
  const canReleaseClaim = Boolean(selected && historyLoaded && selected.status === "CLAIMED"
    && selected.claimedByStaffId === staffId);
  const hasUnsavedIntakeChanges = historyLoaded
    && JSON.stringify(draft) !== JSON.stringify(draftFromHistory(history));
  async function save(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!selected || !canEditIntake) return; setBusy(true); setError(""); setSuccess(""); try { const record = await saveNursingIntake(selected.queueEntryId, draft); setHistory((current) => [...current, record]); setDraft(draftFromIntake(record)); setSuccess(`Intake revision ${record.revision} saved.`); } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save intake."); } finally { setBusy(false); } }
  function openHandoffDialog() { if (!selected || !canEditIntake || busy) return; setError(""); setHandoffDialogOpen(true); }
  function openReleaseDialog() { if (!canReleaseClaim || busy) return; setError(""); setReleaseDialogOpen(true); }
  async function releaseClaim() {
    if (!selected || !canReleaseClaim || busy || hasUnsavedIntakeChanges || releaseInFlight.current) return;
    releaseInFlight.current = true;
    setBusy(true); setError(""); setSuccess("");
    try {
      const released = await releaseNursingClaim(selected.queueEntryId);
      setQueue((current) => current.map((item) => item.queueEntryId === released.queueEntryId ? released : item));
      setReleaseDialogOpen(false);
      setSelected(null); setHistory([]); setHistoryLoaded(false); setDraft(emptyDraft());
      setSuccess("Claim released. Saved nursing intake revisions have been preserved.");
      try {
        await refresh();
      } catch (cause) {
        setError(cause instanceof Error ? `Claim released, but the queue could not refresh: ${cause.message}` : "Claim released, but the queue could not refresh.");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not release the nursing claim.");
    } finally {
      releaseInFlight.current = false;
      setBusy(false);
    }
  }
  async function handoff() {
    if (!selected || !canEditIntake || busy || handoffInFlight.current) return;
    handoffInFlight.current = true;
    setBusy(true); setError(""); setSuccess("");
    try {
      await handoffNursingEncounter(selected.queueEntryId);
      setSuccess(`Encounter sent to ${selected.assignedDoctorName}'s queue.`);
      setHandoffDialogOpen(false);
      setSelected(null); setHistory([]); setHistoryLoaded(false); setDraft(emptyDraft());
      try {
        await refresh();
      } catch (cause) {
        setError(cause instanceof Error ? `Handoff completed, but the queue could not refresh: ${cause.message}` : "Handoff completed, but the queue could not refresh.");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not hand off encounter.");
    } finally {
      handoffInFlight.current = false;
      setBusy(false);
    }
  }

  return <section className="nursing-workspace" aria-labelledby="nursing-title">
    <div className="nursing-intro"><div><span className="staff-eyebrow">SHARED CLINICAL INTAKE</span><h2 id="nursing-title">Nursing queue</h2><p>Claim an encounter, record the intake, and hand it to the assigned Doctor.</p></div><button type="button" onClick={() => { setError(""); void refresh().catch((cause) => setError(cause instanceof Error ? cause.message : "Queue refresh failed.")); }} disabled={busy}>↻ Refresh</button></div>
    <div className="nursing-summary"><article><span>Active encounters</span><strong>{queue.length}</strong></article><article className="urgent"><span>Emergency priority</span><strong>{queue.filter((q) => q.emergencyPriority).length}</strong></article></div>
    {error && <p className="staff-inline-error" role="alert">{error}</p>}{success && <p className="nursing-success" role="status">{success}</p>}
    <div className="nursing-layout"><section className="nursing-queue-panel" aria-label="Shared nursing queue"><header><h3>Waiting for nursing</h3><span>{queue.length} active</span></header>
      {loading ? <p className="nursing-state">Loading shared queue…</p> : queue.length === 0 ? <p className="nursing-state">No encounters are waiting for nursing.</p> : <div className="nursing-queue-list">{queue.map((item) => <article key={item.queueEntryId} className={`${item.emergencyPriority ? "is-emergency" : ""}${selected?.queueEntryId === item.queueEntryId ? " is-selected" : ""}`}><div className="nursing-queue-top"><strong>{item.patientName}</strong>{item.emergencyPriority && <span className="nursing-priority">Emergency</span>}</div><small>Patient #{item.patientId} · {item.patientAge} yrs · {item.patientGender} · {item.patientMobile}</small><small>Doctor: {item.assignedDoctorName}</small><small>Checked in {new Date(item.checkedInAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · waiting {minutes(item.waitingSeconds)}</small>{item.emergencyNote && <p className="nursing-emergency-note">{item.emergencyNote}</p>}
        {item.status === "WAITING" ? <button type="button" disabled={busy} onClick={() => void claim(item)}>Claim encounter</button> : item.status === "CLAIMED" && item.claimedByStaffId === staffId ? <button type="button" disabled={busy || selected?.queueEntryId === item.queueEntryId} onClick={() => void selectClaimed(item)}>Open intake</button> : item.status === "CLAIMED" ? <span className="nursing-handoff-label">Claimed by another nurse</span> : <span className="nursing-handoff-label">Handed off</span>}</article>)}</div>}
    </section>
    <section className="nursing-intake-panel" aria-label="Nursing intake form">{!selected ? <div className="nursing-state nursing-select-prompt"><span aria-hidden="true">✚</span><strong>Select a claimed encounter</strong><p>Claim a waiting patient to begin clinical intake.</p></div> : <><header><div><span className="staff-eyebrow">PATIENT #{selected.patientId}</span><h3>{selected.patientName}</h3><p>Assigned Doctor: {selected.assignedDoctorName}</p></div>{selected.emergencyPriority && <span className="nursing-priority">Emergency priority</span>}</header>
      {!historyLoaded ? <p className="nursing-state" role="status">Loading saved intake…</p> : !canEditIntake ? <p className="nursing-state" role="status">This intake has been handed off and is read-only.</p> : <form onSubmit={(event) => void save(event)}>
        <h4>Vital signs</h4><div className="nursing-vitals-grid">
        {([ ["bpSystolic", "Systolic BP", 40, 300], ["bpDiastolic", "Diastolic BP", 20, 200], ["pulseRate", "Pulse (bpm)", 20, 250], ["temperatureC", "Temperature (°C)", 25, 45], ["respiratoryRate", "Respiratory rate", 4, 80], ["oxygenSaturation", "Oxygen saturation (%)", 1, 100], ["heightCm", "Height (cm)", 20, 250], ["weightKg", "Weight (kg)", 0.5, 500] ] as const).map(([key, label, min, max]) => <label key={key}>{label}<input type="number" min={min} max={max} step={key === "temperatureC" || key === "heightCm" || key === "weightKg" ? "0.1" : "1"} value={draft[key] ?? ""} onChange={(event) => changeNumber(key, event.target.value)} /></label>)}
      </div><p className="nursing-bmi">Calculated BMI <strong>{bmi}</strong></p><label className="nursing-textarea">Allergies<textarea value={draft.allergies} onChange={(event) => setDraft((current) => ({ ...current, allergies: event.target.value }))} maxLength={10000} rows={2} /></label><label className="nursing-textarea">Medication reconciliation<textarea value={draft.medicationReconciliation} onChange={(event) => setDraft((current) => ({ ...current, medicationReconciliation: event.target.value }))} maxLength={10000} rows={2} /></label><label className="nursing-textarea">Nursing notes<textarea value={draft.nursingNotes} onChange={(event) => setDraft((current) => ({ ...current, nursingNotes: event.target.value }))} maxLength={10000} rows={3} /></label>
        <div className="nursing-form-actions">
          {canReleaseClaim && <button type="button" disabled={busy || hasUnsavedIntakeChanges} onClick={openReleaseDialog}>Release claim</button>}
          <button type="submit" disabled={busy}>{busy ? "Saving…" : "Save intake"}</button>
          <button type="button" className="handoff" disabled={busy || history.length === 0} onClick={openHandoffDialog}>Complete &amp; hand off</button>
        </div>
        {hasUnsavedIntakeChanges && <p className="nursing-state" role="status">Save the current intake draft before releasing this claim.</p>}
      </form>}{history.length > 0 && <div className="nursing-history"><strong>Saved intake history</strong>{history.map((record) => <span key={record.recordId}>Revision {record.revision} · {record.recordState} · {new Date(record.recordedAt).toLocaleString()}</span>)}</div>}</>}</section></div>
    <ConfirmDialog
      open={handoffDialogOpen && Boolean(selected)}
      title="Complete nursing intake?"
      description="You are about to complete the nursing intake for this patient and send the encounter to the assigned doctor."
      cancelLabel="Cancel"
      confirmLabel="Confirm handoff →"
      busy={busy}
      busyLabel="Processing handoff…"
      onCancel={() => { setHandoffDialogOpen(false); setError(""); }}
      onConfirm={() => void handoff()}
    >
      {selected && <div className="confirm-dialog__details">
        <div className="confirm-dialog__detail"><span>Patient name</span><strong>{selected.patientName}</strong></div>
        <div className="confirm-dialog__detail"><span>Patient ID</span><strong>#{selected.patientId}</strong></div>
        <div className="confirm-dialog__detail"><span>Assigned doctor</span><strong>{selected.assignedDoctorName}</strong></div>
        <div className="confirm-dialog__detail"><span>Destination</span><strong>Doctor queue</strong></div>
        {error && <p className="confirm-dialog__error" role="alert">{error}</p>}
      </div>}
    </ConfirmDialog>
    <ConfirmDialog
      open={releaseDialogOpen && Boolean(selected)}
      title="Release nursing claim?"
      description="This returns the encounter to the shared nursing queue. Saved intake revisions will remain available to the next nurse."
      cancelLabel="Keep claim"
      confirmLabel="Release claim"
      busy={busy}
      busyLabel="Releasing claim…"
      onCancel={() => { setReleaseDialogOpen(false); setError(""); }}
      onConfirm={() => void releaseClaim()}
    >
      {selected && <div className="confirm-dialog__details">
        <div className="confirm-dialog__detail"><span>Patient name</span><strong>{selected.patientName}</strong></div>
        <div className="confirm-dialog__detail"><span>Patient ID</span><strong>#{selected.patientId}</strong></div>
        <div className="confirm-dialog__detail"><span>Intake data</span><strong>Saved revisions preserved</strong></div>
        {error && <p className="confirm-dialog__error" role="alert">{error}</p>}
      </div>}
    </ConfirmDialog>
  </section>;
}
export default NursingWorkspace;
