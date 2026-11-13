import { Fragment, memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FOLLOW_UP_API_URL, PATIENT_API_URL } from "../config/api";
import { authenticatedFetch } from "../auth/session";
import { notifyDashboardStatsChanged } from "../dashboardStatsCache";

import "./PatientRecords.css";
import "./PatientRecordsCalendar.css";
import PatientClinicalReportEmail from "./PatientClinicalReportEmail";
import DatePicker from "./common/DatePicker";
type Patient = {
  id: number;

  fullName: string;

  age: number;

  gender: string;

  visitDate: string;

  phone: string;

  email?: string | null;

  doctor: string;

  chiefComplaints?: string | null;
};

type PatientPageResponse = {
  content: Patient[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
};

type PatientVisit = {
  id: number;

  patientId: number;

  visitNumber: number;

  visitDate: string;

  followUpDate?: string | null;

  followUpNotes?: string | null;

  chiefComplaints?: string | null;

  presentIllness?: string | null;

  generalExamination?: string | null;

  heartExamination?: string | null;

  lungsExamination?: string | null;

  abdomenExamination?: string | null;

  rectalExamination?: string | null;

  temperature?: number | null;

  pulseRate?: number | null;

  spo2?: number | null;

  bpSystolic?: number | null;

  bpDiastolic?: number | null;

  doctor?: string | null;

  diagnosis?: string | null;

  treatmentPlan?: string | null;

  createdAt?: string | null;
};

type PatientFollowUp = {
  id: number;

  visitId: number;

  patientId: number;

  followUpDate: string;

  followUpNotes?: string | null;

  status: "SCHEDULED" | "COMPLETED" | "CANCELLED" | string;

  createdAt?: string | null;

  completedAt?: string | null;
};

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
type PatientRecordsProps = {
  accessToken: string;
  initialPatientId?: number;
  initialVisitId?: number;
};

const PatientRecordsSearch = memo(function PatientRecordsSearch({
  onSearch,
}: {
  onSearch: (value: string) => void;
}) {
  const [value, setValue] = useState("");

  useEffect(() => {
    const timeout = window.setTimeout(() => onSearch(value), 350);
    return () => window.clearTimeout(timeout);
  }, [onSearch, value]);

  return (
    <input
      type="search"
      placeholder="Search by patient, doctor, gender, phone, or ID..."
      aria-label="Search patient records"
      value={value}
      onChange={(event) => setValue(event.target.value)}
    />
  );
});

function PatientRecords({ accessToken, initialPatientId, initialVisitId }: PatientRecordsProps) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);

  const [searchTerm, setSearchTerm] = useState("");

  const [selectedGender, setSelectedGender] = useState("All");

  const [isLoading, setIsLoading] = useState(true);

  const [isExportingCsv, setIsExportingCsv] = useState(false);

  const [exportError, setExportError] = useState("");

  const isExportInProgress = useRef(false);

  const [errorMessage, setErrorMessage] = useState("");
  const requestSequence = useRef(0);

  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  const [visits, setVisits] = useState<PatientVisit[]>([]);

  const [isLoadingVisits, setIsLoadingVisits] = useState(false);

  const [visitError, setVisitError] = useState("");

  const [followUpsByVisit, setFollowUpsByVisit] = useState<
    Record<number, PatientFollowUp[]>
  >({});

  const [followUpLoadError, setFollowUpLoadError] = useState("");
  const [followUpDateInputs, setFollowUpDateInputs] = useState<
    Record<number, string>
  >({});
  const [followUpNoteInputs, setFollowUpNoteInputs] = useState<
    Record<number, string>
  >({});
  const [savingFollowUpVisitId, setSavingFollowUpVisitId] = useState<
    number | null
  >(null);
  const [followUpSaveMessages, setFollowUpSaveMessages] = useState<
    Record<number, string>
  >({});

  useEffect(() => {
    const controller = new AbortController();
    const sequence = ++requestSequence.current;

    async function loadPatients() {
      setIsLoading(true);
      setErrorMessage("");

      try {
        if (initialPatientId) {
          let patientId = initialPatientId;
          if (initialVisitId) {
            const visitResponse = await authenticatedFetch(`${PATIENT_API_URL.replace(/\/patients$/, "")}/visits/${initialVisitId}`, {
              headers: { Accept: "application/json", Authorization: `Bearer ${accessToken}` }, signal: controller.signal,
            });
            if (!visitResponse.ok) throw new Error(visitResponse.status === 404 ? "This visit no longer exists or is not accessible." : `Unable to open visit (HTTP ${visitResponse.status}).`);
            const visit = await visitResponse.json() as PatientVisit;
            if (visit.id !== initialVisitId || !Number.isSafeInteger(visit.patientId) || visit.patientId <= 0) throw new Error("The requested visit could not be verified.");
            patientId = visit.patientId;
          }
          const patientResponse = await authenticatedFetch(`${PATIENT_API_URL}/${patientId}`, {
            headers: { Accept: "application/json", Authorization: `Bearer ${accessToken}` }, signal: controller.signal,
          });
          if (!patientResponse.ok) throw new Error(patientResponse.status === 404 ? "This patient no longer exists or is not accessible." : `Unable to open patient (HTTP ${patientResponse.status}).`);
          const patient = await patientResponse.json() as Patient;
          if (patient.id !== patientId) throw new Error("The requested patient could not be verified.");
          if (sequence !== requestSequence.current) return;
          setPatients([patient]); setTotalPages(1); setTotalElements(1); setCurrentPage(0); setErrorMessage("");
          await viewPatientHistory(patient);
          window.requestAnimationFrame(() => document.getElementById(initialVisitId ? `visit-record-${initialVisitId}` : `patient-record-${patientId}`)?.scrollIntoView({ block: "center", behavior: "smooth" }));
          return;
        }
        const params = new URLSearchParams({
          page: String(currentPage),
          size: String(pageSize),
        });

        if (searchTerm.trim()) {
          params.set("search", searchTerm.trim());
        }

        if (selectedGender !== "All") {
          params.set("gender", selectedGender);
        }

        const response = await authenticatedFetch(
          `${PATIENT_API_URL}/paged?${params.toString()}`,
          {
            method: "GET",
            headers: {
              Accept: "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          throw new Error(`Unable to load patients (HTTP ${response.status}).`);
        }

        const data: PatientPageResponse = await response.json();

        if (!Array.isArray(data.content)) {
          throw new Error("The server returned an unexpected patient list.");
        }

        if (sequence !== requestSequence.current) return;
        setPatients(data.content);
        setTotalPages(data.totalPages);
        setTotalElements(data.totalElements);
        setErrorMessage("");
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }

        const reason =
          error instanceof Error
            ? error.message
            : "An unexpected error occurred.";

        if (sequence === requestSequence.current) {
          setErrorMessage(
            `${reason} Check your network connection and the healthcare server.`,
          );
        }
      } finally {
        if (!controller.signal.aborted && sequence === requestSequence.current) {
          setIsLoading(false);
        }
      }
    }

    void loadPatients();

    return () => controller.abort();
  }, [accessToken, currentPage, pageSize, searchTerm, selectedGender, initialPatientId, initialVisitId]);

  const startRecord = totalElements === 0 ? 0 : currentPage * pageSize + 1;
  const endRecord = Math.min((currentPage + 1) * pageSize, totalElements);
  const visiblePageNumbers = useMemo(() => {
    const pages: number[] = [];
    const start = Math.max(0, Math.min(currentPage - 2, totalPages - 5));
    const end = Math.min(totalPages, start + 5);
    for (let page = start; page < end; page += 1) pages.push(page);
    return pages;
  }, [currentPage, totalPages]);

  const handleSearch = useCallback((value: string) => {
    setSearchTerm(value);
    setCurrentPage(0);
  }, []);

  async function loadVisitFollowUps(patientId: number) {
    setFollowUpLoadError("");
    const response = await authenticatedFetch(
      `${FOLLOW_UP_API_URL}/patients/${patientId}/follow-ups`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!response.ok) {
      throw new Error(
        `Unable to load follow-ups for patient ${patientId} (HTTP ${response.status}).`,
      );
    }

    const data: unknown = await response.json();
    if (!Array.isArray(data)) {
      throw new Error("The server returned an unexpected follow-up list.");
    }

    const next: Record<number, PatientFollowUp[]> = {};
    (data as PatientFollowUp[]).forEach((followUp) => {
      (next[followUp.visitId] ??= []).push(followUp);
    });

    setFollowUpsByVisit(next);
  }

  async function loadPatientVisits(patient: Patient) {
    setIsLoadingVisits(true);

    setVisitError("");

    setFollowUpLoadError("");

    setFollowUpsByVisit({});

    try {
      const response = await authenticatedFetch(`${PATIENT_API_URL}/${patient.id}/visits`, {
        method: "GET",

        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(
          `Unable to load visit history (HTTP ${response.status}).`,
        );
      }

      const data: unknown = await response.json();

      if (!Array.isArray(data)) {
        throw new Error("The server returned an unexpected visit history.");
      }

      const loadedVisits = data as PatientVisit[];

      setVisits(loadedVisits);

      if (loadedVisits.length > 0) {
        try {
          await loadVisitFollowUps(patient.id);
        } catch (error) {
          setFollowUpLoadError(
            error instanceof Error
              ? error.message
              : "Unable to load follow-up information.",
          );
        }
      }
    } catch (error) {
      setVisitError(
        error instanceof Error
          ? error.message
          : "An unexpected error occurred while loading visit history.",
      );
    } finally {
      setIsLoadingVisits(false);
    }
  }

  async function viewPatientHistory(patient: Patient) {
    setSelectedPatient(patient);

    setVisits([]);

    setFollowUpsByVisit({});

    await loadPatientVisits(patient);
  }

  async function saveVisitFollowUp(visit: PatientVisit) {
    const followUpDate = followUpDateInputs[visit.id] ?? "";
    const followUpNotes = (followUpNoteInputs[visit.id] ?? "").trim();

    if (!followUpDate) {
      setFollowUpSaveMessages((previous) => ({
        ...previous,
        [visit.id]: "Please select a follow-up date.",
      }));
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDate = new Date(`${followUpDate}T00:00:00`);
    if (selectedDate < today) {
      setFollowUpSaveMessages((previous) => ({
        ...previous,
        [visit.id]: "Follow-up date cannot be in the past.",
      }));
      return;
    }

    setSavingFollowUpVisitId(visit.id);
    setFollowUpSaveMessages((previous) => ({ ...previous, [visit.id]: "" }));

    try {
      const response = await authenticatedFetch(
        `${FOLLOW_UP_API_URL}/visits/${visit.id}/follow-ups`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ followUpDate, followUpNotes }),
        },
      );

      if (!response.ok) {
        const responseText = await response.text();
        throw new Error(
          responseText || `Unable to save follow-up (HTTP ${response.status}).`,
        );
      }

      setFollowUpSaveMessages((previous) => ({
        ...previous,
        [visit.id]: "Follow-up scheduled successfully.",
      }));
      notifyDashboardStatsChanged();
      setFollowUpDateInputs((previous) => ({ ...previous, [visit.id]: "" }));
      setFollowUpNoteInputs((previous) => ({ ...previous, [visit.id]: "" }));

      if (selectedPatient) {
        await loadPatientVisits(selectedPatient);
      }
    } catch (error) {
      setFollowUpSaveMessages((previous) => ({
        ...previous,
        [visit.id]:
          error instanceof Error
            ? error.message
            : "Unable to save the follow-up.",
      }));
    } finally {
      setSavingFollowUpVisitId(null);
    }
  }

  async function exportToCsv() {
    if (isExportInProgress.current) return;

    isExportInProgress.current = true;
    setIsExportingCsv(true);
    setExportError("");

    try {
      const exportUrl = new URL(`${PATIENT_API_URL}/export.csv`);
      exportUrl.searchParams.set("search", searchTerm.trim());
      exportUrl.searchParams.set("gender", selectedGender);

      const response = await authenticatedFetch(exportUrl, {
        method: "GET",
        headers: {
          Accept: "text/csv",
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`CSV export failed (HTTP ${response.status}).`);
      }

      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = "gbk-healthcare-patients.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
    } catch (error) {
      setExportError(
        error instanceof Error && error.message.startsWith("CSV export failed")
          ? error.message
          : "Unable to export patient records. Please check your connection and try again.",
      );
    } finally {
      isExportInProgress.current = false;
      setIsExportingCsv(false);
    }
  }

  function formatDate(date?: string | null) {
    if (!date) return "â€”";

    const parts = date.split("-");

    if (parts.length !== 3) return date;

    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }

  function getVisitFollowUps(visitId: number) {
    return followUpsByVisit[visitId] ?? [];
  }

  function getLatestFollowUp(visitId: number) {
    const followUps = getVisitFollowUps(visitId);

    return [...followUps]

      .filter((item) => item.status === "SCHEDULED")

      .sort((a, b) => a.followUpDate.localeCompare(b.followUpDate))[0];
  }

  function getFollowUpStatus(visitId: number) {
    const followUps = getVisitFollowUps(visitId);

    const scheduled = getLatestFollowUp(visitId);

    if (scheduled) {
      return {
        className: "follow-up-scheduled",

        label: `Follow-up: ${formatDate(scheduled.followUpDate)}`,
      };
    }

    if (followUps.some((item) => item.status === "COMPLETED")) {
      return {
        className: "follow-up-scheduled",

        label: "Follow-up completed",
      };
    }

    if (followUps.some((item) => item.status === "CANCELLED")) {
      return {
        className: "follow-up-not-scheduled",

        label: "Follow-up cancelled",
      };
    }

    return {
      className: "follow-up-not-scheduled",

      label: "No follow-up scheduled",
    };
  }

  return (
    <section className="patient-records">
      <h2>Patient Records</h2>

      <p>
        View registered patients and their read-only clinical visit history.
      </p>

      <div className="records-toolbar">
        <PatientRecordsSearch onSearch={handleSearch} />

        <select
          aria-label="Filter patients by gender"
          value={selectedGender}
          onChange={(event) => {
            setSelectedGender(event.target.value);
            setCurrentPage(0);
          }}
        >
          <option value="All">All Genders</option>

          <option value="Male">Male</option>

          <option value="Female">Female</option>

          <option value="Other">Other</option>
        </select>

        <button
          type="button"
          className="export-button"
          onClick={exportToCsv}
          disabled={isLoading || isExportingCsv}
          title={
            isExportingCsv
              ? "Exporting patient records"
              : "Export all matching patient records to CSV"
          }
        >
          {isExportingCsv ? "Exportingâ€¦" : "Export CSV"}
        </button>
      </div>

      {exportError && (
        <p className="records-message records-error" role="alert">
          {exportError}
        </p>
      )}

      <p className="records-count" aria-live="polite" aria-busy={isLoading}>
        {isLoading && patients.length === 0
          ? "Loading patient records..."
          : `Showing ${startRecord}â€“${endRecord} of ${totalElements} patients`}
        {isLoading && patients.length > 0 && (
          <span className="records-loading-indicator" role="status">
            Updating recordsâ€¦
          </span>
        )}
      </p>

      {errorMessage && (
        <div className="records-message records-error" role="alert">
          <strong>Unable to load patient records.</strong>

          <span>{errorMessage}</span>

          <button
            type="button"
            className="records-retry-button"
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
        </div>
      )}

      <div className="table-wrapper" aria-busy={isLoading}>
        <table className="records-table">
          <thead>
            <tr>
              <th>ID</th>

              <th>Patient Name</th>

              <th>Age</th>

              <th>Gender</th>

              <th>Visit Date</th>

              <th>Doctor</th>

              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {isLoading && patients.length === 0 ? (
              <tr>
                <td colSpan={7} className="empty-records">
                  Loading patient records from the database...
                </td>
              </tr>
            ) : errorMessage && patients.length === 0 ? (
              <tr>
                <td colSpan={7} className="empty-records">
                  Patient records could not be loaded.
                </td>
              </tr>
            ) : patients.length > 0 ? (
              patients.map((patient) => (
                <Fragment key={patient.id}>
                  <tr id={`patient-record-${patient.id}`} className={patient.id === initialPatientId ? "activity-target-row" : undefined}>
                    <td>{patient.id}</td>

                    <td>{patient.fullName}</td>

                    <td>{patient.age}</td>

                    <td>{patient.gender}</td>

                    <td>{formatDate(patient.visitDate)}</td>

                    <td>{patient.doctor}</td>

                    <td>
                      <button
                        type="button"
                        className="export-button"
                        onClick={() => void viewPatientHistory(patient)}
                      >
                        View History
                      </button>
                    </td>
                  </tr>
                  {selectedPatient?.id === patient.id && (
                    <tr className="patient-history-row">
                      <td colSpan={7}>
                        <section
                          className="patient-history-panel"
                          aria-labelledby="patient-history-title"
                        >
                          <div className="patient-history-header">
                            <div>
                              <h3 id="patient-history-title">
                                Visit History â€” {patient.fullName}
                              </h3>

                              <p>Patient ID: {patient.id}</p>
                            </div>

                            <button
                              type="button"
                              className="records-retry-button"
                              onClick={() => {
                                setSelectedPatient(null);

                                setVisits([]);

                                setVisitError("");

                                setFollowUpLoadError("");

                                setFollowUpsByVisit({});
                              }}
                            >
                              Close History
                            </button>
                          </div>

                          {isLoadingVisits ? (
                            <p>Loading visit history...</p>
                          ) : visitError ? (
                            <div
                              className="records-message records-error"
                              role="alert"
                            >
                              {visitError}
                            </div>
                          ) : visits.length === 0 ? (
                            <p>
                              No visit history is available for this patient.
                            </p>
                          ) : (
                            <>
                              {followUpLoadError && (
                                <div
                                  className="records-message records-error"
                                  role="alert"
                                >
                                  <strong>
                                    Follow-up information could not be loaded.
                                  </strong>

                                  <span>{followUpLoadError}</span>

                                  <p>
                                    The visit history is still available, but
                                    the follow-up status may not be current.
                                  </p>
                                </div>
                              )}

                              <div className="patient-visit-list">
                                {visits.map((visit) => {
                                  const status = getFollowUpStatus(visit.id);

                                  const scheduledFollowUp = getLatestFollowUp(
                                    visit.id,
                                  );

                                  return (
                                    <article
                                      id={`visit-record-${visit.id}`}
                                      className={`patient-visit-card${visit.id === initialVisitId ? " activity-target-card" : ""}`}
                                      key={visit.id}
                                    >
                                      <div className="patient-visit-card-header">
                                        <div className="visit-heading">
                                          <h4>Visit #{visit.visitNumber}</h4>

                                          <span className="visit-date-label">
                                            Visited:{" "}
                                            {formatDate(visit.visitDate)}
                                          </span>
                                        </div>

                                        <span
                                          className={`follow-up-badge ${status.className}`}
                                        >
                                          {status.label}
                                        </span>
                                      </div>

                                      <p>
                                        <strong>Doctor:</strong>{" "}
                                        {visit.doctor || "â€”"}
                                      </p>

                                      <p>
                                        <strong>Chief complaints:</strong>{" "}
                                        {visit.chiefComplaints || "â€”"}
                                      </p>

                                      <p>
                                        <strong>Present illness:</strong>{" "}
                                        {visit.presentIllness || "â€”"}
                                      </p>

                                      <p>
                                        <strong>Diagnosis:</strong>{" "}
                                        {visit.diagnosis || "â€”"}
                                      </p>

                                      <h5>Vital Signs</h5>

                                      <div className="patient-visit-vitals">
                                        <span>
                                          Temperature:{" "}
                                          {visit.temperature ?? "â€”"} Â°F
                                        </span>

                                        <span>
                                          Pulse: {visit.pulseRate ?? "â€”"} bpm
                                        </span>

                                        <span>SpOâ‚‚: {visit.spo2 ?? "â€”"}%</span>

                                        <span>
                                          Blood pressure:{" "}
                                          {visit.bpSystolic ?? "â€”"}/
                                          {visit.bpDiastolic ?? "â€”"}
                                        </span>
                                      </div>

                                      <h5>Examination</h5>

                                      <p>
                                        <strong>General:</strong>{" "}
                                        {visit.generalExamination || "â€”"}
                                      </p>

                                      <p>
                                        <strong>Heart:</strong>{" "}
                                        {visit.heartExamination || "â€”"}
                                      </p>

                                      <p>
                                        <strong>Lungs:</strong>{" "}
                                        {visit.lungsExamination || "â€”"}
                                      </p>

                                      <p>
                                        <strong>Abdomen:</strong>{" "}
                                        {visit.abdomenExamination || "â€”"}
                                      </p>

                                      {visit.rectalExamination && (
                                        <p>
                                          <strong>Rectal:</strong>{" "}
                                          {visit.rectalExamination}
                                        </p>
                                      )}

                                      <h5>Treatment Plan</h5>

                                      <p>{visit.treatmentPlan || "â€”"}</p>

                                      <h5>Follow-up Assessment</h5>

                                      <p>
                                        {scheduledFollowUp?.followUpNotes ||
                                          visit.followUpNotes ||
                                          "No follow-up assessment notes saved."}
                                      </p>

                                      {scheduledFollowUp && (
                                        <div className="follow-up-readonly-details">
                                          <strong>Scheduled follow-up</strong>

                                          <p>
                                            Date:{" "}
                                            {formatDate(
                                              scheduledFollowUp.followUpDate,
                                            )}
                                          </p>

                                          <p>
                                            Status:{" "}
                                            {scheduledFollowUp.status.toLowerCase()}
                                          </p>

                                          {scheduledFollowUp.followUpNotes && (
                                            <p>
                                              Notes:{" "}
                                              {scheduledFollowUp.followUpNotes}
                                            </p>
                                          )}

                                          <p>
                                            To reschedule, complete, or cancel
                                            this follow-up, open Follow-up
                                            Management.
                                          </p>
                                        </div>
                                      )}

                                      {visit.visitNumber ===
                                        Math.max(
                                          ...visits.map(
                                            (item) => item.visitNumber ?? 0,
                                          ),
                                        ) &&
                                        !scheduledFollowUp && (
                                          <div className="follow-up-form">
                                            <h5>Schedule Next Follow-up</h5>
                                            <p className="follow-up-form-description">
                                              Select the next appointment date
                                              for this latest visit. Earlier
                                              visits remain read-only.
                                            </p>
                                            <label htmlFor={`follow-up-date-${visit.id}`}>Follow-up date</label>
                                            <DatePicker
                                              id={`follow-up-date-${visit.id}`}
                                              label="Follow-up date"
                                              value={followUpDateInputs[visit.id] ?? ""}
                                              required
                                              minDate={toDateKey(new Date())}
                                              disabled={
                                                savingFollowUpVisitId ===
                                                visit.id
                                              }
                                              onChange={(date) => {
                                                setFollowUpDateInputs(
                                                  (previous) => ({
                                                    ...previous,
                                                    [visit.id]: date,
                                                  }),
                                                );
                                                setFollowUpSaveMessages(
                                                  (previous) => ({
                                                    ...previous,
                                                    [visit.id]: "",
                                                  }),
                                                );
                                              }}
                                            />
                                            <label
                                              htmlFor={`follow-up-notes-${visit.id}`}
                                            >
                                              Follow-up notes (optional)
                                            </label>
                                            <textarea
                                              id={`follow-up-notes-${visit.id}`}
                                              rows={3}
                                              maxLength={2000}
                                              value={
                                                followUpNoteInputs[visit.id] ??
                                                ""
                                              }
                                              onChange={(event) =>
                                                setFollowUpNoteInputs(
                                                  (previous) => ({
                                                    ...previous,
                                                    [visit.id]:
                                                      event.target.value,
                                                  }),
                                                )
                                              }
                                              placeholder="Enter advice or follow-up instructions"
                                              disabled={
                                                savingFollowUpVisitId ===
                                                visit.id
                                              }
                                            />
                                            <button
                                              type="button"
                                              className="export-button"
                                              onClick={() =>
                                                void saveVisitFollowUp(visit)
                                              }
                                              disabled={
                                                savingFollowUpVisitId ===
                                                visit.id
                                              }
                                            >
                                              {savingFollowUpVisitId ===
                                              visit.id
                                                ? "Saving..."
                                                : "Schedule Follow-up"}
                                            </button>
                                            {followUpSaveMessages[visit.id] && (
                                              <p
                                                role="status"
                                                aria-live="polite"
                                              >
                                                {followUpSaveMessages[visit.id]}
                                              </p>
                                            )}
                                          </div>
                                        )}
                                      <PatientClinicalReportEmail
                                        patient={patient}
                                        visit={visit}
                                        accessToken={accessToken}
                                      />
                                    </article>
                                  );
                                })}
                              </div>
                            </>
                          )}
                        </section>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="empty-records">
                  {totalElements === 0
                    ? searchTerm.trim() || selectedGender !== "All"
                      ? "No matching patient records found."
                      : "No patients have been registered yet."
                    : "No patient records are available on this page."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div
        className="records-pagination"
        aria-label="Patient records pagination"
      >
        <div className="records-pagination-info">
          <label htmlFor="patient-page-size">Rows per page</label>
          <select
            id="patient-page-size"
            value={pageSize}
            onChange={(event) => {
              setPageSize(Number(event.target.value));
              setCurrentPage(0);
            }}
            disabled={isLoading}
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
          <span>{totalElements} total records</span>
        </div>

        <div className="records-pagination-controls">
          <button
            type="button"
            className="records-page-button"
            onClick={() => setCurrentPage((page) => Math.max(0, page - 1))}
            disabled={isLoading || currentPage === 0 || totalPages === 0}
          >
            Previous
          </button>

          {visiblePageNumbers.map((page) => (
            <button
              type="button"
              key={page}
              className={`records-page-button records-page-number${
                currentPage === page ? " is-active" : ""
              }`}
              aria-current={currentPage === page ? "page" : undefined}
              aria-label={`Go to page ${page + 1}`}
              onClick={() => setCurrentPage(page)}
              disabled={isLoading}
            >
              {page + 1}
            </button>
          ))}

          <button
            type="button"
            className="records-page-button"
            onClick={() =>
              setCurrentPage((page) => Math.min(totalPages - 1, page + 1))
            }
            disabled={
              isLoading || totalPages === 0 || currentPage >= totalPages - 1
            }
          >
            Next
          </button>
        </div>
      </div>
    </section>
  );
}

export default PatientRecords;
