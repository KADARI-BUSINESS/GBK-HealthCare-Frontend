import { API_BASE_URL } from "../config/api";
import { adminAuthenticatedFetch } from "../auth/adminSession";

export type AdminDoctor = {
  id: number;
  fullName: string;
  email: string;
  mobileNumber: string | null;
  qualification: string | null;
  specialization: string | null;
  medicalRegistrationNumber: string | null;
  approvalStatus: "PENDING" | "APPROVED" | "REJECTED";
  enabled: boolean;
  createdAt: string | null;
};

export type AdminDoctorPage = {
  content: AdminDoctor[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
};

export type AdminApprovalHistory = {
  id: number;
  doctorId: number;
  doctorName: string;
  doctorEmail: string;
  previousApprovalStatus: "PENDING" | "APPROVED" | "REJECTED";
  newApprovalStatus: "PENDING" | "APPROVED" | "REJECTED";
  adminId: number;
  adminEmail: string;
  decisionAt: string;
  rejectionReason: string | null;
};

export type AdminApprovalHistoryPage = {
  content: AdminApprovalHistory[];
  page: number;
  size: number;
  totalElements: number;
  hasNext: boolean;
};

export class AdminApiError extends Error {
  readonly status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "AdminApiError";
    this.status = status;
  }
}

async function request(path: string, init?: RequestInit): Promise<Response> {
  let response: Response;
  try {
    response = await adminAuthenticatedFetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: { Accept: "application/json", ...init?.headers },
    });
  } catch (cause) {
    if (init?.signal?.aborted) throw cause;
    throw new AdminApiError("Could not connect to the Admin service.");
  }
  if (!response.ok) {
    if (response.status === 401) throw new AdminApiError("Your Admin session expired. Sign in again.", 401);
    if (response.status === 403) throw new AdminApiError("This account is not authorized to manage doctors.", 403);
    throw new AdminApiError(`The Admin service returned an error (HTTP ${response.status}).`, response.status);
  }
  return response;
}

function isAdminDoctor(value: unknown): value is AdminDoctor {
  if (typeof value !== "object" || value === null) return false;
  const doctor = value as Record<string, unknown>;
  return Number.isSafeInteger(doctor.id)
    && typeof doctor.fullName === "string"
    && typeof doctor.email === "string"
    && (typeof doctor.mobileNumber === "string" || doctor.mobileNumber === null)
    && (typeof doctor.qualification === "string" || doctor.qualification === null)
    && (typeof doctor.specialization === "string" || doctor.specialization === null)
    && (typeof doctor.medicalRegistrationNumber === "string" || doctor.medicalRegistrationNumber === null)
    && (doctor.approvalStatus === "PENDING" || doctor.approvalStatus === "APPROVED" || doctor.approvalStatus === "REJECTED")
    && typeof doctor.enabled === "boolean"
    && (typeof doctor.createdAt === "string" || doctor.createdAt === null);
}

async function parseDoctor(response: Response): Promise<AdminDoctor> {
  const value: unknown = await response.json();
  if (!isAdminDoctor(value)) throw new AdminApiError("The server returned an unexpected doctor record.");
  return value;
}

async function parseDoctors(response: Response): Promise<AdminDoctor[]> {
  const value: unknown = await response.json();
  if (!Array.isArray(value) || !value.every(isAdminDoctor)) {
    throw new AdminApiError("The server returned an unexpected doctor list.");
  }
  return value;
}

export async function loadPendingDoctorApprovals(): Promise<AdminDoctor[]> {
  return parseDoctors(await request("/api/admin/doctors/pending"));
}

export async function loadManagedDoctors(): Promise<AdminDoctor[]> {
  return parseDoctors(await request("/api/admin/doctors"));
}

export async function loadManagedDoctorsPage(options: {
  page: number;
  size: number;
  search: string;
  status: "all" | "enabled" | "disabled";
  signal?: AbortSignal;
}): Promise<AdminDoctorPage> {
  const params = new URLSearchParams({
    page: String(options.page),
    size: String(options.size),
    search: options.search,
    status: options.status,
  });
  const response = await request(`/api/admin/doctors/paged?${params.toString()}`, {
    method: "GET",
    signal: options.signal,
  });
  const value: unknown = await response.json();
  if (!value || typeof value !== "object") throw new AdminApiError("The server returned an unexpected doctor page.");
  const page = value as Record<string, unknown>;
  if (!Array.isArray(page.content) || !page.content.every(isAdminDoctor)
      || !Number.isSafeInteger(page.totalElements) || !Number.isSafeInteger(page.totalPages)
      || !Number.isSafeInteger(page.size) || !Number.isSafeInteger(page.number)
      || typeof page.first !== "boolean" || typeof page.last !== "boolean") {
    throw new AdminApiError("The server returned an unexpected doctor page.");
  }
  return page as unknown as AdminDoctorPage;
}

function isApprovalHistory(value: unknown): value is AdminApprovalHistory {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  const validStatus = (status: unknown) => status === "PENDING" || status === "APPROVED" || status === "REJECTED";
  return Number.isSafeInteger(item.id) && Number.isSafeInteger(item.doctorId)
    && typeof item.doctorName === "string" && typeof item.doctorEmail === "string"
    && validStatus(item.previousApprovalStatus) && validStatus(item.newApprovalStatus)
    && Number.isSafeInteger(item.adminId) && typeof item.adminEmail === "string"
    && typeof item.decisionAt === "string"
    && (typeof item.rejectionReason === "string" || item.rejectionReason === null);
}

export async function loadApprovalHistory(page = 0, size = 25): Promise<AdminApprovalHistoryPage> {
  const response = await request(`/api/admin/doctors/approval-history?page=${page}&size=${size}`);
  const value: unknown = await response.json();
  if (!value || typeof value !== "object") throw new AdminApiError("The server returned an unexpected approval history page.");
  const result = value as Record<string, unknown>;
  if (!Array.isArray(result.content) || !result.content.every(isApprovalHistory)
      || !Number.isSafeInteger(result.page) || !Number.isSafeInteger(result.size)
      || !Number.isSafeInteger(result.totalElements) || typeof result.hasNext !== "boolean") {
    throw new AdminApiError("The server returned an unexpected approval history page.");
  }
  return result as unknown as AdminApprovalHistoryPage;
}

export async function updateDoctorApproval(id: number, approvalStatus: "APPROVED" | "REJECTED", rejectionReason?: string | null) {
  return parseDoctor(await request(`/api/admin/doctors/${id}/approval`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ approvalStatus, rejectionReason: rejectionReason?.trim() || null }),
  }));
}

export async function updateDoctorEnabled(id: number, enabled: boolean) {
  return parseDoctor(await request(`/api/admin/doctors/${id}/status`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled }),
  }));
}
