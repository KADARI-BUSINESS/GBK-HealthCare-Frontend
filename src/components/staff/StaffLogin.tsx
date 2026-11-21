import { useState } from "react";
import type { FormEvent } from "react";
import { loginStaff, type StaffSession } from "../../auth/staffSession";
import {
  AuthButton,
  AuthError,
  EmailField,
  PasswordField,
  SecureAccessMessage,
  UnifiedLoginLayout,
} from "../auth/UnifiedLogin";

function StaffLogin({ onLogin, logoutError }: { onLogin: (session: StaffSession) => Promise<void>; logoutError: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await onLogin(await loginStaff(email.trim(), password));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Staff sign-in failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <UnifiedLoginLayout
      portal="STAFF"
      portalIcon="users"
      portalIdentity="CLINIC OPERATIONS"
      portalHeading="Staff Sign In"
      headline={<>Your clinic workspace, <span>connected.</span></>}
      description="Access your assigned clinic responsibilities through one secure staff account."
      cardDescription="Access Reception, Nursing and Checkout."
    >
      {logoutError && <AuthError>{logoutError}</AuthError>}
      <form className="unified-auth-form" onSubmit={(event) => void submit(event)}>
        <EmailField
          id="staff-email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={loading}
        />
        <PasswordField
          id="staff-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={loading}
        />
        {error && <AuthError>{error}</AuthError>}
        <AuthButton loading={loading} idleText="Sign in securely" loadingText="Verifying..." />
      </form>
      <SecureAccessMessage>
        Staff accounts and access roles are managed by your administrator.
      </SecureAccessMessage>
      <a className="unified-auth-link" href="/">
        Back to Portal Selection <span aria-hidden="true">↗</span>
      </a>
    </UnifiedLoginLayout>
  );
}

export default StaffLogin;
