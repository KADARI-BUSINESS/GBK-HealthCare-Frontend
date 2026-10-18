import { useState } from "react";
import "./PatientRegistration.css";
import SuccessModal from "./SuccessModal";

const API_URL = "http://localhost:8080/api/patients";

interface PatientResponse {
  id: number;
  fullName: string;
}

type PatientRegistrationProps = {
  accessToken: string;
};

function PatientRegistration({ accessToken }: PatientRegistrationProps) {
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [registeredPatientName, setRegisteredPatientName] = useState("");
  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) return;

    const form = event.currentTarget;
    const formData = new FormData(form);

    const textValue = (name: string): string | null => {
      const value = String(formData.get(name) ?? "").trim();
      return value === "" ? null : value;
    };

    const numberValue = (name: string): number | null => {
      const value = textValue(name);
      return value === null ? null : Number(value);
    };

    const payload = {
      fullName: textValue("fullName"),
      age: numberValue("age"),
      gender: textValue("gender"),
      visitDate: textValue("visitDate"),
      phone: textValue("phone"),
      email: textValue("email"),
      temperature: numberValue("temperature"),
      pulseRate: numberValue("pulseRate"),
      spo2: numberValue("spo2"),
      bpSystolic: numberValue("bpSystolic"),
      bpDiastolic: numberValue("bpDiastolic"),
      chiefComplaints: textValue("chiefComplaints"),
      presentIllness: textValue("presentIllness"),
      generalExamination: textValue("generalExamination"),
      heartExamination: textValue("heartExamination"),
      lungsExamination: textValue("lungsExamination"),
      abdomenExamination: textValue("abdomenExamination"),
      rectalExamination: textValue("rectalExamination"),
    };

    setIsSubmitting(true);
    setMessage("");

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });

      const result = (await response.json().catch(() => null)) as
        | PatientResponse
        | { message?: string; detail?: string }
        | null;

      if (!response.ok) {
        const errorResult = result as {
          message?: string;
          detail?: string;
        } | null;

        throw new Error(
          errorResult?.message ||
            errorResult?.detail ||
            `Registration failed with status ${response.status}.`,
        );
      }

      const patientResult = result as PatientResponse | null;

      if (patientResult?.id == null) {
        throw new Error(
          "The server response did not contain a patient ID. Please verify the patient record before retrying.",
        );
      }

      // Save the new patient ID for the success modal.
      setRegisteredPatientName(patientResult.fullName);

      // Clear the form only after a successful response.
      form.reset();

      const dateInput = form.elements.namedItem(
        "visitDate",
      ) as HTMLInputElement | null;

      if (dateInput) {
        dateInput.value = new Date().toLocaleDateString("en-CA");
      }

      // Display the reusable success modal.
      setShowSuccessModal(true);
    } catch (error) {
      setMessage(
        error instanceof TypeError
          ? "Could not connect to the backend. Make sure Spring Boot is running on port 8080 and CORS is configured."
          : error instanceof Error
            ? error.message
            : "Unable to register patient. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleClearForm() {
    setMessage("");
  }

  function handleRegisterAnother() {
    setShowSuccessModal(false);
    setRegisteredPatientName("");
    setMessage("");
  }

  return (
    <section className="patient-registration">
      <form
        className="patient-form"
        onSubmit={handleSubmit}
        onReset={handleClearForm}
      >
        {/* 01 — Patient Information */}
        <section className="form-card">
          <div className="section-heading">
            <span className="section-icon" aria-hidden="true">
              👤
            </span>

            <div>
              <h2>Patient Information</h2>
              <p>Enter the patient's basic details.</p>
            </div>

            <span className="section-step">
              <strong>01</strong>
              <span>Basic Details</span>
            </span>
          </div>

          <div className="form-grid form-grid-three">
            <div className="form-group">
              <label htmlFor="fullName">Patient Name *</label>
              <input
                id="fullName"
                name="fullName"
                type="text"
                placeholder="Enter full name"
                autoComplete="name"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="age">Age *</label>
              <input
                id="age"
                name="age"
                type="number"
                placeholder="Enter age"
                min="0"
                max="130"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="gender">Sex *</label>
              <select id="gender" name="gender" defaultValue="" required>
                <option value="" disabled>
                  Select gender
                </option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="visitDate">Visit Date *</label>
              <input
                id="visitDate"
                name="visitDate"
                type="date"
                defaultValue={new Date().toLocaleDateString("en-CA")}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="phone">Phone Number *</label>
              <input
                id="phone"
                name="phone"
                type="tel"
                placeholder="Enter 10-digit phone number"
                autoComplete="tel-national"
                pattern="[6-9][0-9]{9}"
                maxLength={10}
                title="Enter a valid 10-digit Indian mobile number"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="Enter email address"
                autoComplete="email"
              />
            </div>
          </div>
        </section>

        {/* 02 — Vital Signs */}
        <section className="form-card">
          <div className="section-heading">
            <span
              className="section-icon vital-heading-icon"
              aria-hidden="true"
            >
              💓
            </span>

            <div>
              <h2>Vital Signs</h2>
              <p>Record the patient's current measurements.</p>
            </div>

            <span className="section-step">
              <strong>02</strong>
              <span>Current Measurements</span>
            </span>
          </div>

          <div className="vitals-grid">
            <div className="vital-card">
              <span className="vital-icon" aria-hidden="true">
                🌡️
              </span>
              <div className="form-group">
                <label htmlFor="temperature">Temperature (°F)</label>
                <input
                  id="temperature"
                  name="temperature"
                  type="number"
                  step="0.1"
                  min="80"
                  max="120"
                  placeholder="e.g. 98.6"
                />
              </div>
            </div>

            <div className="vital-card">
              <span className="vital-icon" aria-hidden="true">
                💗
              </span>
              <div className="form-group">
                <label htmlFor="pulseRate">Pulse Rate (bpm)</label>
                <input
                  id="pulseRate"
                  name="pulseRate"
                  type="number"
                  min="0"
                  max="300"
                  placeholder="Beats per minute"
                />
              </div>
            </div>

            <div className="vital-card">
              <span className="vital-icon" aria-hidden="true">
                🫁
              </span>
              <div className="form-group">
                <label htmlFor="spo2">SpO₂ (%)</label>
                <input
                  id="spo2"
                  name="spo2"
                  type="number"
                  min="0"
                  max="100"
                  placeholder="Oxygen saturation"
                />
              </div>
            </div>

            <div className="vital-card">
              <span className="vital-icon" aria-hidden="true">
                ⬆️
              </span>
              <div className="form-group">
                <label htmlFor="bpSystolic">BP Systolic (mmHg)</label>
                <input
                  id="bpSystolic"
                  name="bpSystolic"
                  type="number"
                  min="0"
                  max="350"
                  placeholder="Systolic pressure"
                />
              </div>
            </div>

            <div className="vital-card">
              <span className="vital-icon" aria-hidden="true">
                ⬇️
              </span>
              <div className="form-group">
                <label htmlFor="bpDiastolic">BP Diastolic (mmHg)</label>
                <input
                  id="bpDiastolic"
                  name="bpDiastolic"
                  type="number"
                  min="0"
                  max="250"
                  placeholder="Diastolic pressure"
                />
              </div>
            </div>
          </div>
        </section>

        {/* 03 — Clinical Examination */}
        <section className="form-card">
          <div className="section-heading">
            <span
              className="section-icon clinical-heading-icon"
              aria-hidden="true"
            >
              🩺
            </span>

            <div>
              <h2>Clinical Examination</h2>
              <p>Document complaints, history and examination findings.</p>
            </div>

            <span className="section-step">
              <strong>03</strong>
              <span>Examination Details</span>
            </span>
          </div>

          <div className="clinical-notes-grid">
            <div className="clinical-card clinical-card--purple">
              <span className="clinical-card-icon" aria-hidden="true">
                ▤
              </span>
              <div className="clinical-card-content form-group">
                <label htmlFor="chiefComplaints">Chief Complaints</label>
                <textarea
                  id="chiefComplaints"
                  name="chiefComplaints"
                  placeholder="Describe the patient's complaints"
                  rows={2}
                />
              </div>
            </div>

            <div className="clinical-card clinical-card--blue">
              <span className="clinical-card-icon" aria-hidden="true">
                ▣
              </span>
              <div className="clinical-card-content form-group">
                <label htmlFor="presentIllness">
                  History of Present Illness
                </label>
                <textarea
                  id="presentIllness"
                  name="presentIllness"
                  placeholder="Symptoms, duration and relevant history"
                  rows={2}
                />
              </div>
            </div>

            <div className="clinical-card clinical-card--purple clinical-card--wide">
              <span className="clinical-card-icon" aria-hidden="true">
                ▤
              </span>
              <div className="clinical-card-content form-group">
                <label htmlFor="generalExamination">
                  On Examination (General)
                </label>
                <textarea
                  id="generalExamination"
                  name="generalExamination"
                  placeholder="General physical examination findings"
                  rows={2}
                />
              </div>
            </div>

            <div className="clinical-card clinical-card--pink">
              <span className="clinical-card-icon" aria-hidden="true">
                ♥
              </span>
              <div className="clinical-card-content form-group">
                <label htmlFor="heartExamination">Heart Examination</label>
                <textarea
                  id="heartExamination"
                  name="heartExamination"
                  placeholder="Heart examination findings"
                  rows={2}
                />
              </div>
            </div>

            <div className="clinical-card clinical-card--mint">
              <span className="clinical-card-icon" aria-hidden="true">
                ♧
              </span>
              <div className="clinical-card-content form-group">
                <label htmlFor="lungsExamination">Lungs Examination</label>
                <textarea
                  id="lungsExamination"
                  name="lungsExamination"
                  placeholder="Lung examination findings"
                  rows={2}
                />
              </div>
            </div>

            <div className="clinical-card clinical-card--orange">
              <span className="clinical-card-icon" aria-hidden="true">
                ◉
              </span>
              <div className="clinical-card-content form-group">
                <label htmlFor="abdomenExamination">Per Abdomen (P/A)</label>
                <textarea
                  id="abdomenExamination"
                  name="abdomenExamination"
                  placeholder="Abdominal examination findings"
                  rows={2}
                />
              </div>
            </div>

            <div className="clinical-card clinical-card--blue">
              <span className="clinical-card-icon" aria-hidden="true">
                ▤
              </span>
              <div className="clinical-card-content form-group">
                <label htmlFor="rectalExamination">Per Rectum (P/R)</label>
                <textarea
                  id="rectalExamination"
                  name="rectalExamination"
                  placeholder="If clinically applicable"
                  rows={2}
                />
              </div>
            </div>
          </div>
        </section>

        {/* API validation or connection errors */}
        {message && (
          <p className="field-hint" role="alert" aria-live="polite">
            {message}
          </p>
        )}

        {/* Form actions */}
        <div className="form-actions">
          <button
            type="reset"
            className="btn-secondary"
            disabled={isSubmitting}
          >
            ↻ &nbsp; Clear Form
          </button>

          <button type="submit" className="btn-primary" disabled={isSubmitting}>
            {isSubmitting ? "Registering..." : "➤  Register Patient"}
          </button>
        </div>
      </form>

      {/* Reusable success modal */}
      <SuccessModal
        isOpen={showSuccessModal}
        patientName={registeredPatientName}
        onClose={() => setShowSuccessModal(false)}
        onRegisterAnother={handleRegisterAnother}
      />
    </section>
  );
}

export default PatientRegistration;
