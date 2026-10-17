import "./SuccessModal.css";

interface SuccessModalProps {
  isOpen: boolean;
  patientName: string;
  onClose: () => void;
  onRegisterAnother: () => void;
}

function SuccessModal({
  isOpen,
  patientName,
  onClose,
  onRegisterAnother,
}: SuccessModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="success-modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="success-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="success-modal-title"
      >
        <button
          type="button"
          className="success-modal-close"
          aria-label="Close confirmation"
          onClick={onClose}
        >
          ×
        </button>

        <div className="success-modal-icon">
          <svg viewBox="0 0 52 52" aria-hidden="true">
            <circle cx="26" cy="26" r="24" fill="none" />
            <path
              d="M15 27l7 7 15-16"
              fill="none"
              stroke="currentColor"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <p className="success-modal-eyebrow">REGISTRATION COMPLETE</p>

        <h2 id="success-modal-title">Patient registered successfully!</h2>

        <p className="success-modal-description">
          The patient profile has been saved, and the initial visit record has
          been created.
        </p>

        <div className="success-patient-card">
          <span className="success-patient-avatar" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21v-2a8 8 0 0 1 16 0v2" />
            </svg>
          </span>

          <div>
            <span className="success-patient-label">Patient Name</span>
            <strong>{patientName || "New patient"}</strong>
          </div>

          <span className="success-status-pill">Saved</span>
        </div>

        <div className="success-modal-actions">
          <button
            type="button"
            className="success-modal-secondary"
            onClick={onClose}
          >
            Close
          </button>

          <button
            type="button"
            className="success-modal-primary"
            onClick={onRegisterAnother}
          >
            Register another patient
            <span aria-hidden="true"> →</span>
          </button>
        </div>

        <p className="success-modal-footer">
          <span aria-hidden="true">🔒</span>
          Patient information has been submitted to GBK HealthCare.
        </p>
      </section>
    </div>
  );
}

export default SuccessModal;
