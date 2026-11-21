import { API_BASE_URL } from "../config/api";
import { staffAuthenticatedFetch } from "../auth/staffSession";

export type NursingQueueItem = {
  queueEntryId: number; patientVisitId: number; patientId: number; patientName: string;
  patientAge: number; patientGender: string; patientMobile: string; assignedDoctorId: number | null; assignedDoctorName: string;
  checkedInAt: string; emergencyPriority: boolean; emergencyNote: string | null; status: "WAITING" | "CLAIMED" | "HANDED_OFF";
  claimedByStaffId: number | null; claimedAt: string | null; waitingSeconds: number;
};
export type NursingIntakeDraft = {
  bpSystolic: number | null; bpDiastolic: number | null; pulseRate: number | null; temperatureC: number | null;
  respiratoryRate: number | null; oxygenSaturation: number | null; heightCm: number | null; weightKg: number | null;
  allergies: string; medicationReconciliation: string; nursingNotes: string;
};
export type NursingIntake = NursingIntakeDraft & { recordId: number; queueEntryId: number; nurseStaffId: number; revision: number; bmi: number | null; recordState: string; recordedAt: string; signedAt: string | null };
export type NursingHandoff = { doctorQueueEntryId: number; patientVisitId: number; assignedDoctorId: number; status: string; handedOffAt: string };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await staffAuthenticatedFetch(`${API_BASE_URL}/api/nursing${path}`, {
    ...init, headers: { Accept: "application/json", ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers },
  });
  if (!response.ok) {
    let message = `Nursing request failed (HTTP ${response.status}).`;
    try { const body = await response.json() as { message?: string; detail?: string; error?: string }; message = body.detail || body.message || body.error || message; } catch { /* keep HTTP status */ }
    throw new Error(message);
  }
  return response.status === 204 ? undefined as T : await response.json() as T;
}
export const getNursingQueue = () => request<NursingQueueItem[]>("/queue");
export const claimNursingEncounter = (id: number) => request<NursingQueueItem>(`/queue/${id}/claim`, { method: "POST" });
export const releaseNursingClaim = (id: number) => request<NursingQueueItem>(`/queue/${id}/release`, { method: "POST" });
export const getNursingIntakes = (id: number) => request<NursingIntake[]>(`/queue/${id}/intakes`);
export const saveNursingIntake = (id: number, draft: NursingIntakeDraft) => request<NursingIntake>(`/queue/${id}/intakes`, { method: "POST", body: JSON.stringify(draft) });
export const handoffNursingEncounter = (id: number) => request<NursingHandoff>(`/queue/${id}/handoff`, { method: "POST" });
