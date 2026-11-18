import { useCallback, useEffect, useState } from "react";
import { hasAdminAccessToken, logoutAdmin, restoreAdminSession, wasAdminLogoutConfirmed } from "../../auth/adminSession";
import { loadManagedDoctors, loadPendingDoctorApprovals } from "../../api/adminManagement";
import AdminLogin from "./AdminLogin";
import DoctorApprovals from "./DoctorApprovals";
import DoctorApprovalHistory from "./DoctorApprovalHistory";
import DoctorManagement from "./DoctorManagement";
import AdminStaffManagement from "./AdminStaffManagement";
import AdminBillingManagement from "./AdminBillingManagement";
import "./admin.css";

type Session = { accessToken: string; adminEmail: string };
type AdminSection = "overview" | "approvals" | "doctors" | "history" | "staff" | "billing";

function currentSection(): AdminSection {
  const value = new URLSearchParams(window.location.search).get("section");
  return value === "approvals" || value === "doctors" || value === "history" || value === "staff" || value === "billing" ? value : "overview";
}

function AdminApp() {
  const [session, setSession] = useState<Session | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [sessionError, setSessionError] = useState("");
  const [logoutError, setLogoutError] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  const [section, setSection] = useState<AdminSection>(currentSection);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const syncSection = useCallback(() => setSection(currentSection()), []);
  useEffect(() => {
    window.addEventListener("popstate", syncSection);
    return () => window.removeEventListener("popstate", syncSection);
  }, [syncSection]);

  useEffect(() => {
    const protectBackNavigation = (event: PageTransitionEvent) => {
      if (!event.persisted || hasAdminAccessToken()) return;
      setSession(null);
      window.location.replace(wasAdminLogoutConfirmed() ? "/" : "/admin/login");
    };
    window.addEventListener("pageshow", protectBackNavigation);
    return () => window.removeEventListener("pageshow", protectBackNavigation);
  }, []);

  const restore = useCallback(async () => {
    setInitialized(false);
    setSessionError("");
    try {
      const restored = await restoreAdminSession();
      setSession(restored ? { accessToken: restored.accessToken, adminEmail: restored.adminEmail } : null);
    } catch (error) {
      setSession(null);
      setSessionError(error instanceof Error ? error.message : "Could not verify the Admin session.");
    } finally {
      setInitialized(true);
    }
  }, []);

  useEffect(() => { void restore(); }, [restore]);
  useEffect(() => {
    const expired = () => {
      setSession(null);
      setSessionError("Your Admin session expired. Sign in again to continue.");
      window.history.replaceState({}, "", "/admin/login");
    };
    window.addEventListener("gbk-admin-session-expired", expired);
    return () => window.removeEventListener("gbk-admin-session-expired", expired);
  }, []);

  const navigate = (next: AdminSection) => {
    const url = new URL(window.location.href);
    url.pathname = "/admin/dashboard";
    url.search = "";
    if (next !== "overview") url.searchParams.set("section", next);
    window.history.pushState({}, "", url);
    setSection(next);
    setMobileNavOpen(false);
  };

  const onLogin = (next: Session) => {
    setSession(next);
    setSessionError("");
    setLogoutError("");
    setSection("overview");
    window.history.replaceState({}, "", "/admin/dashboard");
  };

  const signOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    setLogoutError("");
    try {
      await logoutAdmin();
      setSession(null);
      setSection("overview");
      window.location.replace("/");
    } catch (cause) {
      setSigningOut(false);
      setSession(null);
      setSection("overview");
      setLogoutError(cause instanceof Error ? cause.message : "Admin logout could not be confirmed. Your local session was cleared; the server session may still be active.");
      window.history.replaceState({}, "", "/admin/login");
    }
  };

  if (!initialized) return <main className="admin-auth-loading"><div className="admin-loader" /><p>Verifying secure Admin session…</p></main>;
  if (!session) return <AdminLogin onLogin={onLogin} sessionError={sessionError} logoutError={logoutError} onRetry={restore} />;

  const heading = section === "approvals" ? "Doctor approvals" : section === "doctors" ? "Doctor management" : section === "history" ? "Approval history" : section === "staff" ? "Staff management" : section === "billing" ? "Billing oversight" : "Admin overview";
  return (
    <div className={`admin-shell${sidebarCollapsed ? " is-sidebar-collapsed" : ""}`}>
      {signingOut && <div className="portal-logout-pending" role="status" aria-live="polite"><span className="portal-logout-spinner" aria-hidden="true" />Signing out securely…</div>}
      {mobileNavOpen && <button className="admin-nav-backdrop" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} />}
      <aside className={`admin-sidebar${mobileNavOpen ? " is-open" : ""}`}>
        <div className="admin-brand-row">
          <a className="admin-brand" href="/admin/dashboard" onClick={(event) => { event.preventDefault(); navigate("overview"); }}>
            <span className="admin-brand-mark" aria-hidden="true">✚</span>
            <span><strong>GBK <em>HealthCare</em></strong><small>ADMINISTRATION</small></span>
          </a>
          <button className="admin-sidebar-toggle" type="button" aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!sidebarCollapsed} aria-controls="admin-primary-navigation" title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}>{sidebarCollapsed ? "›" : "‹"}</button>
        </div>
        <div className="admin-nav-caption">WORKSPACE</div>
        <nav id="admin-primary-navigation" className="admin-navigation" aria-label="Admin navigation">
          <button title="Overview" className={section === "overview" ? "active" : ""} onClick={() => navigate("overview")}><span aria-hidden="true">▦</span>Overview</button>
          <button title="Doctor approvals" className={section === "approvals" ? "active" : ""} onClick={() => navigate("approvals")}><span aria-hidden="true">✓</span>Doctor approvals</button>
          <button title="Doctor management" className={section === "doctors" ? "active" : ""} onClick={() => navigate("doctors")}><span aria-hidden="true">♙</span>Doctor management</button>
          <button title="Approval history" className={section === "history" ? "active" : ""} onClick={() => navigate("history")}><span aria-hidden="true">◷</span>Approval history</button>
          <button title="Staff management" className={section === "staff" ? "active" : ""} onClick={() => navigate("staff")}><span aria-hidden="true">♧</span>Staff management</button>
          <button title="Billing oversight" className={section === "billing" ? "active" : ""} onClick={() => navigate("billing")}><span aria-hidden="true">₹</span>Billing oversight</button>
        </nav>
        <div className="admin-sidebar-spacer" />
        <div className="admin-sidebar-note"><span>✦</span><strong>Secure workspace</strong><p>Administrative access is separated from clinical sessions.</p></div>
        <div className="admin-sidebar-foot"><i />GBK HealthCare <span>ADMIN</span></div>
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <button className="admin-menu-button" aria-label="Open navigation" aria-expanded={mobileNavOpen} onClick={() => setMobileNavOpen(true)}>☰</button>
          <div className="admin-heading"><span>GBK HEALTHCARE · ADMIN PORTAL</span><h1>{heading}</h1></div>
          <div className="admin-top-actions"><div className="admin-identity"><span className="admin-avatar">{session.adminEmail.slice(0, 1).toUpperCase()}</span><span><strong>{session.adminEmail}</strong><small>Administrator</small></span></div><button className="admin-signout" disabled={signingOut} onClick={() => void signOut()}>{signingOut ? "Signing out…" : "Sign out"}</button></div>
        </header>
        <main className="admin-content">
          {section === "overview" ? <AdminOverview onNavigate={navigate} /> : section === "approvals" ? <DoctorApprovals adminIdentity={session.adminEmail} /> : section === "doctors" ? <DoctorManagement adminIdentity={session.adminEmail} /> : section === "staff" ? <AdminStaffManagement /> : section === "billing" ? <AdminBillingManagement /> : <DoctorApprovalHistory adminIdentity={session.adminEmail} />}
        </main>
        <footer className="admin-footer"><span>GBK HealthCare</span><span>Administration portal · Secure access</span></footer>
      </div>
    </div>
  );
}

