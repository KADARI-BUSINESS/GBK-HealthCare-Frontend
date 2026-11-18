import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FOLLOW_UP_API_URL } from "../config/api";
import { authenticatedFetch } from "../auth/session";
import { notifyDashboardStatsChanged } from "../dashboardStatsCache";
import DatePicker from "./common/DatePicker";
import ColumnVisibilityManager from "./common/ColumnVisibilityManager";
import { useColumnVisibility, type TableColumn } from "./common/columnVisibility";
import "./FollowUpManagement.css";

type PatientFollowUp = {
  id: number;
  visitId: number;
  patientId: number;
  followUpDate: string;
  followUpNotes?: string | null;
  status: string;
  createdAt?: string | null;
  completedAt?: string | null;
  checkedInVisitId?: number | null;
};

type FollowUpRow = {
  followUp: PatientFollowUp;
  patientName: string;
  previousVisitDate?: string;
};

type BulkFollowUpResponse = {
  patientId: number;
  patientName: string;
  followUpId: number;
  visitId: number;
  followUpDate: string;
  previousVisitDate: string | null;
  followUpNotes?: string | null;
  status: string;
  createdAt?: string | null;
  completedAt?: string | null;
  checkedInVisitId?: number | null;
};

type FollowUpFilter = "upcoming" | "today" | "overdue" | "in_progress" | "completed" | "cancelled" | "missed" | "all";

type FollowUpManagementProps = {
  accessToken: string;
  doctorId: number;
  initialFollowUpId?: number;
};

const followUpColumns: TableColumn[] = [
  { id: "patient", label: "Patient", required: true }, { id: "patientId", label: "Patient ID", required: true },
  { id: "previousVisit", label: "Previous Visit" }, { id: "followUpDate", label: "Follow-up Date" },
  { id: "notes", label: "Notes" }, { id: "status", label: "Status" }, { id: "actions", label: "Actions", required: true },
];

const FOLLOW_UP_FILTERS: { value: FollowUpFilter; label: string }[] = [
  { value: "upcoming", label: "Upcoming" },
  { value: "today", label: "Today" },
  { value: "overdue", label: "Overdue" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "missed", label: "Missed" },
  { value: "all", label: "All follow-ups" },
];

function localDateKey(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function formatDate(value?: string | null): string {
  if (!value) return "—";
  const parts = value.split("-");
  if (parts.length !== 3) return value;
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

async function getJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await authenticatedFetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal,
  });
  if (!response.ok) {
    throw new Error(`Unable to load follow-up data (HTTP ${response.status}).`);
  }
  return (await response.json()) as T;
}

