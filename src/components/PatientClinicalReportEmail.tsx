import { useState } from "react";
import "./PatientClinicalReportEmail.css";

type ClinicalReportPatient = {
  id: number;
  fullName: string;
  email?: string | null;
};

type ClinicalReportVisit = {
  id: number;
  visitNumber: number;
  visitDate: string;
};

type DeliveryStatus = "PENDING" | "SENDING" | "SENT" | "FAILED";

type DeliveryResult = {
  deliveryId: number;
  status: DeliveryStatus;
  attemptCount: number;
  createdAt: string;
  lastAttemptAt: string | null;
  sentAt: string | null;
  failureCode: string | null;
};

type Props = {
  patient: ClinicalReportPatient;
  visit: ClinicalReportVisit;
  accessToken: string;
};

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

function PatientClinicalReportEmail({ patient, visit, accessToken }: Props) {
  const [consentConfirmed, setConsentConfirmed] = useState(false);
  const [passwordShared, setPasswordShared] = useState(false);
  const [pdfPassword, setPdfPassword] = useState("");
  const [delivery, setDelivery] = useState<DeliveryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const hasEmail = Boolean(patient.email?.trim());

  async function readError(response: Response): Promise<string> {
    const body = await response.json().catch(() => null);

    return (
      body?.message ||
      body?.detail ||
      `Request failed (HTTP ${response.status}).`
    );
  }

  async function prepareReport() {
    if (!hasEmail) {
      setError("Please add a valid email address to the patient record first.");
      return;
    }

    if (!consentConfirmed) {
      setError("Confirm patient consent before preparing the report.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/patients/${patient.id}/visits/${visit.id}/report-deliveries`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ consentGiven: true }),
        },
      );

      if (!response.ok) {
        throw new Error(await readError(response));
      }

      const result: DeliveryResult = await response.json();
      setDelivery(result);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to prepare the clinical report.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function sendReport() {
    if (!delivery) return;

    if (pdfPassword.length < 12 || pdfPassword.length > 128) {
      setError("Use a PDF password between 12 and 128 characters.");
      return;
    }

    if (!passwordShared) {
      setError(
        "Share the PDF password through a separate verified channel before sending the report.",
      );
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/report-deliveries/${delivery.deliveryId}/send`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ pdfPassword }),
        },
      );

      if (!response.ok) {
        throw new Error(await readError(response));
      }

      const result: DeliveryResult = await response.json();
      setDelivery(result);
      setPdfPassword("");
      setPasswordShared(false);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to send the clinical report.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="clinical-report-email">
      <div className="clinical-report-email-heading">
        <div>
          <h5>Email Clinical Report</h5>
          <p>
            Visit #{visit.visitNumber} · {visit.visitDate}
          </p>
        </div>

        <span className="clinical-report-secure-label">Encrypted PDF</span>
      </div>

      <div className="clinical-report-recipient">
        <span>Recipient email</span>
        <strong>{patient.email || "No email address on file"}</strong>
      </div>

      {!delivery && (
        <>
          <label className="clinical-report-checkbox">
            <input
              type="checkbox"
              checked={consentConfirmed}
              onChange={(event) => setConsentConfirmed(event.target.checked)}
              disabled={loading}
            />
            <span>
              I confirm that the patient has consented to receive this clinical
              report at the email address shown above.
            </span>
          </label>

          <button
            type="button"
            className="clinical-report-button"
            onClick={() => void prepareReport()}
            disabled={loading || !hasEmail || !consentConfirmed}
          >
            {loading ? "Preparing..." : "Prepare report"}
          </button>
        </>
      )}

      {delivery && (
        <div className="clinical-report-delivery-details">
          <div className="clinical-report-status-row">
            <span>Delivery ID: {delivery.deliveryId}</span>
            <strong
              className={`clinical-report-status ${delivery.status.toLowerCase()}`}
              role="status"
              aria-live="polite"
            >
              {delivery.status}
            </strong>
          </div>

          {delivery.status === "PENDING" && (
            <>
              <label htmlFor={`pdf-password-${delivery.deliveryId}`}>
                PDF password
              </label>

              <input
                id={`pdf-password-${delivery.deliveryId}`}
                className="clinical-report-password-input"
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                value={pdfPassword}
                onChange={(event) => setPdfPassword(event.target.value)}
                placeholder="Enter a strong password (12+ characters)"
                disabled={loading}
              />

              <p className="clinical-report-security-note">
                This app does not send the PDF password separately. Share it
                with the patient through a verified channel first.
              </p>

              <label className="clinical-report-checkbox">
                <input
                  type="checkbox"
                  checked={passwordShared}
                  onChange={(event) => setPasswordShared(event.target.checked)}
                  disabled={loading}
                />
                <span>
                  I have shared the PDF password with the patient through a
                  separate verified channel.
                </span>
              </label>

              <button
                type="button"
                className="clinical-report-button"
                onClick={() => void sendReport()}
                disabled={loading || pdfPassword.length < 12 || !passwordShared}
              >
                {loading ? "Sending..." : "Send encrypted report"}
              </button>
            </>
          )}

          {delivery.status === "SENT" && (
            <p className="clinical-report-success">
              Email provider accepted the report for sending. Delivery to the
              recipient's inbox is not independently confirmed.
            </p>
          )}

          {delivery.status === "FAILED" && (
            <p className="clinical-report-error">
              The report was not sent successfully. Failure code:{" "}
              {delivery.failureCode || "UNKNOWN"}
            </p>
          )}
        </div>
      )}

      {error && (
        <p className="clinical-report-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

export default PatientClinicalReportEmail;
