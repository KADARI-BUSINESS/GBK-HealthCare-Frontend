import { useState, type ChangeEvent, type ReactNode } from "react";
import "./unified-login.css";

type PortalIconName = "shield" | "stethoscope" | "users";

type UnifiedLoginLayoutProps = {
  portal: string;
  portalIcon: PortalIconName;
  portalIdentity: string;
  portalHeading: string;
  headline: ReactNode;
  description: string;
  cardDescription: string;
  children: ReactNode;
};

export function UnifiedLoginLayout({
  portal,
  portalIcon,
  portalIdentity,
  portalHeading,
  headline,
  description,
  cardDescription,
  children,
}: UnifiedLoginLayoutProps) {
  return (
    <main className="unified-auth-page">
      <section className="unified-auth-brand-panel" aria-label="GBK HealthCare">
        <div className="unified-auth-orb unified-auth-orb--large" aria-hidden="true" />
        <div className="unified-auth-orb unified-auth-orb--small" aria-hidden="true" />
        <a className="unified-auth-brand" href="/" aria-label="GBK HealthCare home">
          <span className="unified-auth-brand-mark" aria-hidden="true">
            <svg viewBox="0 0 48 48" fill="none">
              <rect x="2" y="2" width="44" height="44" rx="15" stroke="currentColor" strokeWidth="2" />
              <path d="M24 13v22M13 24h22" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
            </svg>
          </span>
          <span className="unified-auth-brand-copy">
            <strong>GBK HealthCare</strong>
            <small>{portalIdentity}</small>
          </span>
        </a>

        <div className="unified-auth-brand-message">
          <span className="unified-auth-eyebrow">PREMIUM CLINICAL ACCESS</span>
          <h1>{headline}</h1>
          <p>{description}</p>
          <div className="unified-auth-network" aria-hidden="true">
            <svg viewBox="0 0 520 250" fill="none">
              <circle cx="260" cy="126" r="103" />
              <circle cx="260" cy="126" r="75" />
              <path d="m93 61 103 43m232-34-102 44M74 182l114-25m252 34-108-27m-67 81 1-56m-1-121 2-36" />
              <path d="M93 61h91m244 9h-68M74 182h114m252 9h-108" />
              <circle cx="93" cy="61" r="14" />
              <circle cx="428" cy="70" r="13" />
              <circle cx="74" cy="182" r="12" />
              <circle cx="440" cy="191" r="15" />
              <circle cx="260" cy="126" r="43" className="unified-auth-network-core" />
              <path className="unified-auth-network-cross" d="M252 102h16v16h16v16h-16v16h-16v-16h-16v-16h16z" />
              <circle cx="196" cy="104" r="4" className="unified-auth-network-node" />
              <circle cx="326" cy="114" r="4" className="unified-auth-network-node" />
              <circle cx="188" cy="157" r="4" className="unified-auth-network-node" />
              <circle cx="332" cy="164" r="4" className="unified-auth-network-node" />
            </svg>
          </div>
        </div>

        <div className="unified-auth-brand-trust">
          <span className="unified-auth-brand-trust-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M12 3 20 6v5c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6l8-3Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
              <path d="m9 12 2 2 4-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span>
            A space built around better care
            <small>Private, protected access for your care team</small>
          </span>
        </div>
        <small className="unified-auth-footer">GBK HEALTHCARE · {portal}</small>
      </section>

      <section className="unified-auth-form-panel" aria-label={`${portal} sign in`}>
        <div className="unified-auth-card">
          <div className="unified-auth-mobile-brand" aria-hidden="true">
            <span className="unified-auth-mobile-mark">✚</span>
            <strong>GBK HealthCare</strong>
          </div>
          <div className="unified-auth-portal-identity">
            <span className="unified-auth-portal-icon" aria-hidden="true">
              <PortalIdentityIcon name={portalIcon} />
            </span>
            <div className="unified-auth-identity-copy">
              <span className="unified-auth-portal-name">{portalIdentity}</span>
              <h2>{portalHeading}</h2>
              <p className="unified-auth-card-description">{cardDescription}</p>
            </div>
          </div>
          {children}
        </div>
        <p className="unified-auth-copyright">© {new Date().getFullYear()} GBK HealthCare. Secure clinical access.</p>
      </section>
    </main>
  );
}

