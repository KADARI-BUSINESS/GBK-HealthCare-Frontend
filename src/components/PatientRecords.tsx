import { Fragment, useEffect, useMemo, useRef, useState } from "react";

import "./PatientRecords.css";
import "./PatientRecordsCalendar.css";

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

const API_URL = "http://localhost:8080/api/patients";

const FOLLOW_UP_API_URL = "http://localhost:8080/api";

type FollowUpCalendarProps = {
  selectedDate: string;
  minDate: string;
  disabled?: boolean;
  onSelect: (date: string) => void;
};

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function displayDate(dateKey: string): string {
  if (!dateKey) return "Choose follow-up date";
  const date = new Date(`${dateKey}T12:00:00`);
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function FollowUpCalendar({
  selectedDate,
  minDate,
  disabled = false,
  onSelect,
}: FollowUpCalendarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const calendarRef = useRef<HTMLDivElement>(null);
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const initial = selectedDate
      ? new Date(`${selectedDate}T12:00:00`)
      : new Date();
    return new Date(initial.getFullYear(), initial.getMonth(), 1);
  });

  useEffect(() => {
    if (selectedDate) {
      const selected = new Date(`${selectedDate}T12:00:00`);
      setVisibleMonth(new Date(selected.getFullYear(), selected.getMonth(), 1));
    }
  }, [selectedDate]);

  const monthLabel = visibleMonth.toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
  const firstDay = new Date(
    visibleMonth.getFullYear(),
    visibleMonth.getMonth(),
    1,
  );
  const gridStart = new Date(firstDay);
  gridStart.setDate(firstDay.getDate() - firstDay.getDay());
  const days = Array.from({ length: 42 }, (_, index) => {
    const day = new Date(gridStart);
    day.setDate(gridStart.getDate() + index);
    return { date: day, key: toDateKey(day) };
  });
  const todayKey = toDateKey(new Date());
  const currentYear = new Date().getFullYear();
  // A broad future range makes long-term appointment dates quick to choose.
  const firstYear = Math.min(currentYear, visibleMonth.getFullYear());
  const lastYear = Math.max(currentYear + 50, visibleMonth.getFullYear());
  const years = Array.from(
    { length: lastYear - firstYear + 1 },
    (_, index) => firstYear + index,
  );

  useEffect(() => {
    if (!isOpen) return;

    function handleOutsidePointer(event: MouseEvent) {
      if (
        calendarRef.current &&
        event.target instanceof Node &&
        !calendarRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }

    document.addEventListener("mousedown", handleOutsidePointer);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutsidePointer);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  function setMonth(month: number) {
    setVisibleMonth((current) => new Date(current.getFullYear(), month, 1));
  }

  function setYear(year: number) {
    setVisibleMonth((current) => new Date(year, current.getMonth(), 1));
  }

  function changeMonth(amount: number) {
    setVisibleMonth(
      (current) =>
        new Date(current.getFullYear(), current.getMonth() + amount, 1),
    );
  }

  function showToday() {
    const today = new Date();
    setVisibleMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    if (todayKey >= minDate) {
      onSelect(todayKey);
      setIsOpen(false);
    }
  }

  function chooseDate(dateKey: string) {
    onSelect(dateKey);
    setIsOpen(false);
  }

  return (
    <div className="follow-up-date-picker" ref={calendarRef}>
      <button
        type="button"
        className={`follow-up-date-trigger${isOpen ? " is-open" : ""}`}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        disabled={disabled}
      >
        <span className="follow-up-date-trigger-icon" aria-hidden="true">
          ▦
        </span>
        <span className={selectedDate ? "has-date" : "placeholder-date"}>
          {displayDate(selectedDate)}
        </span>
        <span className="follow-up-date-trigger-action">
          {isOpen ? "Close" : "Select date"}
        </span>
      </button>

      {isOpen && (
        <div
          className="follow-up-calendar-popover"
          role="dialog"
          aria-label="Choose follow-up date"
        >
          <div className="follow-up-calendar-header">
            <button
              type="button"
              className="calendar-nav-button"
              aria-label="Previous month"
              onClick={() => changeMonth(-1)}
              disabled={disabled}
            >
              ‹
            </button>
            <div className="follow-up-calendar-month-selects">
              <select
                aria-label="Calendar month"
                value={visibleMonth.getMonth()}
                onChange={(event) => setMonth(Number(event.target.value))}
                disabled={disabled}
              >
                {Array.from({ length: 12 }, (_, month) => (
                  <option key={month} value={month}>
                    {new Date(2020, month, 1).toLocaleDateString("en-IN", {
                      month: "long",
                    })}
                  </option>
                ))}
              </select>
              <select
                aria-label="Calendar year"
                value={visibleMonth.getFullYear()}
                onChange={(event) => setYear(Number(event.target.value))}
                disabled={disabled}
              >
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className="calendar-nav-button"
              aria-label="Next month"
              onClick={() => changeMonth(1)}
              disabled={disabled}
            >
              ›
            </button>
          </div>

          <p className="follow-up-calendar-helper">
            Choose a date · Select month and year to jump quickly
          </p>
          <div className="follow-up-calendar-weekdays" aria-hidden="true">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>

          <div className="follow-up-calendar-grid">
            {days.map(({ date, key }) => {
              const inCurrentMonth =
                date.getMonth() === visibleMonth.getMonth();
              const isPast = key < minDate;
              const isSelected = key === selectedDate;
              const isToday = key === todayKey;
              return (
                <button
                  type="button"
                  key={key}
                  className={[
                    "follow-up-calendar-day",
                    !inCurrentMonth ? "is-outside-month" : "",
                    isSelected ? "is-selected" : "",
                    isToday ? "is-today" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  aria-label={date.toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                  aria-pressed={isSelected}
                  disabled={disabled || isPast}
                  onClick={() => chooseDate(key)}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>

          <div className="follow-up-calendar-footer">
            <span>
              {selectedDate
                ? `Selected: ${displayDate(selectedDate)}`
                : "No date selected"}
            </span>
            <button type="button" onClick={showToday} disabled={disabled}>
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function PatientRecords() {
  const [patients, setPatients] = useState<Patient[]>([]);

  const [searchTerm, setSearchTerm] = useState("");

  const [selectedGender, setSelectedGender] = useState("All");

  const [isLoading, setIsLoading] = useState(true);

  const [errorMessage, setErrorMessage] = useState("");

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

    async function loadPatients() {
      setIsLoading(true);

      setErrorMessage("");

      try {
        const response = await fetch(API_URL, {
          method: "GET",

          headers: { Accept: "application/json" },

          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Unable to load patients (HTTP ${response.status}).`);
        }

        const data: unknown = await response.json();

        if (!Array.isArray(data)) {
          throw new Error("The server returned an unexpected patient list.");
        }

        setPatients(data as Patient[]);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }

        const reason =
          error instanceof Error
            ? error.message
            : "An unexpected error occurred.";

        setErrorMessage(
          `${reason} Check that the Spring Boot backend is running at ${API_URL}.`,
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void loadPatients();

    return () => controller.abort();
  }, []);

  const filteredPatients = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return patients.filter((patient) => {
      const matchesSearch =
        String(patient.id).includes(search) ||
        (patient.fullName ?? "").toLowerCase().includes(search) ||
        (patient.doctor ?? "").toLowerCase().includes(search) ||
        (patient.gender ?? "").toLowerCase().includes(search) ||
        (patient.phone ?? "").includes(search);

      const matchesGender =
        selectedGender === "All" || patient.gender === selectedGender;

      return matchesSearch && matchesGender;
    });
  }, [patients, searchTerm, selectedGender]);

  async function loadVisitFollowUps(loadedVisits: PatientVisit[]) {
    setFollowUpLoadError("");

    const results = await Promise.all(
      loadedVisits.map(async (visit) => {
        const response = await fetch(
          `${FOLLOW_UP_API_URL}/visits/${visit.id}/follow-ups`,

          {
            method: "GET",

            headers: { Accept: "application/json" },
          },
        );

        if (!response.ok) {
          throw new Error(
            `Unable to load follow-ups for visit ${visit.id} (HTTP ${response.status}).`,
          );
        }

        const data: unknown = await response.json();

        if (!Array.isArray(data)) {
          throw new Error(
            `The server returned an unexpected follow-up list for visit ${visit.id}.`,
          );
        }

        return {
          visitId: visit.id,

          followUps: data as PatientFollowUp[],
        };
      }),
    );

    const next: Record<number, PatientFollowUp[]> = {};

    results.forEach(({ visitId, followUps }) => {
      next[visitId] = followUps;
    });

    setFollowUpsByVisit(next);
  }

  async function loadPatientVisits(patient: Patient) {
    setIsLoadingVisits(true);

    setVisitError("");

    setFollowUpLoadError("");

    setFollowUpsByVisit({});

    try {
      const response = await fetch(`${API_URL}/${patient.id}/visits`, {
        method: "GET",

        headers: { Accept: "application/json" },
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
          await loadVisitFollowUps(loadedVisits);
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
      const response = await fetch(
        `${FOLLOW_UP_API_URL}/visits/${visit.id}/follow-ups`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
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

  function exportToCsv() {
    if (filteredPatients.length === 0) return;

    const columns: Array<keyof Patient> = [
      "id",

      "fullName",

      "age",

      "gender",

      "visitDate",

      "phone",

      "email",

      "doctor",

      "chiefComplaints",
    ];

    const escapeCsv = (value: unknown) => {
      const text = value == null ? "" : String(value);

      return `"${text.replace(/"/g, '""')}"`;
    };

    const csv = [
      columns.map(escapeCsv).join(","),

      ...filteredPatients.map((patient) =>
        columns.map((column) => escapeCsv(patient[column])).join(","),
      ),
    ].join("\r\n");

    const blob = new Blob(["\uFEFF", csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;

    link.download = "gbk-healthcare-patients.csv";

    document.body.appendChild(link);

    link.click();

    link.remove();

    URL.revokeObjectURL(url);
  }

  function formatDate(date?: string | null) {
    if (!date) return "—";

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
        <input
          type="search"
          placeholder="Search by patient, doctor, gender, phone, or ID..."
          aria-label="Search patient records"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
        />

        <select
          aria-label="Filter patients by gender"
          value={selectedGender}
          onChange={(event) => setSelectedGender(event.target.value)}
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
          disabled={isLoading || filteredPatients.length === 0}
          title={
            filteredPatients.length === 0
              ? "There are no patient records to export"
              : "Export filtered patient records to CSV"
          }
        >
          Export CSV
        </button>
      </div>

      <p className="records-count" aria-live="polite">
        {isLoading
          ? "Loading patient records..."
          : `Showing ${filteredPatients.length} of ${patients.length} patients`}
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

      <div className="table-wrapper">
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
            {isLoading ? (
              <tr>
                <td colSpan={7} className="empty-records">
                  Loading patient records from the database...
                </td>
              </tr>
            ) : errorMessage ? (
              <tr>
                <td colSpan={7} className="empty-records">
                  Patient records could not be loaded.
                </td>
              </tr>
            ) : filteredPatients.length > 0 ? (
              filteredPatients.map((patient) => (
                <Fragment key={patient.id}>
                  <tr>
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
                                Visit History — {patient.fullName}
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
                                      className="patient-visit-card"
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
                                        {visit.doctor || "—"}
                                      </p>

                                      <p>
                                        <strong>Chief complaints:</strong>{" "}
                                        {visit.chiefComplaints || "—"}
                                      </p>

                                      <p>
                                        <strong>Present illness:</strong>{" "}
                                        {visit.presentIllness || "—"}
                                      </p>

                                      <p>
                                        <strong>Diagnosis:</strong>{" "}
                                        {visit.diagnosis || "—"}
                                      </p>

                                      <h5>Vital Signs</h5>

                                      <div className="patient-visit-vitals">
                                        <span>
                                          Temperature:{" "}
                                          {visit.temperature ?? "—"} °F
                                        </span>

                                        <span>
                                          Pulse: {visit.pulseRate ?? "—"} bpm
                                        </span>

                                        <span>SpO₂: {visit.spo2 ?? "—"}%</span>

                                        <span>
                                          Blood pressure:{" "}
                                          {visit.bpSystolic ?? "—"}/
                                          {visit.bpDiastolic ?? "—"}
                                        </span>
                                      </div>

                                      <h5>Examination</h5>

                                      <p>
                                        <strong>General:</strong>{" "}
                                        {visit.generalExamination || "—"}
                                      </p>

                                      <p>
                                        <strong>Heart:</strong>{" "}
                                        {visit.heartExamination || "—"}
                                      </p>

                                      <p>
                                        <strong>Lungs:</strong>{" "}
                                        {visit.lungsExamination || "—"}
                                      </p>

                                      <p>
                                        <strong>Abdomen:</strong>{" "}
                                        {visit.abdomenExamination || "—"}
                                      </p>

                                      {visit.rectalExamination && (
                                        <p>
                                          <strong>Rectal:</strong>{" "}
                                          {visit.rectalExamination}
                                        </p>
                                      )}

                                      <h5>Treatment Plan</h5>

                                      <p>{visit.treatmentPlan || "—"}</p>

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
                                            <label>Follow-up date</label>
                                            <FollowUpCalendar
                                              selectedDate={
                                                followUpDateInputs[visit.id] ??
                                                ""
                                              }
                                              minDate={toDateKey(new Date())}
                                              disabled={
                                                savingFollowUpVisitId ===
                                                visit.id
                                              }
                                              onSelect={(date) => {
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
                  {patients.length === 0
                    ? "No patients have been registered yet."
                    : "No matching patient records found."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default PatientRecords;
