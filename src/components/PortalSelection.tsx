import "./PortalSelection.css";

type PortalIconName = "shield" | "stethoscope" | "users";

const portals: {
  title: string;
  description: string;
  href: string;
  icon: PortalIconName;
  action: string;
  index: string;
}[] = [
  {
    title: "Administration",
    description:
      "Manage doctors, staff, approvals, services and clinic operations.",
    href: "/admin/login",
    icon: "shield",
    action: "Enter Admin Portal",
    index: "01",
  },
  {
    title: "Clinical Care",
    description:
      "Access patient records, consultations, prescriptions and clinical workflows.",
    href: "/login",
    icon: "stethoscope",
    action: "Enter Doctor Portal",
    index: "02",
  },
  {
    title: "Clinic Staff",
    description: "Manage Reception, Nursing and Checkout operations.",
    href: "/staff/login",
    icon: "users",
    action: "Enter Staff Portal",
    index: "03",
  },
];

function PortalIcon({ name }: { name: PortalIconName }) {
  const commonProps = {
    "aria-hidden": true as const,
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.7,
    viewBox: "0 0 24 24",
  };

  if (name === "shield") {
    return (
      <svg {...commonProps}>
        <path d="M12 3.2 19 6v5.5c0 4.5-2.9 7.7-7 9.3-4.1-1.6-7-4.8-7-9.3V6l7-2.8Z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    );
  }

  if (name === "stethoscope") {
    return (
      <svg {...commonProps}>
        <path d="M6.5 4.5v5a4 4 0 0 0 8 0v-5" />
        <path d="M4.5 4.5h4M12.5 4.5h4M16.5 12v2.5a3 3 0 0 0 6 0v-1" />
        <circle cx="19.5" cy="11.5" r="1.5" />
        <path d="M10.5 13.5v1a5 5 0 0 0 10 0" />
      </svg>
    );
  }

  return (
    <svg {...commonProps}>
      <path d="M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20" />
      <circle cx="9" cy="7" r="3.5" />
      <path d="M22 20v-1.5a4 4 0 0 0-3-3.9M15 3.7a3.5 3.5 0 0 1 0 6.7" />
    </svg>
  );
}

function CareNetworkIllustration() {
  return (
    <div className="portal-hero-art" aria-hidden="true">
      <div className="portal-hero-art__halo portal-hero-art__halo--outer" />
      <div className="portal-hero-art__halo portal-hero-art__halo--inner" />
      <svg className="portal-network" viewBox="0 0 560 480" fill="none">
        <defs>
          <linearGradient id="network-line" x1="113" y1="62" x2="450" y2="411">
            <stop stopColor="#A799F5" />
            <stop offset="1" stopColor="#9077E8" />
          </linearGradient>
          <linearGradient id="network-core" x1="219" y1="151" x2="344" y2="313">
            <stop stopColor="#8067E0" />
            <stop offset="1" stopColor="#6548C4" />
          </linearGradient>
          <filter id="network-shadow" x="170" y="115" width="220" height="232" colorInterpolationFilters="sRGB" filterUnits="userSpaceOnUse">
            <feGaussianBlur in="SourceAlpha" stdDeviation="16" />
            <feOffset dy="12" />
            <feComponentTransfer>
              <feFuncA type="linear" slope=".18" />
            </feComponentTransfer>
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <circle cx="280" cy="240" r="184" stroke="#DCD8F4" strokeDasharray="2 8" />
        <circle cx="280" cy="240" r="142" stroke="#E4E8F4" />
        <path d="m112 116 101 73m134-66-72 56m144 12-86 48m-99 139 33-80m-154 25 86-47m-67-147 47 138" stroke="url(#network-line)" strokeWidth="1.5" />
        <path d="M123 116h81m179 77h79m-315 99 72-2m119 95 59 31m-24-344 28-29" stroke="#C9C6E8" strokeDasharray="3 5" />
        <g filter="url(#network-shadow)">
          <circle cx="280" cy="240" r="73" fill="url(#network-core)" />
          <circle cx="280" cy="240" r="60" stroke="white" strokeOpacity=".24" />
          <path d="M271 210h18v21h21v18h-21v21h-18v-21h-21v-18h21v-21Z" fill="white" />
        </g>
        <g fill="#FAFAFC" stroke="url(#network-line)" strokeWidth="2">
          <circle cx="112" cy="116" r="18" />
          <circle cx="347" cy="123" r="15" />
          <circle cx="419" cy="239" r="20" />
          <circle cx="152" cy="333" r="16" />
          <circle cx="311" cy="384" r="18" />
          <circle cx="213" cy="189" r="7" />
          <circle cx="357" cy="267" r="7" />
        </g>
        <g fill="#7254D6">
          <circle cx="112" cy="116" r="4" />
          <circle cx="347" cy="123" r="3.5" />
          <circle cx="419" cy="239" r="4" />
          <circle cx="152" cy="333" r="3.5" />
          <circle cx="311" cy="384" r="4" />
        </g>
        <circle cx="436" cy="158" r="5" fill="#A795EB" />
        <circle cx="91" cy="253" r="5" fill="#927CE0" />
      </svg>
      <div className="portal-art-note portal-art-note--care">
        <span className="portal-art-note__icon"><span /></span>
        <span><strong>Care, in sync</strong><small>One connected team</small></span>
      </div>
      <div className="portal-art-note portal-art-note--secure">
        <span className="portal-art-note__check">✓</span>
        <span><strong>Protected by design</strong><small>Private clinical access</small></span>
      </div>
    </div>
  );
}

function PortalSelection() {
  return (
    <main className="portal-selection">
      <div className="portal-selection__ambient portal-selection__ambient--violet" aria-hidden="true" />
      <div className="portal-selection__ambient portal-selection__ambient--blue" aria-hidden="true" />

      <div className="portal-selection__shell">
        <header className="portal-selection__header">
          <a className="portal-selection__brand" href="/" aria-label="GBK HealthCare home">
            <span className="portal-selection__brand-mark" aria-hidden="true">
              <svg viewBox="0 0 32 32" fill="none">
                <path d="M13 5h6v8h8v6h-8v8h-6v-8H5v-6h8V5Z" fill="currentColor" />
                <circle cx="16" cy="16" r="14" stroke="currentColor" strokeOpacity=".24" />
              </svg>
            </span>
            <span className="portal-selection__brand-copy">
              <strong>GBK <em>HealthCare</em></strong>
              <small>CONNECTED CARE, CLEARER</small>
            </span>
          </a>
          <div className="portal-selection__secure">
            <span className="portal-selection__secure-mark" aria-hidden="true">
              <svg viewBox="0 0 16 16" fill="none">
                <path d="M8 1.8 13 3.7v3.9c0 3.2-2 5.5-5 6.7-3-1.2-5-3.5-5-6.7V3.7l5-1.9Z" />
                <path d="m5.8 7.8 1.5 1.5 3-3.1" />
              </svg>
            </span>
            <span>Secure platform</span>
          </div>
        </header>

        <section className="portal-hero" aria-labelledby="portal-welcome-title">
          <div className="portal-hero__copy">
            <span className="portal-selection__eyebrow"><i /> A CLEARER WAY TO CARE</span>
            <h1 id="portal-welcome-title">Healthcare,<br /><span>connected.</span></h1>
            <h2>One platform. Every role.</h2>
            <p>
              Thoughtfully connected tools for the people who make exceptional
              care possible — from the first hello to every clinical decision.
            </p>
            <div className="portal-hero__assurance">
              <span className="portal-hero__assurance-dot" />
              <span>Private workspaces, built around your team</span>
            </div>
          </div>
          <CareNetworkIllustration />
        </section>

        <section className="portal-workspaces" aria-labelledby="portal-workspaces-title">
          <div className="portal-workspaces__heading">
            <div>
              <span className="portal-workspaces__eyebrow">YOUR WORKSPACE</span>
              <h2 id="portal-workspaces-title">The right tools for your role.</h2>
            </div>
            <p>Select a secure portal to continue.</p>
          </div>
          <nav className="portal-selection__cards" aria-label="Choose a portal">
            {portals.map((portal) => (
              <a className="portal-card" href={portal.href} key={portal.title}>
                <div className="portal-card__topline">
                  <span className="portal-card__index">{portal.index}</span>
                  <span className="portal-card__arrow" aria-hidden="true">↗</span>
                </div>
                <span className="portal-card__icon"><PortalIcon name={portal.icon} /></span>
                <h3>{portal.title}</h3>
                <p>{portal.description}</p>
                <span className="portal-card__action">
                  {portal.action}
                  <span className="portal-card__action-arrow" aria-hidden="true">→</span>
                </span>
              </a>
            ))}
          </nav>
        </section>

        <footer className="portal-selection__footer">
          <span><i /> Protected clinical workspaces</span>
          <span>© 2026 GBK HealthCare <b>·</b> Care, connected.</span>
        </footer>
      </div>
    </main>
  );
}

export default PortalSelection;
