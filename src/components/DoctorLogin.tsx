import { useState, type FormEvent } from "react";
import "./DoctorLogin.css";

type DoctorLoginProps = {
  onLogin: (accessToken: string, email: string) => void;
};

type LoginResponse = {
  accessToken: string;
  tokenType: string;
  expiresInSeconds: number;
};

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

function DoctorLogin({ onLogin }: DoctorLoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const normalizedEmail = email.trim();

    if (
      !normalizedEmail ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
    ) {
      setError("Please enter a valid email address.");
      return;
    }

    if (!password) {
      setError("Please enter your password.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/doctor/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          email: normalizedEmail,
          password,
        }),
      });

      if (response.status === 401) {
        setError("Invalid email or password.");
        return;
      }

      if (!response.ok) {
        setError("Unable to sign in. Please try again.");
        return;
      }

      const result: LoginResponse = await response.json();

      if (!result.accessToken) {
        setError("Login response did not contain an access token.");
        return;
      }

      // Keep the access token in application memory.
      // Do not save it in localStorage or sessionStorage.
      onLogin(result.accessToken, normalizedEmail);
    } catch {
      setError(
        "Cannot connect to the healthcare server. Please check that the backend is running.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="doctor-login-page">
      <section className="doctor-login-brand-panel">
        <div className="login-brand">
          <div className="login-brand-mark" aria-hidden="true">
            <svg viewBox="0 0 48 48" fill="none">
              <rect
                x="3"
                y="3"
                width="42"
                height="42"
                rx="14"
                stroke="currentColor"
                strokeWidth="2"
              />
              <path
                d="M24 13v22M13 24h22"
                stroke="currentColor"
                strokeWidth="3.5"
                strokeLinecap="round"
              />
            </svg>
          </div>

          <div>
            <span className="login-brand-name">GBK HealthCare</span>
            <span className="login-brand-subtitle">CLINICAL MANAGEMENT</span>
          </div>
        </div>

        <div className="login-brand-message">
          <span className="login-eyebrow">YOUR CLINICAL WORKSPACE</span>

          <h1>
            Better care
            <br />
            begins with
            <br />
            <span>better access.</span>
          </h1>

          <p>
            A secure workspace for managing patient records, clinical visits,
            and follow-up care.
          </p>
        </div>

        <div className="login-trust-note">
          <span className="login-trust-icon" aria-hidden="true">
            ✓
          </span>
          <span>
            Protected doctor access
            <small>Authentication required for patient information</small>
          </span>
        </div>

        <span className="login-brand-footer">
          GBK HEALTHCARE · CLINICAL WORKSPACE
        </span>
      </section>

      <section className="doctor-login-form-panel">
        <div className="doctor-login-form-wrap">
          <div className="login-mobile-brand">
            <span className="login-mobile-mark" aria-hidden="true">
              +
            </span>
            <span>GBK HealthCare</span>
          </div>

          <div className="login-form-heading">
            <span className="login-form-eyebrow">DOCTOR PORTAL</span>

            <h2>Welcome back</h2>

            <p>Sign in with your registered doctor account to continue.</p>
          </div>

          <form className="doctor-login-form" onSubmit={handleSubmit}>
            <div className="login-field">
              <label htmlFor="doctor-email">Email address</label>

              <div className="login-input-wrap">
                <svg
                  className="login-input-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <rect
                    x="3"
                    y="5"
                    width="18"
                    height="14"
                    rx="3"
                    stroke="currentColor"
                    strokeWidth="1.7"
                  />
                  <path
                    d="m4 7 8 6 8-6"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>

                <input
                  id="doctor-email"
                  type="email"
                  name="email"
                  autoComplete="username"
                  placeholder="doctor@hospital.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  maxLength={160}
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div className="login-field">
              <div className="login-label-row">
                <label htmlFor="doctor-password">Password</label>
              </div>

              <div className="login-input-wrap">
                <svg
                  className="login-input-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <rect
                    x="4"
                    y="10"
                    width="16"
                    height="11"
                    rx="2.5"
                    stroke="currentColor"
                    strokeWidth="1.7"
                  />
                  <path
                    d="M8 10V7a4 4 0 0 1 8 0v3"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                  />
                  <circle cx="12" cy="15" r="1.2" fill="currentColor" />
                </svg>

                <input
                  id="doctor-password"
                  type={showPassword ? "text" : "password"}
                  name="password"
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  disabled={loading}
                />

                <button
                  type="button"
                  className="login-password-toggle"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  disabled={loading}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {error && (
              <div className="login-error" role="alert">
                <span aria-hidden="true">!</span>
                <p>{error}</p>
              </div>
            )}

            <button
              className="doctor-login-submit"
              type="submit"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="login-spinner" aria-hidden="true" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign in securely
                  <span aria-hidden="true">→</span>
                </>
              )}
            </button>

            <div className="login-security-caption">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M12 3 20 6v5c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6l8-3Z"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinejoin="round"
                />
                <path
                  d="m9 12 2 2 4-4"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>

              <span>Your session is protected by secure authentication.</span>
            </div>
          </form>

          <p className="login-help-text">
            Need account access? Contact your healthcare system administrator.
          </p>
        </div>
      </section>
    </main>
  );
}

export default DoctorLogin;
