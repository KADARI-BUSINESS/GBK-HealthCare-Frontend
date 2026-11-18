import { API_BASE_URL } from "../config/api";
import { adminAuthenticatedFetch } from "../auth/adminSession";
import type { StaffRole } from "../auth/staffSession";

export type AdminStaff = { id: number; fullName: string; email: string; mobileNumber: string | null; roles: StaffRole[]; enabled: boolean; createdAt: string | null };
async function request(path: string, init?: RequestInit) {
  const response = await adminAuthenticatedFetch(`${API_BASE_URL}${path}`, { ...init, headers: { Accept: "application/json", ...init?.headers } });
  if (!response.ok) throw new Error(response.status === 403 ? "Only an Admin can manage staff accounts." : `Staff management returned HTTP ${response.status}.`);
  return response;
}
function isStaff(value: unknown): value is AdminStaff {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return Number.isSafeInteger(item.id) && typeof item.fullName === "string" && typeof item.email === "string"
    && (typeof item.mobileNumber === "string" || item.mobileNumber === null)
    && Array.isArray(item.roles) && item.roles.every((role) => role === "RECEPTION" || role === "NURSE" || role === "CHECKOUT")
    && typeof item.enabled === "boolean" && (typeof item.createdAt === "string" || item.createdAt === null);
}
async function parse(response: Response): Promise<AdminStaff> {
  const value: unknown = await response.json(); if (!isStaff(value)) throw new Error("The server returned an unexpected staff record."); return value;
}
export async function loadStaffAccounts(): Promise<AdminStaff[]> {
  const value: unknown = await (await request("/api/admin/staff")).json();
  if (!Array.isArray(value) || !value.every(isStaff)) throw new Error("The server returned an unexpected staff list.");
  return value;
}
export async function createStaffAccount(input: { fullName: string; email: string; mobileNumber: string; temporaryPassword: string; roles: StaffRole[] }) {
  return parse(await request("/api/admin/staff", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }));
}
export async function updateStaffRoles(id: number, roles: StaffRole[]) {
  return parse(await request(`/api/admin/staff/${id}/roles`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ roles }) }));
}
export async function updateStaffEnabled(id: number, enabled: boolean) {
  return parse(await request(`/api/admin/staff/${id}/status`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled }) }));
}
