import { useCallback, useEffect, useState } from "react";
import { loadApprovalHistory, type AdminApprovalHistory } from "../../api/adminManagement";
import ColumnVisibilityManager from "../common/ColumnVisibilityManager";
import { useColumnVisibility, type TableColumn } from "../common/columnVisibility";

const historyColumns: TableColumn[] = [
  { id: "time", label: "Decision time", required: true }, { id: "doctor", label: "Doctor", required: true },
  { id: "decision", label: "Decision", required: true }, { id: "previous", label: "Previous status" },
  { id: "reviewer", label: "Admin reviewer" }, { id: "reason", label: "Rejection reason" },
];

function DoctorApprovalHistory({ adminIdentity }: { adminIdentity: string }) {
  const [items, setItems] = useState<AdminApprovalHistory[]>([]);
  const [page, setPage] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const columns = useColumnVisibility("admin", adminIdentity, "approval-history", historyColumns);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await loadApprovalHistory(page, 5);
      setItems(result.content);
      setHasNext(result.hasNext);
      setTotal(result.totalElements);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load approval history.");
    } finally {
      setLoading(false);
    }
  }, [page, retry]);

  useEffect(() => { void load(); }, [load]);

  return (
    <section className="management-page" aria-labelledby="approval-history-title">
      <div className="management-intro">
        <div><span className="admin-eyebrow">AUDIT TRAIL</span><h2 id="approval-history-title">Doctor approval history</h2><p>Review recorded Admin decisions. Newest decisions appear first.</p></div>
        <span className="management-icon" aria-hidden="true">◷</span>
      </div>
      <div className="management-toolbar"><div><strong>Decisions</strong><small>{loading ? "Loading" : `${total} recorded decisions`}</small></div><div className="admin-table-tools"><ColumnVisibilityManager portal="admin" columns={historyColumns} isVisible={columns.isVisible} visibleCount={columns.visibleCount} onColumnVisibleChange={columns.setColumnVisible} onShowAll={columns.showAll} onReset={columns.resetToDefault} /><button className="admin-secondary-button" onClick={() => setRetry((value) => value + 1)} disabled={loading}>Refresh history</button></div></div>
      {error && <div className="management-feedback is-error" role="alert">{error}<button onClick={() => setRetry((value) => value + 1)}>Retry</button></div>}
      {loading ? <div className="management-loading" role="status"><span className="admin-loader" />Loading approval history…</div>
        : !error && items.length === 0 ? <div className="management-empty"><span aria-hidden="true">◷</span><strong>No decisions recorded</strong><p>Approval and rejection decisions will appear here.</p></div>
          : !error && <>
            <div className="management-table-wrap"><table className="management-table">
              <thead><tr>{columns.isVisible("time") && <th>Decision time</th>}{columns.isVisible("doctor") && <th>Doctor</th>}{columns.isVisible("decision") && <th>Decision</th>}{columns.isVisible("previous") && <th>Previous status</th>}{columns.isVisible("reviewer") && <th>Admin reviewer</th>}{columns.isVisible("reason") && <th>Rejection reason</th>}</tr></thead>
              <tbody>{items.map((item) => <tr key={item.id}>
                {columns.isVisible("time") && <td>{formatDate(item.decisionAt)}</td>}
                {columns.isVisible("doctor") && <td><strong>{item.doctorName}</strong><small>{item.doctorEmail} · ID {item.doctorId}</small></td>}
                {columns.isVisible("decision") && <td><span className={`admin-pill approval-${item.newApprovalStatus.toLowerCase()}`}>{item.newApprovalStatus}</span></td>}
                {columns.isVisible("previous") && <td>{item.previousApprovalStatus}</td>}
                {columns.isVisible("reviewer") && <td><strong>{item.adminEmail}</strong><small>Admin ID {item.adminId}</small></td>}
                {columns.isVisible("reason") && <td>{item.rejectionReason || "—"}</td>}
              </tr>)}</tbody>
            </table></div>
            <div className="approval-history-pagination">
              <button className="admin-secondary-button" onClick={() => setPage((current) => Math.max(0, current - 1))} disabled={loading || page === 0}>Newer</button>
              <span>Page {page + 1}</span>
              <button className="admin-secondary-button" onClick={() => setPage((current) => current + 1)} disabled={loading || !hasNext}>Older</button>
            </div>
          </>}
    </section>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? "—" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default DoctorApprovalHistory;
