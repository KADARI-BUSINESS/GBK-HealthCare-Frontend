import { useState, type FormEvent } from "react";
import { API_BASE_URL } from "../config/api";
import "./DoctorLogin.css";
import "./DoctorRegistration.css";

type Props = { onBack: () => void };
type RegistrationForm = {
  fullName: string;
  mobileNumber: string;
  email: string;
  specialization: string;
  qualification: string;
  medicalRegistrationNumber: string;
  password: string;
  confirmPassword: string;
};

const initialForm: RegistrationForm = {
  fullName: "",
  mobileNumber: "",
  email: "",
  specialization: "",
  qualification: "",
  medicalRegistrationNumber: "",
  password: "",
  confirmPassword: "",
};

function validate(form: RegistrationForm): string | null {
  if (!form.fullName.trim()) return "Enter your full name.";
  if (form.fullName.trim().length > 120) return "Full name must be 120 characters or fewer.";
  if (!/^[6-9][0-9]{9}$/.test(form.mobileNumber.trim())) return "Enter a valid 10-digit Indian mobile number.";
  const email = form.email.trim();
  if (email.length > 160 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Enter a valid email address (160 characters or fewer).";
  if (!form.specialization.trim()) return "Enter your specialization.";
  if (form.specialization.trim().length > 120) return "Specialization must be 120 characters or fewer.";
  if (!form.qualification.trim()) return "Enter your qualification.";
  if (form.qualification.trim().length > 120) return "Qualification must be 120 characters or fewer.";
  if (form.medicalRegistrationNumber.trim().length > 100) return "Medical registration number must be 100 characters or fewer.";
  if (form.password.length < 12 || form.password.length > 128) return "Password must contain between 12 and 128 characters.";
  if (form.password !== form.confirmPassword) return "Passwords do not match.";
  return null;
}

function DoctorRegistration({ onBack }: Props) {
  const [form, setForm] = useState<RegistrationForm>(initialForm);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const update = (field: keyof RegistrationForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setError("");
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const validationError = validate(form);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/doctor/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          fullName: form.fullName.trim(),
          mobileNumber: form.mobileNumber.trim(),
          email: form.email.trim().toLowerCase(),
          specialization: form.specialization.trim(),
          qualification: form.qualification.trim(),
          medicalRegistrationNumber: form.medicalRegistrationNumber.trim() || null,
          password: form.password,
        }),
      });

      if (response.status === 409) {
        setError("An account with this email already exists. Sign in or use another email.");
        return;
      }
      if (response.status === 400) {
        setError("Some registration details were not accepted. Review the fields and try again.");
        return;
      }
      if (!response.ok) {
        setError("Registration could not be submitted. Please try again later.");
        return;
      }

      setForm(initialForm);
      setSubmitted(true);
    } catch {
      setError("Cannot connect to the healthcare server. Please try again when it is available.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="doctor-login-page doctor-registration-page">
      <section className="doctor-login-brand-panel">
        <div className="login-brand">
          <div className="login-brand-mark" aria-hidden="true"><span className="login-mobile-mark">+</span></div>
          <div><span className="login-brand-name">GBK HealthCare</span><span className="login-brand-subtitle">CLINICAL MANAGEMENT</span></div>
        </div>
        <div className="login-brand-message">
          <span className="login-eyebrow">DOCTOR APPLICATION</span>
          <h1>Join your<br />clinical <span>community.</span></h1>
          <p>Submit your professional details for secure review by a GBK HealthCare administrator.</p>
        </div>
        <div className="login-trust-note"><span className="login-trust-icon" aria-hidden="true">✓</span><span>Admin-reviewed access<small>Your account stays pending until approved.</small></span></div>
        <span className="login-brand-footer">GBK HEALTHCARE · CLINICAL WORKSPACE</span>
      </section>

      <section className="doctor-login-form-panel doctor-registration-panel">
        <div className="doctor-login-form-wrap doctor-registration-wrap">
          <div className="login-mobile-brand"><span className="login-mobile-mark" aria-hidden="true">+</span><span>GBK HealthCare</span></div>
          {submitted ? (
            <div className="doctor-registration-success" role="status">
              <span className="login-form-eyebrow">APPLICATION RECEIVED</span>
              <h2>Registration submitted successfully.</h2>
              <p>Your account is pending Admin approval.</p>
              <button className="doctor-login-submit" type="button" onClick={onBack}>Back to Doctor Login <span aria-hidden="true">→</span></button>
            </div>
          ) : (
            <>
              <div className="login-form-heading doctor-registration-heading">
                <span className="login-form-eyebrow">DOCTOR PORTAL</span>
                <h2>Create account</h2>
                <p>Provide your details to submit an application for Admin review.</p>
              </div>
              <form className="doctor-registration-form" onSubmit={(event) => void submit(event)} noValidate>
                <label className="login-field doctor-registration-wide">
                  <span>Full name *</span>
                  <input autoComplete="name" maxLength={120} value={form.fullName} onChange={(event) => update("fullName", event.target.value)} disabled={loading} />
                </label>
                <label className="login-field">
                  <span>Mobile number *</span>
                  <input type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={10} pattern="[6-9][0-9]{9}" placeholder="10-digit Indian mobile" value={form.mobileNumber} onChange={(event) => update("mobileNumber", event.target.value.replace(/\D/g, ""))} disabled={loading} />
                </label>
                <label className="login-field">
                  <span>Email address *</span>
                  <input type="email" autoComplete="email" maxLength={160} value={form.email} onChange={(event) => update("email", event.target.value)} disabled={loading} />
                </label>
                <label className="login-field">
                  <span>Specialization *</span>
                  <input maxLength={120} value={form.specialization} onChange={(event) => update("specialization", event.target.value)} disabled={loading} />
                </label>
                <label className="login-field">
                  <span>Qualification *</span>
                  <input maxLength={120} value={form.qualification} onChange={(event) => update("qualification", event.target.value)} disabled={loading} />
                </label>
                <label className="login-field doctor-registration-wide">
                  <span>Medical registration number <small>(optional)</small></span>
                  <input maxLength={100} value={form.medicalRegistrationNumber} onChange={(event) => update("medicalRegistrationNumber", event.target.value)} disabled={loading} />
                </label>
                <label className="login-field">
                  <span>Password *</span>
                  <span className="doctor-registration-password">
                    <input type={showPassword ? "text" : "password"} autoComplete="new-password" maxLength={128} value={form.password} onChange={(event) => update("password", event.target.value)} disabled={loading} />
                    <button type="button" onClick={() => setShowPassword((show) => !show)} disabled={loading}>{showPassword ? "Hide" : "Show"}</button>
                  </span>
                </label>
                <label className="login-field">
                  <span>Confirm password *</span>
                  <span className="doctor-registration-password">
                    <input type={showConfirmPassword ? "text" : "password"} autoComplete="new-password" maxLength={128} value={form.confirmPassword} onChange={(event) => update("confirmPassword", event.target.value)} disabled={loading} />
                    <button type="button" onClick={() => setShowConfirmPassword((show) => !show)} disabled={loading}>{showConfirmPassword ? "Hide" : "Show"}</button>
                  </span>
                </label>
                {error && <div className="login-error doctor-registration-wide" role="alert"><span aria-hidden="true">!</span><p>{error}</p></div>}
                <div className="doctor-registration-wide doctor-registration-actions">
                  <button className="doctor-login-submit" type="submit" disabled={loading}>{loading ? "Submitting…" : "Submit registration"}<span aria-hidden="true">→</span></button>
                  <button className="doctor-registration-back" type="button" onClick={onBack} disabled={loading}>Back to Doctor Login</button>
                </div>
              </form>
            </>
          )}
        </div>
      </section>
    </main>
  );
}

export default DoctorRegistration;
