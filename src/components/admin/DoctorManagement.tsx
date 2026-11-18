import { useEffect, useRef, useState } from "react";
import { AdminApiError, loadManagedDoctorsPage, updateDoctorEnabled, type AdminDoctor } from "../../api/adminManagement";
import Pagination from "../common/Pagination";
import ColumnVisibilityManager from "../common/ColumnVisibilityManager";
import { useColumnVisibility, type TableColumn } from "../common/columnVisibility";

type Filter = "all" | "enabled" | "disabled";
const doctorColumns: TableColumn[] = [
  { id: "doctor", label: "Doctor", required: true }, { id: "email", label: "Email" },
  { id: "approval", label: "Approval" }, { id: "status", label: "Account status" },
  { id: "action", label: "Action", required: true },
];

function DoctorManagement({ adminIdentity }: { adminIdentity: string }) {
  const [doctors, setDoctors] = useState<AdminDoctor[]>([]);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(5);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const requestSequence = useRef(0);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const columns = useColumnVisibility("admin", adminIdentity, "doctor-management", doctorColumns);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(0);
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    const controller = new AbortController();
    const sequence = ++requestSequence.current;
    setLoading(true);
    setError("");

    void loadManagedDoctorsPage({
      page,
      size: pageSize,
      search: search.trim(),
      status: filter,
      signal: controller.signal,
    }).then((result) => {
      if (sequence !== requestSequence.current) return;
      if (result.totalPages === 0 && page !== 0) {
        setPage(0);
        return;
      }
      if (result.totalPages > 0 && page >= result.totalPages) {
        setPage(result.totalPages - 1);
        return;
      }
      setDoctors(result.content);
      setTotalElements(result.totalElements);
      setTotalPages(result.totalPages);
    }).catch((cause: unknown) => {
      if (controller.signal.aborted || sequence !== requestSequence.current) return;
      setDoctors([]);
      setTotalElements(0);
      setTotalPages(0);
      setError(cause instanceof Error ? cause.message : "Could not load doctor accounts.");
    }).finally(() => {
      if (sequence === requestSequence.current) {
        setLoading(false);
        setRefreshing(false);
      }
    });

    return () => controller.abort();
  }, [page, pageSize, search, filter, reloadKey]);

  const refresh = () => {
    setRefreshing(true);
    setReloadKey((value) => value + 1);
  };

  const toggleEnabled = async (doctor: AdminDoctor) => {
    const enabled = !doctor.enabled;
    setBusyId(doctor.id);
    setError("");
    setSuccess("");
    try {
      await updateDoctorEnabled(doctor.id, enabled);
      setSuccess(`${doctor.fullName}'s account is now ${enabled ? "enabled" : "disabled"}.`);
      refresh();
    } catch (cause) {
      if (cause instanceof AdminApiError && cause.status === 401) return;
      setError(cause instanceof Error ? cause.message : "Could not update this doctor account.");
    } finally {
      setBusyId(null);
    }
  };

  const hasFilters = searchInput.trim().length > 0 || filter !== "all";

  return (
    <section className="management-page" aria-labelledby="doctor-management-title">
      <div className="management-intro"><div><span className="admin-eyebrow">DOCTOR WORKSPACE</span><h2 id="doctor-management-title">Doctor directory</h2><p>Review approval and account status. Account changes do not alter patient records.</p></div><span className="management-icon" aria-hidden="true">♙</span></div>
      <div className="management-toolbar management-toolbar-filter">
        <div><strong>Doctor accounts</strong><small>{loading ? "Loading" : `${totalElements} accounts`}</small></div>
        <label className="admin-table-search">Search<input value={searchInput} maxLength={160} onChange={(event) => setSearchInput(event.target.value)} placeholder="Name, email or status" /></label>
        <label className="admin-filter-select">Account status<select value={filter} onChange={(event) => { setFilter(event.target.value as Filter); setPage(0); }}><option value="all">All accounts</option><option value="enabled">Enabled</option><option value="disabled">Disabled</option></select></label>
        <div className="admin-table-tools"><ColumnVisibilityManager portal="admin" columns={doctorColumns} isVisible={columns.isVisible} visibleCount={columns.visibleCount} onColumnVisibleChange={columns.setColumnVisible} onShowAll={columns.showAll} onReset={columns.resetToDefault} /><button className="admin-secondary-button" onClick={refresh} disabled={loading || refreshing}>{refreshing ? "Refreshing…" : "Refresh list"}</button></div>
      </div>
      {error && <div className="management-feedback is-error" role="alert"><span aria-hidden="true">!</span>{error}<button onClick={refresh}>Retry</button></div>}
      {success && <div className="management-feedback is-success" role="status"><span aria-hidden="true">✓</span>{success}</div>}
      {loading ? <div className="management-loading" role="status"><span className="admin-loader" />Loading doctor accounts…</div>
        : !error && totalElements === 0 ? <div className={`management-empty${hasFilters ? " compact" : ""}`}><span aria-hidden="true">♙</span><strong>{hasFilters ? "No matching accounts" : "No doctor accounts"}</strong><p>{hasFilters ? "Try another search or status filter." : "Doctor registrations will appear here."}</p></div>
          : !error && <div className="management-table-wrap"><table className="management-table"><thead><tr>{columns.isVisible("doctor") && <th>Doctor</th>}{columns.isVisible("email") && <th>Email</th>}{columns.isVisible("approval") && <th>Approval</th>}{columns.isVisible("status") && <th>Account status</th>}{columns.isVisible("action") && <th>Action</th>}</tr></thead><tbody>{doctors.map((doctor) => <tr key={doctor.id}>{columns.isVisible("doctor") && <td><strong>{doctor.fullName}</strong><small>Doctor ID {doctor.id}</small></td>}{columns.isVisible("email") && <td>{doctor.email}</td>}{columns.isVisible("approval") && <td><span className={`admin-pill approval-${doctor.approvalStatus.toLowerCase()}`}>{doctor.approvalStatus}</span></td>}{columns.isVisible("status") && <td><span className={`admin-pill ${doctor.enabled ? "status-enabled" : "status-disabled"}`}>{doctor.enabled ? "Enabled" : "Disabled"}</span></td>}{columns.isVisible("action") && <td><button className={`admin-action-status${doctor.enabled ? " is-disable" : " is-enable"}`} onClick={() => void toggleEnabled(doctor)} disabled={busyId !== null}>{busyId === doctor.id ? "Saving…" : doctor.enabled ? "Disable" : "Enable"}</button></td>}</tr>)}</tbody></table></div>}
      {!loading && !error && <Pagination
        page={page}
        pageSize={pageSize}
        totalPages={totalPages}
        totalElements={totalElements}
        isLoading={loading}
        pageSizeId="admin-doctor-page-size"
        ariaLabel="Doctor management pagination"
        totalLabel="total accounts"
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />}
    </section>
  );
}

export default DoctorManagement;
