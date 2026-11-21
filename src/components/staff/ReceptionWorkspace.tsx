import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  createReceptionCheckIn,
  cancelReceptionFollowUp,
  getReceptionDoctors,
  getReceptionQueueSummary,
  getReceptionFollowUps,
  getScheduledFollowUps,
  searchReceptionPatients,
  markReceptionFollowUpMissed,
  type CheckInResult,
  type NewPatientDraft,
  type ReceptionDoctor,
  type ReceptionFollowUp,
  type ReceptionFollowUpLifecycle,
  type ReceptionPatient,
  type ReceptionQueueSummary,
} from "../../api/reception";

const today = () => {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(now);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
};
const makeKey = () => crypto.randomUUID();

function ReceptionWorkspace() {
  const [doctors, setDoctors] = useState<ReceptionDoctor[]>([]);
  const [queue, setQueue] = useState<ReceptionQueueSummary>({ waitingForNursing: 0, emergencyWaiting: 0 });
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<ReceptionPatient[]>([]);
  const [selected, setSelected] = useState<ReceptionPatient | null>(null);
  const [newPatientMode, setNewPatientMode] = useState(false);
  const [visitType, setVisitType] = useState<"NEW" | "FOLLOW_UP">("NEW");
  const [followUps, setFollowUps] = useState<ReceptionFollowUp[]>([]);
  const [followUpId, setFollowUpId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [emergencyPriority, setEmergencyPriority] = useState(false);
  const [emergencyNote, setEmergencyNote] = useState("");
  const [draft, setDraft] = useState<NewPatientDraft>({ fullName: "", age: 0, gender: "Male", visitDate: today(), phone: "", email: "" });
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<CheckInResult | null>(null);
  const [requestKey, setRequestKey] = useState(makeKey);
  const [lifecycleRows, setLifecycleRows] = useState<ReceptionFollowUpLifecycle[]>([]);
  const [lifecycleFilter, setLifecycleFilter] = useState("");
  const [lifecycleLoading, setLifecycleLoading] = useState(false);
  const [lifecycleSuccess, setLifecycleSuccess] = useState("");

  const refreshQueue = useCallback(async () => setQueue(await getReceptionQueueSummary()), []);
  const refreshLifecycle = useCallback(async () => {
    setLifecycleLoading(true);
    try { setLifecycleRows(await getReceptionFollowUps(lifecycleFilter || undefined)); }
    finally { setLifecycleLoading(false); }
  }, [lifecycleFilter]);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([getReceptionDoctors(), getReceptionQueueSummary()])
      .then(([doctorOptions, summary]) => {
        if (!alive) return;
        setDoctors(doctorOptions); setQueue(summary);
        if (doctorOptions.length) setDoctorId(String(doctorOptions[0].doctorId));
      })
      .catch((cause) => { if (alive) setError(cause instanceof Error ? cause.message : "Could not load Reception workspace."); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  useEffect(() => { void refreshLifecycle().catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load follow-up lifecycle.")); }, [refreshLifecycle]);

  async function updateLifecycle(row: ReceptionFollowUpLifecycle, action: "cancel" | "missed") {
    const label = action === "cancel" ? "cancel" : "mark as missed";
    if (!window.confirm(`Are you sure you want to ${label} this follow-up?`)) return;
    const reason = window.prompt(`Reason to ${label}:`);
    if (!reason?.trim()) return;
    setError(""); setLifecycleSuccess("");
    try {
      if (action === "cancel") await cancelReceptionFollowUp(row.followUpId, reason.trim());
      else await markReceptionFollowUpMissed(row.followUpId, reason.trim());
      await refreshLifecycle();
      setLifecycleSuccess(`Follow-up ${action === "cancel" ? "cancelled" : "marked missed"}.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : `Could not ${label} follow-up.`); }
  }

  useEffect(() => {
    let alive = true;
    if (!selected || visitType !== "FOLLOW_UP") { setFollowUps([]); setFollowUpId(""); return; }
    getScheduledFollowUps(selected.patientId).then((items) => {
      if (alive) { setFollowUps(items); setFollowUpId(items[0] ? String(items[0].followUpId) : ""); }
    }).catch((cause) => { if (alive) setError(cause instanceof Error ? cause.message : "Could not load scheduled follow-ups."); });
    return () => { alive = false; };
  }, [selected, visitType]);

  async function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setSuccess(null); setSearching(true); setSelected(null); setNewPatientMode(false);
    try { setResults(await searchReceptionPatients(search.trim())); }
    catch (cause) { setResults([]); setError(cause instanceof Error ? cause.message : "Patient search failed."); }
    finally { setSearching(false); }
  }

  function startNewPatient() {
    setSelected(null); setNewPatientMode(true); setVisitType("NEW"); setFollowUpId(""); setSuccess(null); setError("");
    setDraft({ fullName: "", age: 0, gender: "Male", visitDate: today(), phone: "", email: "" }); setRequestKey(makeKey());
  }

  async function submitCheckIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!doctorId || (!selected && !newPatientMode)) return;
    setSubmitting(true); setError(""); setSuccess(null);
    try {
      const result = await createReceptionCheckIn({
        encounterType: visitType, assignedDoctorId: Number(doctorId), requestKey,
        ...(selected ? { patientId: selected.patientId } : { newPatient: { ...draft, age: Number(draft.age), email: draft.email?.trim() || undefined } }),
        ...(visitType === "FOLLOW_UP" && followUpId ? { followUpId: Number(followUpId) } : {}),
        emergencyPriority, emergencyNote: emergencyPriority ? emergencyNote.trim() || undefined : undefined,
      });
      setSuccess(result); setSelected(null); setNewPatientMode(false); setResults([]); setSearch(""); setVisitType("NEW"); setEmergencyPriority(false); setEmergencyNote(""); setRequestKey(makeKey());
      await refreshQueue();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Patient check-in failed."); }
    finally { setSubmitting(false); }
  }

  function updateDraft<K extends keyof NewPatientDraft>(key: K, value: NewPatientDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value })); setRequestKey(makeKey());
  }

  return <section className="reception-workspace" aria-labelledby="reception-title">
    <div className="reception-intro"><div><span className="staff-eyebrow">RECEPTION DESK</span><h2 id="reception-title">Patient check-in</h2><p>Find the patient, confirm today’s visit and route them to nursing.</p></div><div className="reception-intro-icon" aria-hidden="true">⌕</div></div>
    <div className="reception-queue-cards" aria-label="Nursing queue summary">
      <article><span>Waiting for nursing</span><strong>{loading ? "—" : queue.waitingForNursing}</strong><small>Checked in today</small></article>
      <article className="is-urgent"><span>Emergency priority</span><strong>{loading ? "—" : queue.emergencyWaiting}</strong><small>Waiting for nursing</small></article>
      <button type="button" onClick={() => void refreshQueue().catch((cause) => setError(cause instanceof Error ? cause.message : "Queue refresh failed."))}>↻<span>Refresh queue</span></button>
    </div>

    {error && <p className="staff-inline-error" role="alert">{error}</p>}
    {success && <div className="reception-success" role="status"><strong>Check-in complete</strong><span>{success.patientName} · Visit #{success.visitNumber} · {success.assignedDoctorName}</span><small>Added to the nursing queue{success.emergencyPriority ? " with emergency priority" : ""}.</small><button type="button" onClick={() => setSuccess(null)} aria-label="Dismiss confirmation">×</button></div>}

    <section className="reception-panel"><div className="reception-panel-heading"><div><span>STEP 01</span><h3>Find a patient</h3><p>Search by patient ID, name or mobile number.</p></div></div>
      <form className="reception-search" onSubmit={(event) => void submitSearch(event)}><label htmlFor="reception-search">Patient search</label><div><input id="reception-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Patient ID, name or 10-digit mobile" maxLength={120} required /><button type="submit" disabled={searching}>{searching ? "Searching…" : "Search patients"}</button></div></form>
      {results.length > 0 && <div className="reception-patient-results" aria-live="polite">{results.map((patient) => <article key={patient.patientId} className={selected?.patientId === patient.patientId ? "is-selected" : ""}><div><strong>{patient.fullName}</strong><span>ID {patient.patientId} · {patient.age} yrs · {patient.gender}</span><small>{patient.mobileNumber}{patient.email ? ` · ${patient.email}` : ""}</small></div><button type="button" onClick={() => { setSelected(patient); setNewPatientMode(false); setSuccess(null); setError(""); setRequestKey(makeKey()); }}>Select patient</button></article>)}</div>}
      {search && !searching && results.length === 0 && !error && <p className="reception-empty">No matching patient found. You can register a new patient below.</p>}
      {!newPatientMode && <button type="button" className="reception-link-button" onClick={startNewPatient}>＋ Register a new patient</button>}
    </section>

    {(selected || newPatientMode) && <form className="reception-panel reception-checkin-form" onSubmit={(event) => void submitCheckIn(event)}>
      <div className="reception-panel-heading"><div><span>STEP 02</span><h3>{newPatientMode ? "Register and check in" : `Check in ${selected?.fullName}`}</h3><p>{newPatientMode ? "Registration and first visit are created together." : `Patient ID ${selected?.patientId} · Records remain attached to their existing patient identity.`}</p></div>{newPatientMode && <button type="button" className="reception-text-button" onClick={() => setNewPatientMode(false)}>Choose existing patient</button>}</div>
      {newPatientMode && <div className="reception-fields"><label>Full name<input value={draft.fullName} onChange={(event) => updateDraft("fullName", event.target.value)} maxLength={120} required /></label><label>Age<input type="number" value={draft.age || ""} onChange={(event) => updateDraft("age", Number(event.target.value))} min={0} max={130} required /></label><label>Gender<select value={draft.gender} onChange={(event) => updateDraft("gender", event.target.value as NewPatientDraft["gender"])}><option>Male</option><option>Female</option><option>Other</option></select></label><label>Mobile number<input type="tel" value={draft.phone} onChange={(event) => updateDraft("phone", event.target.value)} pattern="[6-9][0-9]{9}" maxLength={10} title="Enter a valid 10-digit Indian mobile number" required /></label><label>Email (optional)<input type="email" value={draft.email} onChange={(event) => updateDraft("email", event.target.value)} maxLength={160} /></label><label>Visit date<input type="date" value={draft.visitDate} onChange={(event) => updateDraft("visitDate", event.target.value)} required /></label></div>}
      <div className="reception-fields reception-visit-fields"><label>Visit type<select value={visitType} disabled={newPatientMode} onChange={(event) => { setVisitType(event.target.value as "NEW" | "FOLLOW_UP"); setRequestKey(makeKey()); }}><option value="NEW">New visit</option><option value="FOLLOW_UP">Follow-up visit</option></select></label><label>Assign Doctor<select value={doctorId} onChange={(event) => { setDoctorId(event.target.value); setRequestKey(makeKey()); }} required><option value="">Select an approved Doctor</option>{doctors.map((doctor) => <option key={doctor.doctorId} value={doctor.doctorId}>{doctor.fullName}{doctor.specialization ? ` · ${doctor.specialization}` : ""}</option>)}</select></label>
        {visitType === "FOLLOW_UP" && <label>Scheduled follow-up<select value={followUpId} onChange={(event) => { setFollowUpId(event.target.value); setRequestKey(makeKey()); }} required><option value="">Select the scheduled follow-up</option>{followUps.map((followUp) => <option key={followUp.followUpId} value={followUp.followUpId}>{followUp.followUpDate}</option>)}</select></label>}
      </div>
      {visitType === "FOLLOW_UP" && selected && followUps.length === 0 && <p className="reception-empty">No unlinked scheduled follow-ups are available for this patient.</p>}
      <label className="reception-emergency-toggle"><input type="checkbox" checked={emergencyPriority} onChange={(event) => { setEmergencyPriority(event.target.checked); setRequestKey(makeKey()); }} /><span><strong>Emergency priority</strong><small>Place this patient ahead in the nursing queue.</small></span></label>
      {emergencyPriority && <label className="reception-emergency-note">Emergency note (optional)<textarea value={emergencyNote} onChange={(event) => { setEmergencyNote(event.target.value); setRequestKey(makeKey()); }} rows={3} maxLength={1500} placeholder="Briefly describe the urgent concern" /></label>}
      {doctors.length === 0 && <p className="reception-inline-warning">No approved and enabled Doctors are available. Ask an administrator to review Doctor status.</p>}
      <div className="reception-form-actions"><button type="button" className="reception-cancel" onClick={() => { setSelected(null); setNewPatientMode(false); setRequestKey(makeKey()); }}>Cancel</button><button type="submit" disabled={submitting || loading || doctors.length === 0 || (visitType === "FOLLOW_UP" && !followUpId)}>{submitting ? "Checking in…" : "Confirm check-in"}</button></div>
    </form>}
    <section className="reception-panel reception-follow-up-lifecycle" aria-labelledby="reception-follow-up-title">
      <div className="reception-panel-heading"><div><span>APPOINTMENT LIFECYCLE</span><h3 id="reception-follow-up-title">Follow-ups</h3><p>Check-in leaves the clinical state scheduled; consultation and signing control clinical completion.</p></div>
        <label>Status<select value={lifecycleFilter} onChange={(event) => setLifecycleFilter(event.target.value)}><option value="">All statuses</option><option value="SCHEDULED">Scheduled</option><option value="CHECKED_IN">Checked in</option><option value="IN_PROGRESS">In progress</option><option value="COMPLETED">Completed</option><option value="CANCELLED">Cancelled</option><option value="MISSED">Missed</option></select></label>
      </div>
      {lifecycleLoading ? <p role="status">Loading follow-ups…</p> : lifecycleRows.length === 0 ? <p className="reception-empty">No follow-ups match this status.</p> : <div className="reception-patient-results">{lifecycleRows.map((row) => {
        const checkedIn = row.checkedInVisitId !== null;
        const canChange = row.status === "SCHEDULED" && !checkedIn;
        const canMarkMissed = canChange && row.followUpDate < today();
        return <article key={row.followUpId}><div><strong>{row.patientName}</strong><span>Follow-up #{row.followUpId} · {row.followUpDate} · {row.status}{checkedIn ? " · checked in" : ""}</span><small>{row.assignedDoctorName || "Doctor pending"}{row.checkedInVisitId ? ` · Visit #${row.checkedInVisitId}` : ""}{row.cancellationReason ? ` · ${row.cancellationReason}` : ""}{row.missedReason ? ` · ${row.missedReason}` : ""}</small></div>
          {canChange && <div className="reception-form-actions"><button type="button" className="reception-cancel" onClick={() => void updateLifecycle(row, "cancel")}>Cancel</button>{canMarkMissed && <button type="button" className="reception-cancel" onClick={() => void updateLifecycle(row, "missed")}>Mark missed</button>}</div>}
        </article>;
      })}</div>}
      {lifecycleSuccess && <p className="reception-success" role="status">{lifecycleSuccess}</p>}
    </section>
  </section>;
}

export default ReceptionWorkspace;
