import { useEffect, useRef, useState } from "react";
import "./App.css";
import doctorProfileImage from "./assets/doctor-profile.jpg";
import { API_BASE_URL } from "./config/api";
import DoctorLogin from "./components/DoctorLogin";
import Navbar from "./components/Navbar";
import PatientRegistration from "./components/PatientRegistration";
import PatientRecords from "./components/PatientRecords";
import FollowUpManagement from "./components/FollowUpManagement";
import TodaysVisits from "./components/TodaysVisits";
import DoctorDirectory from "./components/DoctorDirectory";
import AppearanceSettings from "./components/AppearanceSettings";
import { ACCENT_THEME_STORAGE_KEY, DEFAULT_ACCENT_THEME, isAccentThemeId, type AccentThemeId } from "./theme";
import { authenticatedFetch, endSession, restoreSession } from "./auth/session";
import {
  cacheDashboardStats,
  clearDashboardStatsCache,
  getCachedDashboardStats,
  type DashboardStats,
} from "./dashboardStatsCache";

export type Section = "dashboard" | "registration" | "records" | "follow-ups" | "todays-visits" | "doctors" | "settings";

type DashboardActivity = {
  id: number;
  actionType:
    | "PATIENT_REGISTERED"
    | "VISIT_RECORDED"
    | "FOLLOW_UP_SCHEDULED"
    | "FOLLOW_UP_RESCHEDULED"
    | "FOLLOW_UP_COMPLETED"
    | "FOLLOW_UP_CANCELLED";
  entityType: "PATIENT" | "VISIT" | "FOLLOW_UP";
  entityId: number;
  occurredAt: string;
};

const activityLabels: Record<DashboardActivity["actionType"], string> = {
  PATIENT_REGISTERED: "Registered a new patient",
  VISIT_RECORDED: "Recorded a clinical visit",
  FOLLOW_UP_SCHEDULED: "Scheduled a follow-up",
  FOLLOW_UP_RESCHEDULED: "Rescheduled a follow-up",
  FOLLOW_UP_COMPLETED: "Completed a follow-up",
  FOLLOW_UP_CANCELLED: "Cancelled a follow-up",
};

const activityIcons: Record<DashboardActivity["actionType"], string> = {
  PATIENT_REGISTERED: "+",
  VISIT_RECORDED: "▤",
  FOLLOW_UP_SCHEDULED: "◷",
  FOLLOW_UP_RESCHEDULED: "↻",
  FOLLOW_UP_COMPLETED: "✓",
  FOLLOW_UP_CANCELLED: "×",
};

const activityRequestsByDoctor = new Map<string, Promise<DashboardActivity[]>>();

function requestRecentActivity(doctorEmail: string, accessToken: string) {
  const pendingRequest = activityRequestsByDoctor.get(doctorEmail);
  if (pendingRequest) return pendingRequest;

  const request = authenticatedFetch(`${API_BASE_URL}/api/dashboard/activity?limit=8`, {
    headers: { Accept: "application/json", Authorization: `Bearer ${accessToken}` },
  })
    .then(async (response) => {
      if (!response.ok) throw new Error(`Activity unavailable (HTTP ${response.status}).`);
      const data: unknown = await response.json();
      if (!Array.isArray(data)) throw new Error("The server returned an unexpected activity list.");
      return data as DashboardActivity[];
    })
    .finally(() => {
      if (activityRequestsByDoctor.get(doctorEmail) === request) {
        activityRequestsByDoctor.delete(doctorEmail);
      }
    });
  activityRequestsByDoctor.set(doctorEmail, request);
  return request;
}

const summaryCards: {
  label: string;
  stat: keyof DashboardStats;
  icon: string;
  tone: string;
  action: string;
  destination: Section | null;
}[] = [
  {
    label: "Patients",
    stat: "totalPatients",
    icon: "users",
    tone: "violet",
    action: "Manage",
    destination: "records",
  },
  {
    label: "Today's Visits",
    stat: "todaysVisits",
    icon: "calendar",
    tone: "orange",
    action: "View",
    destination: "todays-visits",
  },
  {
    label: "Enabled Doctor Accounts",
    stat: "availableDoctors",
    icon: "doctor",
    tone: "teal",
    action: "View",
    destination: "doctors",
  },
  {
    label: "Pending Follow-ups",
    stat: "pendingFollowUps",
    icon: "clipboard",
    tone: "lavender",
    action: "Review",
    destination: "follow-ups",
  },
];

