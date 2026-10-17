import type { Section } from "../App";
import "./Navbar.css";

type NavbarProps = {
  activeSection: Section;
  onNavigate: (section: Section) => void;
};

function Navbar({ activeSection, onNavigate }: NavbarProps) {
  const navigation = [
    { id: "dashboard" as const, label: "Dashboard", icon: "grid" },
    {
      id: "registration" as const,
      label: "Register Patient",
      icon: "user-plus",
    },
    {
      id: "records" as const,
      label: "Patient Records",
      icon: "folder",
    },
    {
      id: "follow-ups" as const,
      label: "Follow-up Management",
      icon: "calendar",
    },
  ];

  return (
    <aside className="app-sidebar">
      <button
        type="button"
        className="sidebar-brand"
        onClick={() => onNavigate("dashboard")}
        aria-label="Open GBK HealthCare dashboard"
      >
        <span className="sidebar-brand-mark" aria-hidden="true">
          <svg viewBox="0 0 32 32">
            <path d="M13 5h6v8h8v6h-8v8h-6v-8H5v-6h8z" />
          </svg>
        </span>

        <span className="sidebar-brand-text">
          <strong>
            GBK <span>HealthCare</span>
          </strong>
          <small>CLINICAL MANAGEMENT</small>
        </span>
      </button>

      <div className="sidebar-divider" />

      <div className="sidebar-section-label">WORKSPACE</div>

      <nav className="sidebar-navigation" aria-label="Main navigation">
        {navigation.map((item) => (
          <button
            type="button"
            key={item.id}
            className={`sidebar-link ${
              activeSection === item.id ? "active" : ""
            }`}
            aria-current={activeSection === item.id ? "page" : undefined}
            onClick={() => onNavigate(item.id)}
          >
            <span className="sidebar-link-icon" aria-hidden="true">
              {item.icon === "grid" && (
                <svg viewBox="0 0 24 24">
                  <rect x="3" y="3" width="7" height="7" rx="1.5" />
                  <rect x="14" y="3" width="7" height="7" rx="1.5" />
                  <rect x="3" y="14" width="7" height="7" rx="1.5" />
                  <rect x="14" y="14" width="7" height="7" rx="1.5" />
                </svg>
              )}

              {item.icon === "user-plus" && (
                <svg viewBox="0 0 24 24">
                  <circle cx="9" cy="8" r="4" />
                  <path d="M2 21v-2a7 7 0 0 1 14 0v2M19 8v8M15 12h8" />
                </svg>
              )}

              {item.icon === "folder" && (
                <svg viewBox="0 0 24 24">
                  <path d="M3 6a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <path d="M3 9h18" />
                </svg>
              )}

              {item.icon === "calendar" && (
                <svg viewBox="0 0 24 24">
                  <rect x="3" y="5" width="18" height="16" rx="2" />
                  <path d="M16 3v4M8 3v4M3 10h18M8 14h3M8 17h5" />
                </svg>
              )}
            </span>

            <span className="sidebar-link-label">{item.label}</span>

            {activeSection === item.id && (
              <span className="sidebar-active-indicator" />
            )}
          </button>
        ))}
      </nav>

      <div className="sidebar-spacer" />

      <div className="sidebar-help-card">
        <span className="help-icon" aria-hidden="true">
          ✦
        </span>
        <strong>Clinical workspace</strong>
        <p>Patient information in one organized place.</p>
      </div>

      <div className="sidebar-footer">
        <span className="sidebar-footer-dot" />
        <span>GBK HealthCare</span>
        <span className="sidebar-version">v1.0</span>
      </div>
    </aside>
  );
}

export default Navbar;
