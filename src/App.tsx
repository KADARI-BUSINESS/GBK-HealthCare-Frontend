import { useState } from "react";
import "./App.css";
import Navbar from "./components/Navbar";
import PatientRegistration from "./components/PatientRegistration";
import PatientRecords from "./components/PatientRecords";

export type Section = "dashboard" | "registration" | "records" | "follow-ups";

const summaryCards = [
  {
    label: "Patients",
    value: "128",
    icon: "users",
    tone: "violet",
    action: "Manage",
  },
  {
    label: "Today's Visits",
    value: "12",
    icon: "calendar",
    tone: "blue",
    action: "View",
  },
  {
    label: "Available Doctors",
    value: "08",
    icon: "doctor",
    tone: "cyan",
    action: "Manage",
  },
  {
    label: "Pending Reviews",
    value: "05",
    icon: "clipboard",
    tone: "orange",
    action: "Review",
  },
  {
    label: "Registered Records",
    value: "128",
    icon: "folder",
    tone: "blue",
    action: "Manage",
  },
  {
    label: "Clinical Notes",
    value: "24",
    icon: "notes",
    tone: "violet",
    action: "Manage",
  },
];

const operationalItems = [
  { label: "Patient registration", status: "Ready", tone: "success" },
  { label: "Patient records", status: "Available", tone: "success" },
  { label: "Doctor assignment", status: "Configured", tone: "info" },
  { label: "Backend connection", status: "Not connected", tone: "muted" },
];

function App() {
  const [activeSection, setActiveSection] = useState<Section>("dashboard");

  const pageInfo: Record<Section, { title: string; description: string }> = {
    dashboard: {
      title: "Dashboard",
      description: "Overview of your healthcare workspace",
    },
    registration: {
      title: "Patient Registration",
      description: "Create and maintain patient medical profiles",
    },
    records: {
      title: "Patient Records",
      description: "Search and manage registered patient information",
    },
    "follow-ups": {
      title: "Follow-up Management",
      description: "Schedule and manage patient follow-up appointments",
    },
  };

  const currentPage = pageInfo[activeSection];

  return (
    <div className="app-shell">
      <Navbar activeSection={activeSection} onNavigate={setActiveSection} />

      <div className="app-main">
        <header className="top-header">
          <div className="top-header-title">
            <span className="header-overline">GBK HEALTHCARE</span>
            <h1>{currentPage.title}</h1>
          </div>

          <div className="header-actions">
            <span className="system-status">
              <span className="status-dot" />
              Workspace active
            </span>

            <button
              type="button"
              className="header-icon-button"
              aria-label="Notifications"
              title="Notifications"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
              </svg>
            </button>

            <div className="profile-chip">
              <span className="profile-avatar">GB</span>
              <span className="profile-copy">
                <strong>Admin</strong>
                <small>Workspace</small>
              </span>
            </div>
          </div>
        </header>

        <main className="page-content">
          {activeSection === "dashboard" ? (
            <Dashboard onNavigate={setActiveSection} />
          ) : activeSection === "registration" ? (
            <PatientRegistration />
          ) : activeSection === "records" ? (
            <PatientRecords />
          ) : (
            <PatientRecords />
          )}
        </main>

        <footer className="app-footer">
          <span>GBK HealthCare</span>
          <span>Patient Management System</span>
        </footer>
      </div>
    </div>
  );
}

type DashboardProps = {
  onNavigate: (section: Section) => void;
};

function StatIcon({ name }: { name: string }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...common}>
      {name === "users" && (
        <>
          <circle cx="9" cy="8" r="3.5" />
          <path d="M2.5 20v-1.5a6.5 6.5 0 0 1 13 0V20M16 5a3.5 3.5 0 0 1 0 7M18 15a5.5 5.5 0 0 1 3.5 5" />
        </>
      )}

      {name === "calendar" && (
        <>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M16 3v4M8 3v4M3 10h18M8 14h3M8 17h7" />
        </>
      )}

      {name === "doctor" && (
        <>
          <circle cx="12" cy="7" r="4" />
          <path d="M4 21v-2a8 8 0 0 1 16 0v2M9 14l3 3 3-3M12 17v4" />
        </>
      )}

      {name === "clipboard" && (
        <>
          <rect x="5" y="4" width="14" height="17" rx="2" />
          <path d="M9 4V2h6v2M9 10h6M9 14h6M9 18h3" />
        </>
      )}

      {name === "folder" && (
        <path d="M3 7a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 10h18" />
      )}

      {name === "notes" && (
        <>
          <rect x="5" y="3" width="14" height="18" rx="2" />
          <path d="M9 8h6M9 12h6M9 16h4" />
        </>
      )}
    </svg>
  );
}

