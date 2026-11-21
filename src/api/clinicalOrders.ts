import { API_BASE_URL } from "../config/api";
import { authenticatedFetch } from "../auth/session";

export type PrescriptionItem = { id?: number; medicineName: string; dosage: string; route: string; frequency: string; duration: string; quantity: number; instructions: string; startDate: string };
export type Prescription = { id: number; patientVisitId: number; doctorId: number; revision: number; status: "DRAFT" | "SIGNED"; supersedesPrescriptionId: number | null; notes: string | null; createdAt: string; signedAt: string | null; items: PrescriptionItem[] };
export type Investigation = { id: number; patientVisitId: number; doctorId: number; type: "LAB" | "IMAGING" | "OTHER"; name: string; indication: string | null; priority: "ROUTINE" | "URGENT" | "STAT"; status: "ORDERED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED"; orderedAt: string; updatedAt: string };
export type Referral = { id: number; patientVisitId: number; doctorId: number; specialty: string; providerOrFacility: string | null; clinicalReason: string; priority: "ROUTINE" | "URGENT" | "STAT"; instructions: string | null; status: "CREATED" | "SENT" | "ACCEPTED" | "COMPLETED" | "CANCELLED"; createdAt: string; updatedAt: string };
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await authenticatedFetch(`${API_BASE_URL}/api/doctor-opd${path}`, { ...init, headers: { Accept: "application/json", ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers } });
  if (!response.ok) { let message = `Clinical order request failed (HTTP ${response.status}).`; try { const body = await response.json() as { detail?: string; message?: string }; message = body.detail || body.message || message; } catch { /* use status */ } throw new Error(message); }
  return await response.json() as T;
}
const q = (id: number) => `/queue/${id}`;
export const listPrescriptions = (id: number) => request<Prescription[]>(`${q(id)}/prescriptions`);
export const createPrescription = (id: number, data: Omit<Prescription,"id"|"patientVisitId"|"doctorId"|"revision"|"status"|"supersedesPrescriptionId"|"createdAt"|"signedAt"> & { supersedesPrescriptionId?: number | null }) => request<Prescription>(`${q(id)}/prescriptions`, { method:"POST", body:JSON.stringify(data) });
export const updatePrescription = (id: number, prescriptionId: number, data: { notes: string; items: PrescriptionItem[] }) => request<Prescription>(`${q(id)}/prescriptions/${prescriptionId}`, { method:"PUT", body:JSON.stringify(data) });
export const signPrescription = (id: number, prescriptionId: number) => request<Prescription>(`${q(id)}/prescriptions/${prescriptionId}/sign`, { method:"POST" });
export const listInvestigations = (id: number) => request<Investigation[]>(`${q(id)}/investigation-orders`);
export const createInvestigation = (id: number, data: {type: Investigation["type"]; name:string; indication:string; priority:Investigation["priority"]}) => request<Investigation>(`${q(id)}/investigation-orders`, {method:"POST",body:JSON.stringify(data)});
export const setInvestigationStatus = (id:number, orderId:number,status:Investigation["status"]) => request<Investigation>(`${q(id)}/investigation-orders/${orderId}/status`,{method:"PUT",body:JSON.stringify({status})});
export const listReferrals = (id:number) => request<Referral[]>(`${q(id)}/referrals`);
export const createReferral = (id:number,data:{specialty:string;providerOrFacility:string;clinicalReason:string;priority:Referral["priority"];instructions:string}) => request<Referral>(`${q(id)}/referrals`,{method:"POST",body:JSON.stringify(data)});
export const setReferralStatus = (id:number,referralId:number,status:Referral["status"]) => request<Referral>(`${q(id)}/referrals/${referralId}/status`,{method:"PUT",body:JSON.stringify({status})});
