import { useState, type FormEvent } from "react";
import { loginAdmin } from "../../auth/adminSession";
import {
  AuthButton,
  AuthError,
  EmailField,
  PasswordField,
  SecureAccessMessage,
  UnifiedLoginLayout,
} from "../auth/UnifiedLogin";

type Props = { onLogin: (session: { accessToken: string; adminEmail: string }) => void; sessionError: string; logoutError: string; onRetry: () => void };

function AdminLogin({ onLogin, sessionError, logoutError, onRetry }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setLoading(true); setError("");
    try {
      const session = await loginAdmin(email.trim(), password);
      setPassword("");
      onLogin({ accessToken: session.accessToken, adminEmail: session.adminEmail });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Admin sign-in failed. Try again.");
    } finally { setLoading(false); }
  };

  return (
    <UnifiedLoginLayout
      portal="ADMIN"
      portalIcon="shield"
      portalIdentity="ADMINISTRATION"
      portalHeading="Administrator Sign In"
      headline={<>Care teams, connected with <em>confidence.</em></>}
      description="Manage access and support your clinical team from one secure workspace."
      cardDescription="Manage your clinic, doctors and staff."
    >
      {logoutError && <AuthError>{logoutError}</AuthError>}
      {sessionError && (
        <AuthError>
          <span>{sessionError}</span>{" "}
          <button type="button" onClick={onRetry}>Retry</button>
        </AuthError>
      )}
      <form className="unified-auth-form" onSubmit={(event) => void submit(event)}>
        <EmailField
          id="admin-email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="admin@healthcare.org"
          disabled={loading}
        />
        <PasswordField
          id="admin-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={loading}
        />
        {error && <AuthError>{error}</AuthError>}
        <AuthButton loading={loading} idleText="Sign in to Admin portal" />
      </form>
      <SecureAccessMessage />
      <a className="unified-auth-link" href="/">
        Back to Portal Selection <span aria-hidden="true">↗</span>
      </a>
    </UnifiedLoginLayout>
  );
}

export default AdminLogin;
