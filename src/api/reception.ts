import { staffAuthenticatedFetch } from "../auth/staffSession";
import { API_BASE_URL } from "../config/api";

export type ReceptionPatient = {
  patientId: number;
  fullName: string;
  age: number;
  gender: string;
  mobileNumber: string;
  email: string | null;
  registeredVisitDate: string;
};

export type ReceptionDoctor = { doctorId: number; fullName: string; specialization: string | null };
export type ReceptionFollowUp = { followUpId: number; followUpDate: string };
export type ReceptionFollowUpLifecycle = { followUpId:number; patientId:number; patientName:string; originalVisitId:number; checkedInVisitId:number|null; assignedDoctorId:number|null; assignedDoctorName:string|null; followUpDate:string; status:string; checkedInAt:string|null; startedAt:string|null; completedAt:string|null; cancelledAt:string|null; cancellationReason:string|null; missedAt:string|null; missedReason:string|null };
export type ReceptionQueueSummary = { waitingForNursing: number; emergencyWaiting: number };
export type NewPatientDraft = {
  fullName: string;
  age: number;
  gender: "Male" | "Female" | "Other";
  visitDate: string;
  phone: string;
  email?: string;
};
export type CheckInPayload = {
  encounterType: "NEW" | "FOLLOW_UP";
  assignedDoctorId: number;
  requestKey: string;
  patientId?: number;
  newPatient?: NewPatientDraft;
  followUpId?: number;
  emergencyPriority: boolean;
  emergencyNote?: string;
};
export type CheckInResult = {
  patientId: number;
  patientName: string;
  visitId: number;
  visitNumber: number;
  encounterType: "NEW" | "FOLLOW_UP";
  assignedDoctorId: number;
  assignedDoctorName: string;
  visitDate: string;
  emergencyPriority: boolean;
  sourceFollowUpId: number | null;
  nursingQueueStatus: string;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await staffAuthenticatedFetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { Accept: "application/json", ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers },
  });
  if (!response.ok) {
    let message = `Reception request failed (HTTP ${response.status}).`;
    try {
      const body = await response.json() as { detail?: string; message?: string };
      message = body.detail || body.message || message;
    } catch { /* Keep the safe status-only message. */ }
    throw new Error(message);
  }
  if (response.status === 204) return undefined as T;
  return await response.json() as T;
}

export const searchReceptionPatients = (query: string) =>
  request<ReceptionPatient[]>(`/api/reception/patients?query=${encodeURIComponent(query)}`);
export const getReceptionDoctors = () => request<ReceptionDoctor[]>("/api/reception/doctors");
export const getScheduledFollowUps = (patientId: number) =>
  request<ReceptionFollowUp[]>(`/api/reception/patients/${patientId}/scheduled-follow-ups`);
export const getReceptionQueueSummary = () => request<ReceptionQueueSummary>("/api/reception/queue-summary");
export const getReceptionFollowUps = (status?:string) => request<ReceptionFollowUpLifecycle[]>(`/api/reception/follow-ups${status?`?status=${encodeURIComponent(status)}`:""}`);
export const cancelReceptionFollowUp = (id:number,reason:string) => request<ReceptionFollowUpLifecycle>(`/api/reception/follow-ups/${id}/cancel`,{method:"PUT",body:JSON.stringify({reason})});
export const markReceptionFollowUpMissed = (id:number,reason:string) => request<ReceptionFollowUpLifecycle>(`/api/reception/follow-ups/${id}/missed`,{method:"PUT",body:JSON.stringify({reason})});
export const createReceptionCheckIn = (payload: CheckInPayload) =>
  request<CheckInResult>("/api/reception/check-ins", { method: "POST", body: JSON.stringify(payload) });
