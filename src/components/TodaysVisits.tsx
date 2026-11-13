import { useCallback, useEffect, useMemo, useState } from "react";
import { API_BASE_URL } from "../config/api";
import { authenticatedFetch } from "../auth/session";
import "./DirectoryScreens.css";

type VisitRow = {
  id: number;
  patientId: number;
  patientName: string;
  visitDate: string;
  doctor?: string | null;
  chiefComplaints?: string | null;
};

type VisitDetails = VisitRow & {
  visitNumber?: number;
  presentIllness?: string | null;
  generalExamination?: string | null;
  heartExamination?: string | null;
  lungsExamination?: string | null;
  abdomenExamination?: string | null;
  rectalExamination?: string | null;
  diagnosis?: string | null;
  treatmentPlan?: string | null;
  temperature?: number | null;
  pulseRate?: number | null;
  spo2?: number | null;
  bpSystolic?: number | null;
  bpDiastolic?: number | null;
};

type Filter = "all" | "with-reason" | "without-reason";

function TodaysVisits({ accessToken }: { accessToken: string }) {
  const [visits, setVisits] = useState<VisitRow[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [details, setDetails] = useState<VisitDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState<number | null>(null);
  const [detailsError, setDetailsError] = useState("");

  const loadVisits = useCallback(async (signal: AbortSignal) => {
    setLoading(true);
    setError("");
    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/api/visits/today`, {
        headers: { Accept: "application/json", Authorization: `Bearer ${accessToken}` },
        signal,
      });
      if (!response.ok) throw new Error(`Unable to load today's visits (HTTP ${response.status}).`);
      const data: unknown = await response.json();
      if (!Array.isArray(data)) throw new Error("The server returned an unexpected visit list.");
      setVisits(data as VisitRow[]);
    } catch (cause) {
      if (cause instanceof Error && cause.name === "AbortError") return;
      setError(cause instanceof Error ? cause.message : "Unable to load today's visits.");
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    const controller = new AbortController();
    void loadVisits(controller.signal);
    return () => controller.abort();
  }, [loadVisits, refreshKey]);

  const visibleVisits = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return visits.filter((visit) => {
      const hasReason = Boolean(visit.chiefComplaints?.trim());
      if (filter === "with-reason" && !hasReason) return false;
      if (filter === "without-reason" && hasReason) return false;
      return !query || `${visit.patientName} ${visit.patientId} ${visit.doctor ?? ""} ${visit.chiefComplaints ?? ""}`
        .toLocaleLowerCase().includes(query);
    });
  }, [filter, search, visits]);

  async function showDetails(visitId: number) {
    setDetails(null);
    setDetailsError("");
    setDetailsLoading(visitId);
    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/api/visits/${visitId}`, {
        headers: { Accept: "application/json", Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) throw new Error(`Unable to load visit details (HTTP ${response.status}).`);
      setDetails(await response.json() as VisitDetails);
    } catch (cause) {
      setDetailsError(cause instanceof Error ? cause.message : "Unable to load visit details.");
    } finally {
      setDetailsLoading(null);
    }
  }

  return (
    <section className="directory-page" aria-labelledby="todays-visits-title">
      <div className="directory-heading">
        <div><h2 id="todays-visits-title">Today's Visits</h2><p>Visits recorded for today, based on India Standard Time.</p></div>
        <button type="button" className="records-retry-button" onClick={() => setRefreshKey((key) => key + 1)} disabled={loading}>Refresh</button>
      </div>
      <div className="directory-toolbar">
        <label className="directory-search">Search<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Patient, ID, doctor or complaint" /></label>
        <label>Filter<select value={filter} onChange={(event) => setFilter(event.target.value as Filter)}><option value="all">All visits</option><option value="with-reason">With complaint</option><option value="without-reason">No complaint recorded</option></select></label>
      </div>
      {loading && <p role="status" className="directory-state">Loading today's visits…</p>}
      {error && <div role="alert" className="directory-error">{error} <button type="button" className="records-retry-button" onClick={() => setRefreshKey((key) => key + 1)}>Retry</button></div>}
      {!loading && !error && <div className="directory-table-wrap"><table className="directory-table"><thead><tr><th>Patient</th><th>Patient ID</th><th>Visit date</th><th>Doctor</th><th>Chief complaint</th><th>Details</th></tr></thead><tbody>
        {visibleVisits.length === 0 ? <tr><td colSpan={6} className="directory-empty">{visits.length === 0 ? "No visits recorded for today." : "No visits match your search or filter."}</td></tr> : visibleVisits.map((visit) => <tr key={visit.id}><td>{visit.patientName}</td><td>{visit.patientId}</td><td>{visit.visitDate}</td><td>{visit.doctor || "—"}</td><td>{visit.chiefComplaints || "—"}</td><td><button type="button" className="directory-link" onClick={() => void showDetails(visit.id)} disabled={detailsLoading === visit.id}>{detailsLoading === visit.id ? "Loading…" : "View details"}</button></td></tr>)}
      </tbody></table></div>}
      {detailsError && <p className="directory-error" role="alert">{detailsError}</p>}
      {details && <VisitDetailsPanel details={details} onClose={() => setDetails(null)} />}
    </section>
  );
}

function VisitDetailsPanel({ details, onClose }: { details: VisitDetails; onClose: () => void }) {
  const fields: [string, string | number | null | undefined][] = [
    ["Visit number", details.visitNumber], ["Chief complaint", details.chiefComplaints],
    ["Present illness", details.presentIllness], ["General examination", details.generalExamination],
    ["Heart examination", details.heartExamination], ["Lungs examination", details.lungsExamination],
    ["Abdomen examination", details.abdomenExamination], ["Rectal examination", details.rectalExamination],
    ["Diagnosis", details.diagnosis], ["Treatment plan", details.treatmentPlan],
    ["Temperature", details.temperature], ["Pulse rate", details.pulseRate], ["SpO₂", details.spo2],
    ["Blood pressure", details.bpSystolic && details.bpDiastolic ? `${details.bpSystolic}/${details.bpDiastolic}` : null],
  ];
  return <div className="visit-details-card"><div className="visit-details-heading"><div><h3>{details.patientName}</h3><p>Patient {details.patientId} · Visit {details.visitDate}</p></div><button type="button" className="records-retry-button" onClick={onClose}>Close</button></div><dl>{fields.filter(([, value]) => value !== null && value !== undefined && value !== "").map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></div>;
}

export default TodaysVisits;
