import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FOLLOW_UP_API_URL } from "../config/api";
import { authenticatedFetch } from "../auth/session";
import { notifyDashboardStatsChanged } from "../dashboardStatsCache";

type PatientFollowUp = {
  id: number;
  visitId: number;
  patientId: number;
  followUpDate: string;
  followUpNotes?: string | null;
  status: string;
  createdAt?: string | null;
  completedAt?: string | null;
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
};

type FollowUpFilter = "upcoming" | "today" | "overdue" | "completed" | "cancelled" | "all";

type FollowUpManagementProps = {
  accessToken: string;
};

const FOLLOW_UP_FILTERS: { value: FollowUpFilter; label: string }[] = [
  { value: "upcoming", label: "Upcoming" },
  { value: "today", label: "Today" },
  { value: "overdue", label: "Overdue" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
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

function FollowUpManagement({ accessToken }: FollowUpManagementProps) {
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

  const today = localDateKey(new Date());
  const visibleRows = useMemo(
    () => rows.filter(({ followUp }) => {
      const status = followUp.status.toUpperCase();
      const date = followUp.followUpDate;
      if (filter === "all") return true;
      if (filter === "completed") return status === "COMPLETED";
      if (filter === "cancelled") return status === "CANCELLED";
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

  async function updateFollowUp(row: FollowUpRow, action: "reschedule" | "complete" | "cancel") {
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
      {partialError && <div className="records-message records-error" role="status">{partialError}</div>}

      {!isLoading && !errorMessage && (
        <div className="table-wrapper">
          <table className="records-table">
            <thead>
              <tr>
                <th>Patient</th>
                <th>Patient ID</th>
                <th>Previous Visit</th>
                <th>Follow-up Date</th>
                <th>Notes</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.length === 0 ? (
                <tr><td colSpan={7} className="empty-records">No follow-ups found for this filter.</td></tr>
              ) : visibleRows.map((row) => {
                const { followUp } = row;
                const isScheduled = followUp.status.toUpperCase() === "SCHEDULED";
                const isSaving = savingFollowUpIds.has(followUp.id);
                const isEditing = editingFollowUpId === followUp.id;
                return (
                  <tr key={followUp.id}>
                    <td>{row.patientName}</td>
                    <td>{followUp.patientId}</td>
                    <td>{formatDate(row.previousVisitDate)}</td>
                    <td>
                      {isEditing ? (
                        <input
                          aria-label={`Reschedule follow-up for ${row.patientName}`}
                          type="date"
                          value={editDate}
                          onChange={(event) => setEditDate(event.target.value)}
                          disabled={isSaving}
                        />
                      ) : formatDate(followUp.followUpDate)}
                    </td>
                    <td>
                      {isEditing ? (
                        <input
                          aria-label={`Follow-up notes for ${row.patientName}`}
                          value={editNotes}
                          maxLength={2000}
                          onChange={(event) => setEditNotes(event.target.value)}
                          disabled={isSaving}
                        />
                      ) : followUp.followUpNotes || "—"}
                    </td>
                    <td>
                      <span className={`follow-up-badge ${isScheduled ? "follow-up-scheduled" : "follow-up-not-scheduled"}`}>
                        {followUp.status.toLowerCase()}
                      </span>
                      {isScheduled && followUp.followUpDate < today && " · overdue"}
                    </td>
                    <td>
                      {isScheduled && isEditing ? (
                        <>
                          <button type="button" className="export-button" onClick={() => void updateFollowUp(row, "reschedule")} disabled={isSaving}>
                            Save
                          </button>{" "}
                          <button type="button" className="records-retry-button" onClick={() => setEditingFollowUpId(null)} disabled={isSaving}>
                            Cancel edit
                          </button>
                        </>
                      ) : isScheduled ? (
                        <>
                          <button type="button" className="records-retry-button" onClick={() => beginReschedule(row)} disabled={isSaving}>Reschedule</button>{" "}
                          <button type="button" className="records-retry-button" onClick={() => void updateFollowUp(row, "complete")} disabled={isSaving}>Complete</button>{" "}
                          <button type="button" className="records-retry-button" onClick={() => void updateFollowUp(row, "cancel")} disabled={isSaving}>Cancel follow-up</button>
                        </>
                      ) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default FollowUpManagement;
