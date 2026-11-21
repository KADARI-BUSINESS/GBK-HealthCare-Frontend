import { useState, type FormEvent } from "react";
import { API_BASE_URL } from "../config/api";
import { setAccessToken, setCsrfToken } from "../auth/session";
import DoctorRegistration from "./DoctorRegistration";
import {
  AuthButton,
  AuthError,
  EmailField,
  PasswordField,
  SecureAccessMessage,
  UnifiedLoginLayout,
} from "./auth/UnifiedLogin";

type DoctorLoginProps = {
  onLogin: (accessToken: string, email: string) => void;
  logoutError: string;
};

type LoginResponse = {
  accessToken: string;
  tokenType: string;
  expiresInSeconds: number;
  csrfToken: string;
};

function DoctorLogin({ onLogin, logoutError }: DoctorLoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showRegistration, setShowRegistration] = useState(false);

  if (showRegistration) {
    return <DoctorRegistration onBack={() => setShowRegistration(false)} />;
  }

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
        credentials: "include",
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
      setAccessToken(result.accessToken);
      setCsrfToken(result.csrfToken || null);
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
    <UnifiedLoginLayout
      portal="DOCTOR"
      portalIcon="stethoscope"
      portalIdentity="CLINICAL CARE"
      portalHeading="Doctor Sign In"
      headline={<>Better care begins with <span>better access.</span></>}
      description="A secure workspace for managing patient records, clinical visits, and follow-up care."
      cardDescription="Access patients and clinical workflows."
    >
      {logoutError && <AuthError>{logoutError}</AuthError>}
      <form className="unified-auth-form" onSubmit={(event) => void handleSubmit(event)}>
        <EmailField
          id="doctor-email"
          label="Registered email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="doctor@healthcare.org"
          disabled={loading}
        />
        <PasswordField
          id="doctor-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={loading}
        />
        {error && <AuthError>{error}</AuthError>}
        <AuthButton loading={loading} idleText="Sign in securely" />
      </form>
      <SecureAccessMessage>Your session is protected by secure authentication.</SecureAccessMessage>
      <a className="unified-auth-link" href="/">
        Back to Portal Selection <span aria-hidden="true">↗</span>
      </a>
      <div className="unified-auth-extra">
        Need account access? Contact your healthcare system administrator.
        <br />
        <button type="button" onClick={() => setShowRegistration(true)}>
          New Doctor? Register Here
        </button>
      </div>
    </UnifiedLoginLayout>
  );
}

export default DoctorLogin;
