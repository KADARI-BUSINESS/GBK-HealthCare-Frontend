import { useCallback, useEffect, useMemo, useState } from "react";
import { API_BASE_URL } from "../config/api";
import { authenticatedFetch } from "../auth/session";
import ColumnVisibilityManager from "./common/ColumnVisibilityManager";
import { useColumnVisibility, type TableColumn } from "./common/columnVisibility";
import "./DirectoryScreens.css";

type Doctor = { id: number; fullName: string; email: string; enabled: boolean };
type Filter = "all" | "enabled" | "disabled";
const directoryColumns: TableColumn[] = [
  { id: "doctor", label: "Doctor", required: true }, { id: "email", label: "Email" },
  { id: "status", label: "Account status" },
];

function DoctorDirectory({ accessToken, doctorId }: { accessToken: string; doctorId: number }) {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const columns = useColumnVisibility("doctor", doctorId, "doctor-directory", directoryColumns);

  const loadDoctors = useCallback(async (signal: AbortSignal) => {
    setLoading(true);
    setError("");
    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/api/doctors`, {
        headers: { Accept: "application/json", Authorization: `Bearer ${accessToken}` },
        signal,
      });
      if (!response.ok) throw new Error(`Unable to load doctors (HTTP ${response.status}).`);
      const data: unknown = await response.json();
      if (!Array.isArray(data)) throw new Error("The server returned an unexpected doctor list.");
      setDoctors(data as Doctor[]);
    } catch (cause) {
      if (cause instanceof Error && cause.name === "AbortError") return;
      setError(cause instanceof Error ? cause.message : "Unable to load doctors.");
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    const controller = new AbortController();
    void loadDoctors(controller.signal);
    return () => controller.abort();
  }, [loadDoctors, refreshKey]);

  const visibleDoctors = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return doctors.filter((doctor) => {
      if (filter === "enabled" && !doctor.enabled) return false;
      if (filter === "disabled" && doctor.enabled) return false;
      return !query || `${doctor.fullName} ${doctor.email}`.toLocaleLowerCase().includes(query);
    });
  }, [doctors, filter, search]);

  return (
    <section className="directory-page" aria-labelledby="doctor-directory-title">
      <div className="directory-heading"><div><h2 id="doctor-directory-title">Doctor Directory</h2><p>Doctor account details stored in this healthcare workspace. Account status does not represent clinical availability.</p></div><button type="button" className="records-retry-button" onClick={() => setRefreshKey((key) => key + 1)} disabled={loading}>Refresh</button></div>
      <div className="directory-toolbar"><label className="directory-search">Search<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Doctor name or email" /></label><label>Account status<select value={filter} onChange={(event) => setFilter(event.target.value as Filter)}><option value="all">All accounts</option><option value="enabled">Enabled</option><option value="disabled">Disabled</option></select></label><ColumnVisibilityManager portal="doctor" columns={directoryColumns} isVisible={columns.isVisible} visibleCount={columns.visibleCount} onColumnVisibleChange={columns.setColumnVisible} onShowAll={columns.showAll} onReset={columns.resetToDefault} /></div>
      {loading && <p role="status" className="directory-state">Loading doctor directory…</p>}
      {error && <div role="alert" className="directory-error">{error} <button type="button" className="records-retry-button" onClick={() => setRefreshKey((key) => key + 1)}>Retry</button></div>}
      {!loading && !error && <div className="directory-table-wrap"><table className={`directory-table${columns.visibleCount < directoryColumns.length ? " column-visibility-customized" : ""}`}><thead><tr>{columns.isVisible("doctor") && <th>Doctor</th>}{columns.isVisible("email") && <th>Email</th>}{columns.isVisible("status") && <th>Account status</th>}</tr></thead><tbody>{visibleDoctors.length === 0 ? <tr><td colSpan={columns.visibleCount} className="directory-empty">{doctors.length === 0 ? "No doctor accounts found." : "No doctors match your search or filter."}</td></tr> : visibleDoctors.map((doctor) => <tr key={doctor.id}>{columns.isVisible("doctor") && <td>{doctor.fullName}</td>}{columns.isVisible("email") && <td>{doctor.email}</td>}{columns.isVisible("status") && <td><span className={`directory-status ${doctor.enabled ? "is-enabled" : "is-disabled"}`}>{doctor.enabled ? "Enabled" : "Disabled"}</span></td>}</tr>)}</tbody></table></div>}
    </section>
  );
}

export default DoctorDirectory;