function Dashboard({ onNavigate }: DashboardProps) {
  return (
    <div className="dashboard">
      <section className="welcome-panel">
        <div className="welcome-copy">
          <span className="welcome-eyebrow">CLINICAL OVERVIEW</span>
          <h2>Welcome to your healthcare workspace.</h2>
          <p>
            Access patient information, register new patients, and keep your
            clinical workflow organized.
          </p>
        </div>

        <div className="welcome-actions">
          <button
            type="button"
            className="button-primary"
            onClick={() => onNavigate("records")}
          >
            View patients <span aria-hidden="true">→</span>
          </button>

          <button
            type="button"
            className="button-secondary"
            onClick={() => onNavigate("registration")}
          >
            + New patient
          </button>
        </div>
      </section>

      <section className="stats-grid" aria-label="Workspace overview">
        {summaryCards.map((card) => (
          <article className="stat-card" key={card.label}>
            <div className={`stat-icon ${card.tone}`}>
              <StatIcon name={card.icon} />
            </div>

            <div className="stat-content">
              <span className="stat-label">{card.label}</span>
              <strong className="stat-value">{card.value}</strong>

              <button
                type="button"
                className="stat-action"
                onClick={() =>
                  onNavigate(
                    card.label === "Today's Visits" ||
                      card.label === "Patients" ||
                      card.label === "Registered Records"
                      ? "records"
                      : "registration",
                  )
                }
              >
                {card.action} <span aria-hidden="true">→</span>
              </button>
            </div>
          </article>
        ))}
      </section>

      <section className="dashboard-main-grid">
        <article className="dashboard-panel operational-panel">
          <div className="panel-heading">
            <div>
              <h2>Operational focus</h2>
              <p>Current workspace readiness</p>
            </div>
            <span className="panel-heading-icon">✦</span>
          </div>

          <div className="operational-list">
            {operationalItems.map((item) => (
              <div className="operational-row" key={item.label}>
                <span className="operational-marker" />
                <span className="operational-label">{item.label}</span>
                <span className={`status-pill ${item.tone}`}>
                  {item.status}
                </span>
              </div>
            ))}
          </div>

          <p className="panel-note">
            Status reflects the current frontend setup, not live hospital
            infrastructure.
          </p>
        </article>

        <article className="dashboard-panel quick-actions-panel">
          <div className="panel-heading">
            <div>
              <h2>Quick actions</h2>
              <p>Common tasks</p>
            </div>
          </div>

          <button
            type="button"
            className="quick-action"
            onClick={() => onNavigate("registration")}
          >
            <span className="quick-action-icon violet">＋</span>
            <span className="quick-action-copy">
              <strong>New patient</strong>
              <small>Register a patient profile</small>
            </span>
            <span className="quick-action-arrow">→</span>
          </button>

          <button
            type="button"
            className="quick-action"
            onClick={() => onNavigate("records")}
          >
            <span className="quick-action-icon blue">▤</span>
            <span className="quick-action-copy">
              <strong>View patient records</strong>
              <small>Search existing records</small>
            </span>
            <span className="quick-action-arrow">→</span>
          </button>

          <button
            type="button"
            className="quick-action"
            onClick={() => onNavigate("follow-ups")}
          >
            <span className="quick-action-icon violet">▦</span>
            <span className="quick-action-copy">
              <strong>Manage follow-ups</strong>
              <small>View scheduled appointments</small>
            </span>
            <span className="quick-action-arrow">→</span>
          </button>
        </article>
      </section>

      <section className="dashboard-panel activity-panel">
        <div className="panel-heading">
          <div>
            <h2>Recent activity</h2>
            <p>Available workspace features</p>
          </div>
          <span className="demo-label">DEMO CONTENT</span>
        </div>

        <div className="activity-list">
          <div className="activity-row">
            <span className="activity-symbol violet">＋</span>
            <span className="activity-copy">
              <strong>Patient registration</strong>
              <small>Register and maintain patient information</small>
            </span>
            <button
              type="button"
              className="activity-link"
              onClick={() => onNavigate("registration")}
            >
              Open <span aria-hidden="true">→</span>
            </button>
          </div>

          <div className="activity-row">
            <span className="activity-symbol blue">▤</span>
            <span className="activity-copy">
              <strong>Patient records</strong>
              <small>Search and filter registered patients</small>
            </span>
            <button
              type="button"
              className="activity-link"
              onClick={() => onNavigate("records")}
            >
              Open <span aria-hidden="true">→</span>
            </button>
          </div>

          <div className="activity-row">
            <span className="activity-symbol violet">▦</span>
            <span className="activity-copy">
              <strong>Follow-up management</strong>
              <small>Track upcoming and completed follow-ups</small>
            </span>
            <button
              type="button"
              className="activity-link"
              onClick={() => onNavigate("follow-ups")}
            >
              Open <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      </section>

      <p className="dashboard-disclaimer">
        Dashboard counts are illustrative demo values. Live statistics will be
        displayed after backend integration.
      </p>
    </div>
  );
}

export default App;