function PortalIdentityIcon({ name }: { name: PortalIconName }) {
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
        <path d="M12 3 19 6v5.3c0 4.3-2.8 7.7-7 9.7-4.2-2-7-5.4-7-9.7V6l7-3Z" />
        <path d="m8.8 12.1 2.1 2.1 4.4-4.5" />
      </svg>
    );
  }

  if (name === "stethoscope") {
    return (
      <svg {...commonProps}>
        <path d="M6 4v5a4 4 0 0 0 8 0V4M4 4h4m4 0h4" />
        <path d="M10 13v1a5 5 0 0 0 10 0v-1" />
        <circle cx="19" cy="11" r="2" />
      </svg>
    );
  }

  return (
    <svg {...commonProps}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20v-1.2A5.8 5.8 0 0 1 8.3 13h1.4a5.8 5.8 0 0 1 5.8 5.8V20M16 5.2a3.5 3.5 0 0 1 0 6.6M18 14a4.8 4.8 0 0 1 3.5 4.6V20" />
    </svg>
  );
}

type EmailFieldProps = {
  id: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  label?: string;
  placeholder?: string;
  maxLength?: number;
};

export function EmailField({
  id,
  value,
  onChange,
  disabled = false,
  label = "Email address",
  placeholder = "name@healthcare.org",
  maxLength = 160,
}: EmailFieldProps) {
  return (
    <div className="unified-auth-field">
      <label htmlFor={id}>{label}</label>
      <div className="unified-auth-input-wrap">
        <svg className="unified-auth-input-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="3" y="5" width="18" height="14" rx="3" stroke="currentColor" strokeWidth="1.7" />
          <path d="m4 7 8 6 8-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <input
          id={id}
          name="email"
          type="email"
          autoComplete="username"
          maxLength={maxLength}
          required
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
        />
      </div>
    </div>
  );
}

type PasswordFieldProps = {
  id: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  maxLength?: number;
};

export function PasswordField({
  id,
  value,
  onChange,
  disabled = false,
  maxLength = 128,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="unified-auth-field">
      <label htmlFor={id}>Password</label>
      <div className="unified-auth-input-wrap">
        <svg className="unified-auth-input-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="4" y="10" width="16" height="11" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
          <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          <circle cx="12" cy="15" r="1.2" fill="currentColor" />
        </svg>
        <input
          id={id}
          name="password"
          type={visible ? "text" : "password"}
          autoComplete="current-password"
          maxLength={maxLength}
          required
          value={value}
          onChange={onChange}
          placeholder="Enter your password"
          disabled={disabled}
        />
        <button
          className="unified-auth-password-toggle"
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          disabled={disabled}
        >
          {visible ? "Hide" : "Show"}
        </button>
      </div>
    </div>
  );
}

type AuthButtonProps = { loading: boolean; idleText: string; loadingText?: string };

export function AuthButton({ loading, idleText, loadingText = "Signing in securely..." }: AuthButtonProps) {
  return (
    <button className="unified-auth-submit" type="submit" disabled={loading} aria-busy={loading}>
      {loading && <span className="unified-auth-spinner" aria-hidden="true" />}
      {loading ? loadingText : idleText}
      {!loading && <span className="unified-auth-submit-arrow" aria-hidden="true">→</span>}
    </button>
  );
}

export function SecureAccessMessage({ children = "Your session is protected with secure authentication." }: { children?: ReactNode }) {
  return (
    <div className="unified-auth-security">
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 3 20 6v5c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6l8-3Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        <path d="m9 12 2 2 4-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span>{children}</span>
    </div>
  );
}

export function AuthError({ children }: { children: ReactNode }) {
  return <div className="unified-auth-error" role="alert">{children}</div>;
}