function FollowUpManagement({ accessToken, doctorId, initialFollowUpId }: FollowUpManagementProps) {
  const columns = useColumnVisibility("doctor", doctorId, "follow-ups", followUpColumns);
  const [rows, setRows] = useState<FollowUpRow[]>([]);
  const [filter, setFilter] = useState<FollowUpFilter>("upcoming");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [retry, setRetry] = useState(0);
  const [editingFollowUpId, setEditingFollowUpId] = useState<number | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [savingFollowUpIds, setSavingFollowUpIds] = useState<Set<number>>(() => new Set());
  const actionsInFlight = useRef(new Set<number>());
  const [actionError, setActionError] = useState("");
  const [partialError, setPartialError] = useState("");
  const [targetMessage, setTargetMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [menuFollowUpId, setMenuFollowUpId] = useState<number | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [cancelTarget, setCancelTarget] = useState<FollowUpRow | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const cancelDialogRef = useRef<HTMLElement>(null);

  const closeMenu = useCallback((restoreFocus = false) => {
    setMenuFollowUpId(null);
    setMenuPosition(null);
    if (restoreFocus) requestAnimationFrame(() => menuButtonRef.current?.focus());
  }, []);

  function openMenu(event: React.MouseEvent<HTMLButtonElement>, id: number) {
    if (menuFollowUpId === id) {
      closeMenu();
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const menuWidth = 208;
    const menuHeight = 148;
    const left = Math.max(8, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8));
    const top = rect.bottom + menuHeight + 8 <= window.innerHeight
      ? rect.bottom + 6
      : Math.max(8, rect.top - menuHeight - 6);
    menuButtonRef.current = event.currentTarget;
    setMenuPosition({ top, left });
    setMenuFollowUpId(id);
  }

  useEffect(() => {
    if (menuFollowUpId === null) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !menuButtonRef.current?.contains(target)) closeMenu();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu(true);
        return;
      }
      const items = menuRef.current?.querySelectorAll<HTMLButtonElement>("[role='menuitem']:not(:disabled)");
      if (!items?.length) return;
      const current = Array.from(items).indexOf(document.activeElement as HTMLButtonElement);
      let next = current;
      if (event.key === "ArrowDown") next = (current + 1 + items.length) % items.length;
      else if (event.key === "ArrowUp") next = (current - 1 + items.length) % items.length;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = items.length - 1;
      else return;
      event.preventDefault();
      items[next].focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    requestAnimationFrame(() => menuRef.current?.querySelector<HTMLButtonElement>("[role='menuitem']:not(:disabled)")?.focus());
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuFollowUpId, closeMenu]);

  useEffect(() => {
    if (!cancelTarget) return;
    requestAnimationFrame(() => cancelDialogRef.current?.querySelector<HTMLButtonElement>("button")?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setCancelTarget(null);
        requestAnimationFrame(() => menuButtonRef.current?.focus());
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [cancelTarget]);

  const loadFollowUps = useCallback(async (signal: AbortSignal) => {
    setIsLoading(true);
    setErrorMessage("");
    setPartialError("");
    try {
      const response = await getJson<BulkFollowUpResponse[]>(
        `${FOLLOW_UP_API_URL}/follow-ups`,
        signal,
      );
      if (!Array.isArray(response)) {
        throw new Error("The server returned an unexpected follow-up list.");
      }
      const nextRows = response.map((item) => ({
        followUp: {
          id: item.followUpId,
          visitId: item.visitId,
          patientId: item.patientId,
          followUpDate: item.followUpDate,
          followUpNotes: item.followUpNotes,
          status: item.status,
          createdAt: item.createdAt,
          completedAt: item.completedAt,
          checkedInVisitId: item.checkedInVisitId,
        },
        patientName: item.patientName,
        previousVisitDate: item.previousVisitDate ?? undefined,
      }));
      nextRows.sort((a, b) =>
        b.followUp.followUpDate.localeCompare(a.followUp.followUpDate),
      );
      setRows(nextRows);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load follow-ups. Please try again.",
      );
    } finally {
      if (!signal.aborted) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadFollowUps(controller.signal);
    return () => controller.abort();
  }, [accessToken, loadFollowUps, retry]);

  useEffect(() => {
    if (!initialFollowUpId || isLoading || errorMessage) return;
    setFilter("all");
    const target = rows.find(({ followUp }) => followUp.id === initialFollowUpId);
    if (!target) {
      setTargetMessage("This follow-up no longer exists or is not accessible.");
      return;
    }
    setTargetMessage("");
    if (target.followUp.status.toUpperCase() === "SCHEDULED") beginReschedule(target);
    window.requestAnimationFrame(() => document.getElementById(`follow-up-${initialFollowUpId}`)?.scrollIntoView({ block: "center", behavior: "smooth" }));
  }, [initialFollowUpId, isLoading, errorMessage, rows]);

  const today = localDateKey(new Date());
  const visibleRows = useMemo(
    () => rows.filter(({ followUp }) => {
      const status = followUp.status.toUpperCase();
      const date = followUp.followUpDate;
      if (filter === "all") return true;
      if (filter === "completed") return status === "COMPLETED";
      if (filter === "cancelled") return status === "CANCELLED";
      if (filter === "in_progress") return status === "IN_PROGRESS";
      if (filter === "missed") return status === "MISSED";
      if (filter === "today") return status === "SCHEDULED" && date === today;
      if (filter === "overdue") return status === "SCHEDULED" && date < today;
      return status === "SCHEDULED" && date > today;
    }),
    [filter, rows, today],
  );

  function beginReschedule(row: FollowUpRow) {
    setEditingFollowUpId(row.followUp.id);
    setEditDate(row.followUp.followUpDate);
    setEditNotes(row.followUp.followUpNotes ?? "");
    setActionError("");
  }

  async function updateFollowUp(row: FollowUpRow, action: "reschedule" | "complete" | "cancel", reason?: string) {
    const followUpId = row.followUp.id;
    if (actionsInFlight.current.has(followUpId)) return;
    actionsInFlight.current.add(followUpId);
    setSavingFollowUpIds((current) => new Set(current).add(followUpId));
    setActionError("");
    try {
      let path = `${FOLLOW_UP_API_URL}/follow-ups/${followUpId}`;
      let method = "PUT";
      let body: string | undefined;
      if (action === "reschedule") {
        if (!editDate) {
          setActionError("Please select a follow-up date.");
          return;
        }
        body = JSON.stringify({ followUpDate: editDate, followUpNotes: editNotes });
      } else {
        path += action === "complete" ? "/complete" : "/cancel";
        if (action === "cancel") body = JSON.stringify({ reason });
      }

      const response = await authenticatedFetch(path, {
        method,
        headers: body
          ? { Accept: "application/json", "Content-Type": "application/json" }
          : { Accept: "application/json" },
        body,
      });
      if (!response.ok) {
        throw new Error(`Unable to ${action} follow-up (HTTP ${response.status}).`);
      }
      setEditingFollowUpId(null);
      notifyDashboardStatsChanged();
      setSuccessMessage(action === "complete" ? "Follow-up marked complete." : action === "cancel" ? "Follow-up cancelled." : "Follow-up rescheduled.");
      window.setTimeout(() => setSuccessMessage(""), 4000);
      setRetry((value) => value + 1);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : `Unable to ${action} follow-up.`,
      );
    } finally {
      actionsInFlight.current.delete(followUpId);
      setSavingFollowUpIds((current) => {
        const next = new Set(current);
        next.delete(followUpId);
        return next;
      });
    }
  }

  return (
    <section className="patient-records">
      <h2>Follow-up Management</h2>
      <p>Review scheduled appointments and update follow-up status.</p>

      <div className="records-toolbar">
        <label htmlFor="follow-up-filter">Show</label>
        <select
          id="follow-up-filter"
          aria-label="Filter follow-ups"
          value={filter}
          onChange={(event) => setFilter(event.target.value as FollowUpFilter)}
          disabled={isLoading}
        >
          {FOLLOW_UP_FILTERS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <button
          type="button"
          className="records-retry-button"
          onClick={() => setRetry((value) => value + 1)}
          disabled={isLoading}
        >
          Refresh
        </button>
        <ColumnVisibilityManager portal="doctor" columns={followUpColumns} isVisible={columns.isVisible} visibleCount={columns.visibleCount} onColumnVisibleChange={columns.setColumnVisible} onShowAll={columns.showAll} onReset={columns.resetToDefault} />
      </div>

      {isLoading && <p className="records-count" role="status">Loading follow-ups…</p>}
      {errorMessage && (
        <div className="records-message records-error" role="alert">
          <span>{errorMessage}</span>
          <button type="button" className="records-retry-button" onClick={() => setRetry((value) => value + 1)}>
            Retry
          </button>
        </div>
      )}
      {actionError && <div className="records-message records-error" role="alert">{actionError}</div>}
      {successMessage && <div className="follow-up-success-toast" role="status" aria-live="polite">{successMessage}</div>}
      {partialError && <div className="records-message records-error" role="status">{partialError}</div>}
      {targetMessage && <div className="records-message records-error" role="status">{targetMessage}</div>}

      {!isLoading && !errorMessage && (
        <div className="table-wrapper">
          <table className={`records-table${columns.visibleCount < followUpColumns.length ? " column-visibility-customized" : ""}`}>
            <thead>
              <tr>
                {columns.isVisible("patient") && <th>Patient</th>}{columns.isVisible("patientId") && <th>Patient ID</th>}{columns.isVisible("previousVisit") && <th>Previous Visit</th>}{columns.isVisible("followUpDate") && <th>Follow-up Date</th>}{columns.isVisible("notes") && <th>Notes</th>}{columns.isVisible("status") && <th>Status</th>}{columns.isVisible("actions") && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {visibleRows.length === 0 ? (
                <tr><td colSpan={columns.visibleCount} className="empty-records">No follow-ups found for this filter.</td></tr>
              ) : visibleRows.map((row) => {
                const { followUp } = row;
                const isScheduled = followUp.status.toUpperCase() === "SCHEDULED";
                const isSaving = savingFollowUpIds.has(followUp.id);
                const isEditing = editingFollowUpId === followUp.id;
                return (
                  <tr key={followUp.id} id={`follow-up-${followUp.id}`} className={followUp.id === initialFollowUpId ? "activity-target-row" : undefined}>
                    {columns.isVisible("patient") && <td>{row.patientName}</td>}
                    {columns.isVisible("patientId") && <td>{followUp.patientId}</td>}
                    {columns.isVisible("previousVisit") && <td>{formatDate(row.previousVisitDate)}</td>}
                    {columns.isVisible("followUpDate") && <td>
                      {isEditing ? (
                        <DatePicker
                          label={`Reschedule follow-up for ${row.patientName}`}
                          value={editDate}
                          onChange={setEditDate}
                          disabled={isSaving}
                          clearable
                        />
                      ) : formatDate(followUp.followUpDate)}
                    </td>}
                    {columns.isVisible("notes") && <td>
                      {isEditing ? (
                        <input
                          aria-label={`Follow-up notes for ${row.patientName}`}
                          value={editNotes}
                          maxLength={2000}
                          onChange={(event) => setEditNotes(event.target.value)}
                          disabled={isSaving}
                        />
                      ) : followUp.followUpNotes || "—"}
                    </td>}
                    {columns.isVisible("status") && <td>
                      <span className={`follow-up-badge ${isScheduled ? "follow-up-scheduled" : "follow-up-not-scheduled"}`}>
                        {followUp.status.toLowerCase()}
                      </span>
                      {isScheduled && followUp.followUpDate < today && " · overdue"}
                    </td>}
                    {columns.isVisible("actions") && <td>
                      {isScheduled && isEditing ? (
                        <>
                          <button type="button" className="export-button" onClick={() => void updateFollowUp(row, "reschedule")} disabled={isSaving}>
                            Save
                          </button>{" "}
                          <button type="button" className="records-retry-button" onClick={() => setEditingFollowUpId(null)} disabled={isSaving}>
                            Cancel edit
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="follow-up-kebab-trigger"
                          aria-label={`Actions for ${row.patientName} follow-up`}
                          aria-haspopup="menu"
                          aria-expanded={menuFollowUpId === followUp.id}
                          aria-controls={menuFollowUpId === followUp.id ? `follow-up-menu-${followUp.id}` : undefined}
                          disabled={isSaving}
                          onClick={(event) => openMenu(event, followUp.id)}
                          onKeyDown={(event) => {
                            if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              if (menuFollowUpId !== followUp.id) openMenu(event as unknown as React.MouseEvent<HTMLButtonElement>, followUp.id);
                            }
                          }}
                        >
                          <span aria-hidden="true">⋮</span>
                        </button>
                      )}
                    </td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {menuFollowUpId !== null && menuPosition && (() => {
        const row = rows.find((item) => item.followUp.id === menuFollowUpId);
        if (!row) return null;
        const scheduled = row.followUp.status.toUpperCase() === "SCHEDULED" && !row.followUp.checkedInVisitId;
        return createPortal(
          <div ref={menuRef} id={`follow-up-menu-${menuFollowUpId}`} className="follow-up-action-menu" role="menu" aria-label={`Follow-up actions for ${row.patientName}`} style={{ top: menuPosition.top, left: menuPosition.left }}>
            <button type="button" role="menuitem" disabled={!scheduled || savingFollowUpIds.has(menuFollowUpId)} onClick={() => { closeMenu(); beginReschedule(row); }}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="14" height="16" rx="2"/><path d="M7 3v4m6-4v4M3 10h14m2 3v5l3 2"/><circle cx="19" cy="18" r="3"/></svg><span>Reschedule</span>
            </button>
            <button type="button" role="menuitem" disabled title="Follow-ups complete automatically when the assigned Doctor signs the linked consultation.">
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/></svg><span>Complete after consultation signing</span>
            </button>
            <button type="button" role="menuitem" className="is-danger" disabled={!scheduled || savingFollowUpIds.has(menuFollowUpId)} onClick={() => { closeMenu(); setCancelTarget(row); }}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18m-7 4 4 4m0-4-4 4"/></svg><span>Cancel follow-up</span>
            </button>
          </div>, document.body,
        );
      })()}
      {cancelTarget && (
        <div className="follow-up-confirm-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setCancelTarget(null); }}>
          <section ref={cancelDialogRef} className="follow-up-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="follow-up-cancel-title" aria-describedby="follow-up-cancel-description">
            <span className="follow-up-confirm-icon" aria-hidden="true">!</span>
            <h3 id="follow-up-cancel-title">Cancel this follow-up?</h3>
            <p id="follow-up-cancel-description">The scheduled follow-up for {cancelTarget.patientName} will be cancelled.</p>
            <div className="follow-up-confirm-actions">
              <button type="button" className="records-retry-button" onClick={() => setCancelTarget(null)}>Keep follow-up</button>
              <button type="button" className="follow-up-confirm-danger" disabled={savingFollowUpIds.has(cancelTarget.followUp.id)} onClick={() => { const target = cancelTarget; const reason = window.prompt("Reason for cancelling this follow-up:"); if (!reason?.trim()) return; setCancelTarget(null); void updateFollowUp(target, "cancel", reason.trim()); }}>Cancel follow-up</button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

export default FollowUpManagement;