function App() {
  const [accentTheme, setAccentTheme] = useState<AccentThemeId>(() => {
    try {
      const stored = localStorage.getItem(ACCENT_THEME_STORAGE_KEY);
      return isAccentThemeId(stored) ? stored : DEFAULT_ACCENT_THEME;
    } catch { return DEFAULT_ACCENT_THEME; }
  });
  useEffect(() => {
    document.documentElement.dataset.theme = accentTheme;
    try { localStorage.setItem(ACCENT_THEME_STORAGE_KEY, accentTheme); } catch { /* Keep the selected theme for this session if storage is unavailable. */ }
  }, [accentTheme]);
  const initialParams = new URLSearchParams(window.location.search);
  const initialSection = initialParams.get("section");
  const [activeSection, setActiveSection] = useState<Section>(initialSection === "records" || initialSection === "follow-ups" ? initialSection : "dashboard");
  const [activityTarget, setActivityTarget] = useState<{ type: "patient" | "visit" | "follow-up"; id: number } | null>(() => {
    for (const [key, type] of [["patientId", "patient"], ["visitId", "visit"], ["followUpId", "follow-up"]] as const) {
      const id = Number(initialParams.get(key));
      if (Number.isSafeInteger(id) && id > 0) return { type, id };
    }
    return null;
  });
  useEffect(() => {
    const restoreLocation = () => {
      const params = new URLSearchParams(window.location.search);
      const section = params.get("section");
      setActiveSection(section === "records" || section === "follow-ups" ? section : "dashboard");
      const pair = params.has("patientId") ? ["patient", "patientId"] as const : params.has("visitId") ? ["visit", "visitId"] as const : params.has("followUpId") ? ["follow-up", "followUpId"] as const : null;
      const id = pair ? Number(params.get(pair[1])) : NaN;
      setActivityTarget(pair && Number.isSafeInteger(id) && id > 0 ? { type: pair[0], id } : null);
    };
    window.addEventListener("popstate", restoreLocation);
    return () => window.removeEventListener("popstate", restoreLocation);
  }, []);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [authInitialized, setAuthInitialized] = useState(false);
  const [authError, setAuthError] = useState(false);
  const [authRetry, setAuthRetry] = useState(0);
  const [doctorEmail, setDoctorEmail] = useState("");
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const [isCompactViewport, setIsCompactViewport] = useState(() => window.matchMedia("(max-width: 1023px)").matches);
  const [isMobileViewport, setIsMobileViewport] = useState(() => window.matchMedia("(max-width: 767px)").matches);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem("gbk-sidebar-collapsed");
    return saved === null ? window.matchMedia("(max-width: 1023px)").matches : saved === "true";
  });

  useEffect(() => {
    let active = true;
    setAuthInitialized(false);
    setAuthError(false);
    void restoreSession().then((session) => {
      if (!active) return;
      if (session) {
        setAccessToken(session.accessToken);
        setDoctorEmail(session.doctorEmail);
      }
      setAuthInitialized(true);
    }).catch(() => {
      if (!active) return;
      setAuthError(true);
      setAuthInitialized(true);
    });
    return () => { active = false; };
  }, [authRetry]);

  useEffect(() => {
    const clearExpiredSession = () => {
      clearDashboardStatsCache();
      setAccessToken(null);
      setDoctorEmail("");
      setActiveSection("dashboard");
    };
    window.addEventListener("gbk-session-expired", clearExpiredSession);
    return () => window.removeEventListener("gbk-session-expired", clearExpiredSession);
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 1023px)");
    const update = () => setIsCompactViewport(media.matches);
    const mobileMedia = window.matchMedia("(max-width: 767px)");
    const updateMobile = () => setIsMobileViewport(mobileMedia.matches);
    media.addEventListener("change", update);
    mobileMedia.addEventListener("change", updateMobile);
    return () => { media.removeEventListener("change", update); mobileMedia.removeEventListener("change", updateMobile); };
  }, []);

  useEffect(() => {
    if (!isCompactViewport) localStorage.setItem("gbk-sidebar-collapsed", String(sidebarCollapsed));
  }, [sidebarCollapsed, isCompactViewport]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileMenuOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    if (!profileMenuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !profileMenuRef.current?.contains(event.target)) {
        setProfileMenuOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setProfileMenuOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [profileMenuOpen]);

  useEffect(() => {
    if (!mobileMenuOpen) menuButtonRef.current?.focus();
  }, [mobileMenuOpen]);

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
    "todays-visits": {
      title: "Today's Visits",
      description: "Visits recorded for today",
    },
    doctors: {
      title: "Doctor Directory",
      description: "Doctor accounts in the healthcare workspace",
    },
    settings: {
      title: "Account Settings",
      description: "Personalize your healthcare workspace",
    },
  };
  if (!authInitialized) {
    return <main className="doctor-login-page" aria-busy="true" aria-live="polite"><div style={{ gridColumn: "1 / -1", display: "grid", placeItems: "center" }}>Restoring secure session…</div></main>;
  }
  if (authError) {
    return (
      <main className="doctor-login-page" aria-live="polite">
        <div style={{ gridColumn: "1 / -1", display: "grid", placeContent: "center", justifyItems: "center", gap: 12 }}>
          <p role="alert">Could not verify your session. Check your connection and try again.</p>
          <button type="button" onClick={() => setAuthRetry((retry) => retry + 1)}>Retry</button>
        </div>
      </main>
    );
  }

  if (!accessToken) {
    return (
      <DoctorLogin
        onLogin={(token, email) => {
          clearDashboardStatsCache();
          setAccessToken(token);
          setDoctorEmail(email);
        }}
      />
    );
  }
  const currentPage = pageInfo[activeSection];

  return (
    <div className={`app-shell${sidebarCollapsed ? " sidebar-collapsed" : ""}`} data-theme={accentTheme}>
      {mobileMenuOpen && <button type="button" className="mobile-drawer-backdrop" aria-label="Close navigation menu" onClick={() => setMobileMenuOpen(false)} />}
      <Navbar activeSection={activeSection} onNavigate={setActiveSection} isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} collapsed={sidebarCollapsed} onToggleCollapsed={() => setSidebarCollapsed((collapsed) => !collapsed)} isMobile={isMobileViewport} />

      <div className="app-main">
        <header className="top-header">
          <button ref={menuButtonRef} type="button" className="mobile-menu-button" aria-label="Open navigation menu" aria-controls="primary-navigation" aria-expanded={mobileMenuOpen} onClick={() => setMobileMenuOpen(true)}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
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

            <div className="profile-menu-root" ref={profileMenuRef}>
              <button
                type="button"
                className="profile-chip"
                aria-label={`Doctor profile menu for Dr. G. Bharath Kumar${profileMenuOpen ? ", expanded" : ", collapsed"}`}
                aria-haspopup="menu"
                aria-expanded={profileMenuOpen}
                onClick={() => setProfileMenuOpen((open) => !open)}
              >
                <span className="profile-copy">
                  <strong>Dr. G. Bharath Kumar</strong>
                  <small>View profile</small>
                </span>
                <span className="profile-photo-wrap">
                  <img className="profile-avatar" src={doctorProfileImage} alt="Dr. G. Bharath Kumar" />
                  <span className="profile-online-dot" aria-label="Online" />
                </span>
              </button>
              {profileMenuOpen && (
                <div className="profile-dropdown" role="menu" aria-label="Doctor account">
                  <div className="profile-dropdown-heading">
                    <strong>GBK's Health Care Speciality Clinic</strong>
                    <span>MBBS, DA, MS (General Surgery)</span>
                    <small>{doctorEmail}</small>
                  </div>
                  <button type="button" role="menuitem" className="profile-menu-item" disabled title="Doctor profile screen is not available">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>
                    <span>View Profile</span>
                    <small>Unavailable</small>
                  </button>
                  <button type="button" role="menuitem" className="profile-menu-item" onClick={() => { setProfileMenuOpen(false); setActiveSection("settings"); }}>
                    <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.6a8 8 0 0 1-1.4.8l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.4-.8l-1.7.6-1.4-2.4 1.4-1.1a7 7 0 0 1 0-1.6l-1.4-1.1 1.4-2.4 1.7.6a8 8 0 0 1 1.4-.8l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.4.8l1.7-.6 1.4 2.4-1.4 1.1a7 7 0 0 1 0 1.6Z" transform="translate(-1 -1) scale(1.08)" /></svg>
                    <span>Account Settings</span>
                  </button>
                  <div className="profile-dropdown-divider" />
                  <button
                    type="button"
                    role="menuitem"
                    className="profile-menu-item profile-menu-signout"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      void endSession();
                      clearDashboardStatsCache();
                      setAccessToken(null);
                      setDoctorEmail("");
                      setActiveSection("dashboard");
                    }}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 17l5-5-5-5M15 12H3M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" /></svg>
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="page-content">
          {activeSection === "dashboard" ? (
            <Dashboard onNavigate={setActiveSection} accessToken={accessToken} doctorEmail={doctorEmail} onActivityNavigate={(activity) => {
              const validId = Number.isSafeInteger(activity.entityId) && activity.entityId > 0;
              const patient = activity.actionType === "PATIENT_REGISTERED" && activity.entityType === "PATIENT";
              const visit = activity.actionType === "VISIT_RECORDED" && activity.entityType === "VISIT";
              const followUp = activity.actionType.startsWith("FOLLOW_UP_") && activity.entityType === "FOLLOW_UP";
              if (!validId || !(patient || visit || followUp)) return;
              const type = patient ? "patient" : visit ? "visit" : "follow-up";
              const section = followUp ? "follow-ups" : "records";
              const url = new URL(window.location.href);
              url.search = "";
              url.searchParams.set("section", section);
              url.searchParams.set(followUp ? "followUpId" : patient ? "patientId" : "visitId", String(activity.entityId));
              window.history.pushState({}, "", url);
              setActivityTarget({ type, id: activity.entityId });
              setActiveSection(section);
            }} />
          ) : activeSection === "registration" ? (
            <PatientRegistration accessToken={accessToken} />
          ) : activeSection === "records" ? (
            <PatientRecords accessToken={accessToken} initialPatientId={activityTarget?.type === "patient" || activityTarget?.type === "visit" ? activityTarget.id : undefined} initialVisitId={activityTarget?.type === "visit" ? activityTarget.id : undefined} />
          ) : activeSection === "follow-ups" ? (
            <FollowUpManagement accessToken={accessToken} initialFollowUpId={activityTarget?.type === "follow-up" ? activityTarget.id : undefined} />
          ) : activeSection === "todays-visits" ? (
            <TodaysVisits accessToken={accessToken} />
          ) : activeSection === "doctors" ? (
            <DoctorDirectory accessToken={accessToken} />
          ) : (
            <AppearanceSettings selectedTheme={accentTheme} onSelectTheme={(theme) => setAccentTheme(theme)} onReset={() => setAccentTheme(DEFAULT_ACCENT_THEME)} />
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
  accessToken: string;
  doctorEmail: string;
  onActivityNavigate: (activity: DashboardActivity) => void;
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

function Dashboard({ onNavigate, accessToken, doctorEmail, onActivityNavigate }: DashboardProps) {
  const [request, setRequest] = useState<
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "ready"; stats: DashboardStats }
  >({ status: "loading" });
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const invalidate = () => setRetry((attempt) => attempt + 1);
    window.addEventListener("gbk-dashboard-stats-invalidated", invalidate);
    return () => window.removeEventListener("gbk-dashboard-stats-invalidated", invalidate);
  }, []);

  useEffect(() => {
    const cachedStats = getCachedDashboardStats(doctorEmail);
    if (cachedStats) {
      setRequest({ status: "ready", stats: cachedStats });
      return;
    }
    const controller = new AbortController();

    authenticatedFetch(`${API_BASE_URL}/api/dashboard/stats`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Statistics unavailable (HTTP ${response.status}).`);
        return response.json() as Promise<DashboardStats>;
      })
      .then((data) => {
        const fields: (keyof DashboardStats)[] = [
          "totalPatients", "todaysVisits", "availableDoctors",
          "pendingFollowUps", "registeredRecords", "clinicalNotes",
        ];
        if (!fields.every((field) => Number.isFinite(data[field]) && data[field] >= 0)) {
          throw new Error("The server returned invalid dashboard statistics.");
        }
        cacheDashboardStats(doctorEmail, data);
        setRequest({ status: "ready", stats: data });
      })
      .catch((requestError: unknown) => {
        if (requestError instanceof DOMException && requestError.name === "AbortError") return;
        setRequest({
          status: "error",
          message: requestError instanceof Error ? requestError.message : "Unable to load dashboard statistics.",
        });
      });

    return () => controller.abort();
  }, [accessToken, doctorEmail, retry]);

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

      <section className="dashboard-main-grid">
        <div className="dashboard-metrics-column">
      <section className="stats-grid" aria-label="Workspace overview">
        {summaryCards.map((card) => (
          <article className="stat-card" key={card.label}>
            <div className={`stat-icon ${card.tone}`}>
              <StatIcon name={card.icon} />
            </div>

            <div className="stat-content">
              <span className="stat-label">{card.label}</span>
              <strong className="stat-value">
                {request.status === "ready" ? request.stats[card.stat as keyof DashboardStats] : "—"}
              </strong>

              <button
                type="button"
                className="stat-action"
                disabled={!card.destination}
                aria-label={card.destination ? `${card.action} ${card.label}` : `${card.label} feature is unavailable`}
                onClick={() => { if (card.destination) onNavigate(card.destination); }}
              >
                {card.destination ? card.action : "Unavailable"} {card.destination && <span aria-hidden="true">→</span>}
              </button>
            </div>
          </article>
        ))}
      </section>

      {request.status === "error" && (
        <div role="alert" className="dashboard-stats-error">
          <span>{request.message}</span>
          <button type="button" onClick={() => {
            setRequest({ status: "loading" });
            clearDashboardStatsCache();
            setRetry((attempt) => attempt + 1);
          }}>Retry</button>
        </div>
      )}
      {request.status === "loading" && <p role="status" className="dashboard-stats-status">Loading live dashboard statistics…</p>}

          <RecentDoctorActivity accessToken={accessToken} doctorEmail={doctorEmail} onActivityNavigate={onActivityNavigate} />
        </div>

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


    </div>
  );
}

function RecentDoctorActivity({ accessToken, doctorEmail, onActivityNavigate }: { accessToken: string; doctorEmail: string; onActivityNavigate: (activity: DashboardActivity) => void }) {
  const [activities, setActivities] = useState<DashboardActivity[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let active = true;

    requestRecentActivity(doctorEmail, accessToken)
      .then((data) => {
        if (!active) return;
        setActivities(data);
        setStatus("ready");
      })
      .catch(() => {
        if (active) setStatus("error");
      });

    return () => { active = false; };
  }, [accessToken, doctorEmail]);

  return (
    <section className="dashboard-panel activity-panel" aria-labelledby="doctor-activity-title">
      <div className="panel-heading">
        <div>
          <h2 id="doctor-activity-title">Recent Doctor Activity</h2>
          <p>Your latest recorded actions</p>
        </div>
      </div>

      {status === "loading" && <p className="dashboard-activity-state" role="status">Loading recent activity…</p>}
      {status === "error" && <p className="dashboard-activity-state" role="alert">Recent activity is unavailable right now.</p>}
      {status === "ready" && activities.length === 0 && (
        <p className="dashboard-activity-state">No doctor activity has been recorded yet.</p>
      )}
      {status === "ready" && activities.length > 0 && (
        <div className="activity-list">
          {activities.map((activity) => {
              const supported = Number.isSafeInteger(activity.entityId) && activity.entityId > 0 && (
                (activity.actionType === "PATIENT_REGISTERED" && activity.entityType === "PATIENT") ||
                (activity.actionType === "VISIT_RECORDED" && activity.entityType === "VISIT") ||
                (activity.actionType.startsWith("FOLLOW_UP_") && activity.entityType === "FOLLOW_UP")
              );
              const contents = <>
              <span className={`activity-symbol ${activity.actionType === "FOLLOW_UP_CANCELLED" ? "blue" : "violet"}`} aria-hidden="true">
                {activityIcons[activity.actionType]}
              </span>
              <span className="activity-copy">
                <strong>{activityLabels[activity.actionType]}</strong>
                <small>
                  {activity.entityType === "PATIENT" ? "Patient" : activity.entityType === "VISIT" ? "Visit" : "Follow-up"} #{activity.entityId}
                </small>
              </span>
              <time className="activity-time" dateTime={activity.occurredAt}>
                {new Intl.DateTimeFormat("en-IN", {
                  dateStyle: "medium",
                  timeStyle: "short",
                  timeZone: "Asia/Kolkata",
                }).format(new Date(activity.occurredAt))}
              </time>
              {supported && <span className="activity-navigation-arrow" aria-hidden="true">›</span>}
              </>;
              return supported ? <button type="button" className="activity-row activity-row-clickable" key={activity.id} onClick={() => onActivityNavigate(activity)} aria-label={`Open ${activity.entityType.toLowerCase()} ${activity.entityId}: ${activityLabels[activity.actionType]}`}>{contents}</button> : <div className="activity-row" key={activity.id}>{contents}</div>;
          })}
        </div>
      )}
    </section>
  );
}

export default App;