function AdminOverview({ onNavigate }: { onNavigate: (section: AdminSection) => void }) {
  const [summary, setSummary] = useState<{ pending: number; total: number; disabled: number } | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  useEffect(() => {
    let active = true;
    setSummaryLoading(true);
    setSummaryError("");
    void Promise.all([loadPendingDoctorApprovals(), loadManagedDoctors()])
      .then(([pending, doctors]) => {
        if (active) setSummary({ pending: pending.length, total: doctors.length, disabled: doctors.filter((doctor) => !doctor.enabled).length });
      })
      .catch((error: unknown) => { if (active) setSummaryError(error instanceof Error ? error.message : "Could not load Admin overview."); })
      .finally(() => { if (active) setSummaryLoading(false); });
    return () => { active = false; };
  }, [retryKey]);
  return (
    <div className="admin-overview">
      <section className="admin-welcome">
        <div><span className="admin-eyebrow">ADMINISTRATION</span><h2>Good to see you.</h2><p>Manage doctor access and keep your clinical team organized.</p></div>
        <div className="welcome-art" aria-hidden="true"><span>✚</span><i /><b /></div>
        <div className="admin-welcome-foot"><span className="live-dot" />Private administrative workspace</div>
      </section>
      <div className="admin-metric-grid">
        <MetricCard icon="✓" label="Pending approvals" value={summaryLoading ? "…" : String(summary?.pending ?? "—")} note="Registrations awaiting review" tone="violet" />
        <MetricCard icon="♙" label="Doctor accounts" value={summaryLoading ? "…" : String(summary?.total ?? "—")} note="All registered doctor accounts" tone="blue" />
        <MetricCard icon="⌁" label="Disabled accounts" value={summaryLoading ? "…" : String(summary?.disabled ?? "—")} note="Doctor accounts currently disabled" tone="mint" />
      </div>
      {summaryError && <div className="management-feedback is-error" role="alert"><span aria-hidden="true">!</span>{summaryError}<button onClick={() => setRetryKey((key) => key + 1)}>Retry</button></div>}
      <section className="admin-quick-grid">
        <button className="admin-quick-card" onClick={() => onNavigate("approvals")}><span className="quick-icon violet">✓</span><span><strong>Review doctor approvals</strong><small>Open the approval workspace</small></span><b aria-hidden="true">→</b></button>
        <button className="admin-quick-card" onClick={() => onNavigate("doctors")}><span className="quick-icon blue">♙</span><span><strong>Manage doctor accounts</strong><small>Open account management</small></span><b aria-hidden="true">→</b></button>
      </section>
      <div className="admin-note-banner"><span aria-hidden="true">i</span><p>Overview counts are loaded from the Admin doctor management APIs.</p></div>
    </div>
  );
}

function MetricCard({ icon, label, value, note, tone }: { icon: string; label: string; value: string; note: string; tone: string }) {
  return <article className="admin-metric-card"><span className={`metric-icon ${tone}`}>{icon}</span><span className="metric-label">{label}</span><strong>{value}</strong><small>{note}</small></article>;
}

export default AdminApp;
