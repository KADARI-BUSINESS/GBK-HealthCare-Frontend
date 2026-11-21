import { API_BASE_URL } from "../config/api";
import { authenticatedFetch } from "../auth/session";

export type DoctorOpdQueueItem = {
  queueEntryId: number; patientVisitId: number; patientId: number; patientName: string; patientAge: number;
  patientGender: string; patientMobile: string; checkedInAt: string; emergencyPriority: boolean; emergencyNote: string | null;
  status: "WAITING" | "CLAIMED" | "IN_CONSULTATION" | "ON_HOLD" | "CONSULTATION_SIGNED";
  waitingSeconds: number; claimedAt: string | null; consultationStartedAt: string | null; heldAt: string | null;
  encounterType: "NEW" | "FOLLOW_UP" | null; followUpId: number | null; followUpDate: string | null; followUpStatus: string | null;
};
export type ConsultationDraft = {
  chiefComplaints: string; presentIllness: string; generalExamination: string; heartExamination: string;
  lungsExamination: string; abdomenExamination: string; rectalExamination: string; diagnosis: string;
  assessment: string; treatmentPlan: string; doctorNotes: string;
};
export type DoctorConsultation = ConsultationDraft & { queueEntryId: number; patientVisitId: number; encounterStatus: string | null; consultationStatus: string | null; signedAt: string | null; checkoutStatus: string | null };
export type NursingIntake = {
  intake: { bpSystolic: number | null; bpDiastolic: number | null; pulseRate: number | null; temperatureC: number | null; respiratoryRate: number | null; oxygenSaturation: number | null; heightCm: number | null; weightKg: number | null; bmi: number | null; allergies: string | null; medicationReconciliation: string | null; nursingNotes: string | null; recordedAt: string; signedAt: string | null };
  nurseStaffId: number; nurseName: string; handoffAt: string;
};
export type HistoricalVisit = { visitId: number; visitDate: string | null; chiefComplaints: string | null; presentIllness: string | null; generalExamination: string | null; heartExamination: string | null; lungsExamination: string | null; abdomenExamination: string | null; diagnosis: string | null; treatmentPlan: string | null; temperatureC: number | null; pulseRate: number | null; oxygenSaturation: number | null; bpSystolic: number | null; bpDiastolic: number | null };
export type ConsultationAddendum = { id: number; patientVisitId: number; doctorId: number; text: string; createdAt: string };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await authenticatedFetch(`${API_BASE_URL}/api/doctor-opd${path}`, {
    ...init, headers: { Accept: "application/json", ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers },
  });
  if (!response.ok) {
    let message = `Doctor OPD request failed (HTTP ${response.status}).`;
    try { const body = await response.json() as { detail?: string; message?: string }; message = body.detail || body.message || message; } catch { /* keep HTTP status */ }
    throw new Error(message);
  }
  return await response.json() as T;
}
export const getDoctorOpdQueue = () => request<DoctorOpdQueueItem[]>("/queue");
export const claimDoctorEncounter = (id: number) => request<DoctorOpdQueueItem>(`/queue/${id}/claim`, { method: "POST" });
export const startDoctorConsultation = (id: number) => request<DoctorOpdQueueItem>(`/queue/${id}/start`, { method: "POST" });
export const holdDoctorConsultation = (id: number) => request<DoctorOpdQueueItem>(`/queue/${id}/hold`, { method: "POST" });
export const resumeDoctorConsultation = (id: number) => request<DoctorOpdQueueItem>(`/queue/${id}/resume`, { method: "POST" });
export const getDoctorNursingIntake = (id: number) => request<NursingIntake>(`/queue/${id}/nursing-intake`);
export const getRelevantPatientHistory = (id: number) => request<HistoricalVisit[]>(`/queue/${id}/history`);
export const getConsultation = (id: number) => request<DoctorConsultation>(`/queue/${id}/consultation`);
export const saveConsultationDraft = (id: number, draft: ConsultationDraft) => request<DoctorConsultation>(`/queue/${id}/consultation`, { method: "PUT", body: JSON.stringify(draft) });
export const signConsultation = (id: number) => request<DoctorConsultation>(`/queue/${id}/sign`, { method: "POST" });
export const getConsultationAddenda = (id: number) => request<ConsultationAddendum[]>(`/queue/${id}/addenda`);
export const addConsultationAddendum = (id: number, text: string) => request<ConsultationAddendum>(`/queue/${id}/addenda`, { method: "POST", body: JSON.stringify({ text }) });
