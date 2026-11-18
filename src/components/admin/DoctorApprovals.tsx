import { useCallback, useEffect, useRef, useState } from "react";
import { AdminApiError, loadPendingDoctorApprovals, updateDoctorApproval, type AdminDoctor } from "../../api/adminManagement";
import Pagination from "../common/Pagination";
import ColumnVisibilityManager from "../common/ColumnVisibilityManager";
import { useColumnVisibility, type TableColumn } from "../common/columnVisibility";

const approvalColumns: TableColumn[] = [
  { id: "doctor", label: "Doctor", required: true }, { id: "email", label: "Email" },
  { id: "mobile", label: "Mobile" }, { id: "qualification", label: "Qualification" },
  { id: "specialization", label: "Specialization" }, { id: "registration", label: "Medical registration no." },
  { id: "registered", label: "Registered" }, { id: "decision", label: "Decision", required: true },
];

function DoctorApprovals({ adminIdentity }: { adminIdentity: string }) {
  type ApprovalDecision = { doctor: AdminDoctor; approvalStatus: "APPROVED" | "REJECTED" };
  const [doctors, setDoctors] = useState<AdminDoctor[]>([]);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(5);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [decision, setDecision] = useState<ApprovalDecision | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [dialogError, setDialogError] = useState("");
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const columns = useColumnVisibility("admin", adminIdentity, "doctor-approvals", approvalColumns);

  const load = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true); else setLoading(true);
    setError("");
    try { setDoctors(await loadPendingDoctorApprovals()); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load pending doctor registrations."); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const totalPages = Math.ceil(doctors.length / pageSize);
  const visibleDoctors = doctors.slice(page * pageSize, (page + 1) * pageSize);

  useEffect(() => {
    if (totalPages === 0 && page !== 0) setPage(0);
    else if (totalPages > 0 && page >= totalPages) setPage(totalPages - 1);
  }, [page, totalPages]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!decision || !dialog) return;
    if (!dialog.open) dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, [decision]);

  const openDecision = (doctor: AdminDoctor, approvalStatus: "APPROVED" | "REJECTED") => {
    setRejectionReason("");
    setDialogError("");
    setDecision({ doctor, approvalStatus });
  };

  const cancelDecision = () => {
    if (busyId !== null) return;
    setDecision(null);
    setDialogError("");
  };

  const submitDecision = async () => {
    if (!decision || busyId !== null) return;
    const { doctor, approvalStatus } = decision;
    const reason = rejectionReason.trim();
    if (approvalStatus === "REJECTED" && reason.length > 500) {
      setDialogError("Keep the rejection reason within 500 characters.");
      return;
    }
    setBusyId(doctor.id); setError(""); setSuccess("");
    try {
      await updateDoctorApproval(doctor.id, approvalStatus, approvalStatus === "REJECTED" ? reason || null : null);
      setSuccess(`${doctor.fullName} was ${approvalStatus === "APPROVED" ? "approved" : "rejected"}.`);
      setDecision(null);
      await load(true);
    } catch (cause) {
      if (cause instanceof AdminApiError && cause.status === 401) {
        setDecision(null);
        return;
      }
      setDialogError(cause instanceof Error ? cause.message : "Could not update this doctor approval.");
    } finally { setBusyId(null); }
  };

  return (
    <section className="management-page" aria-labelledby="doctor-approvals-title">
      <div className="management-intro"><div><span className="admin-eyebrow">DOCTOR WORKSPACE</span><h2 id="doctor-approvals-title">Approvals queue</h2><p>Review registrations and decide who can access the clinical workspace.</p></div><span className="management-icon" aria-hidden="true">✓</span></div>
      <div className="management-toolbar"><div><strong>Pending registrations</strong><small>{loading ? "Loading" : `${doctors.length} awaiting review`}</small></div><div className="admin-table-tools"><ColumnVisibilityManager portal="admin" columns={approvalColumns} isVisible={columns.isVisible} visibleCount={columns.visibleCount} onColumnVisibleChange={columns.setColumnVisible} onShowAll={columns.showAll} onReset={columns.resetToDefault} /><button className="admin-secondary-button" onClick={() => void load(true)} disabled={loading || refreshing}>{refreshing ? "Refreshing…" : "Refresh list"}</button></div></div>
      {error && <div className="management-feedback is-error" role="alert"><span aria-hidden="true">!</span>{error}<button onClick={() => void load()}>Retry</button></div>}
      {success && <div className="management-feedback is-success" role="status"><span aria-hidden="true">✓</span>{success}</div>}
      {loading ? <div className="management-loading" role="status"><span className="admin-loader" />Loading pending registrations…</div>
        : !error && doctors.length === 0 ? <div className="management-empty"><span aria-hidden="true">✓</span><strong>All caught up</strong><p>There are no pending doctor registrations.</p></div>
          : !error && <div className="management-table-wrap"><table className="management-table"><thead><tr>
            {columns.isVisible("doctor") && <th>Doctor</th>}{columns.isVisible("email") && <th>Email</th>}{columns.isVisible("mobile") && <th>Mobile</th>}{columns.isVisible("qualification") && <th>Qualification</th>}{columns.isVisible("specialization") && <th>Specialization</th>}{columns.isVisible("registration") && <th>Medical registration no.</th>}{columns.isVisible("registered") && <th>Registered</th>}{columns.isVisible("decision") && <th>Decision</th>}
          </tr></thead><tbody>{visibleDoctors.map((doctor) => <tr key={doctor.id}>
            {columns.isVisible("doctor") && <td><strong>{doctor.fullName}</strong><small>Doctor ID {doctor.id} · {doctor.approvalStatus}</small></td>}{columns.isVisible("email") && <td>{doctor.email}</td>}{columns.isVisible("mobile") && <td>{doctor.mobileNumber || "—"}</td>}{columns.isVisible("qualification") && <td>{doctor.qualification || "—"}</td>}{columns.isVisible("specialization") && <td>{doctor.specialization || "—"}</td>}{columns.isVisible("registration") && <td>{doctor.medicalRegistrationNumber || "—"}</td>}{columns.isVisible("registered") && <td>{formatDate(doctor.createdAt)}</td>}
            {columns.isVisible("decision") && <td><div className="management-row-actions"><button className="admin-action-approve" onClick={() => openDecision(doctor, "APPROVED")} disabled={busyId !== null}>{busyId === doctor.id ? "Saving…" : "Approve"}</button><button className="admin-action-reject" onClick={() => openDecision(doctor, "REJECTED")} disabled={busyId !== null}>{busyId === doctor.id ? "Saving…" : "Reject"}</button></div></td>}
          </tr>)}</tbody></table></div>}
      {!loading && !error && <Pagination
        page={page}
        pageSize={pageSize}
        totalPages={totalPages}
        totalElements={doctors.length}
        isLoading={loading || refreshing}
        pageSizeId="admin-doctor-approvals-page-size"
        ariaLabel="Doctor approvals pagination"
        totalLabel="pending registrations"
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />}
      {decision && <dialog ref={dialogRef} className="admin-decision-dialog" aria-labelledby="approval-dialog-title" onCancel={(event) => { event.preventDefault(); cancelDecision(); }}>
        <div className={`admin-dialog-mark ${decision.approvalStatus === "APPROVED" ? "is-approve" : "is-reject"}`} aria-hidden="true">{decision.approvalStatus === "APPROVED" ? "✓" : "!"}</div>
        <span className="admin-dialog-eyebrow">DOCTOR ACCESS REVIEW</span>
        <h2 id="approval-dialog-title">{decision.approvalStatus === "APPROVED" ? "Approve doctor?" : "Reject application?"}</h2>
        <p className="admin-dialog-copy"><strong>{decision.doctor.fullName}</strong> · {decision.doctor.email}</p>
        <p>{decision.approvalStatus === "APPROVED" ? "This doctor will be able to sign in to the clinical workspace." : "This application will remain unable to access the clinical workspace."}</p>
        {decision.approvalStatus === "REJECTED" && <label className="admin-dialog-reason">Rejection reason <span>Optional</span><textarea rows={4} maxLength={700} value={rejectionReason} onChange={(event) => { setRejectionReason(event.target.value); setDialogError(""); }} placeholder="Share a short reason with the applicant" disabled={busyId !== null} /><small>{rejectionReason.length}/500 characters</small></label>}
        {dialogError && <div className="admin-dialog-error" role="alert">{dialogError}</div>}
        <div className="admin-dialog-actions"><button type="button" className="admin-dialog-cancel" onClick={cancelDecision} disabled={busyId !== null}>Cancel</button><button type="button" className={`admin-dialog-confirm ${decision.approvalStatus === "APPROVED" ? "is-approve" : "is-reject"}`} onClick={() => void submitDecision()} disabled={busyId !== null}>{busyId !== null ? "Saving decision…" : decision.approvalStatus === "APPROVED" ? "Confirm approval" : "Confirm rejection"}</button></div>
      </dialog>}
    </section>
  );
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? "—" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

export default DoctorApprovals;
