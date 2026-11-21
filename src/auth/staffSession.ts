import { API_BASE_URL } from "../config/api";

export type StaffRole = "RECEPTION" | "NURSE" | "CHECKOUT";
export type StaffSession = { accessToken: string; email: string; roles: StaffRole[]; csrfToken?: string };
export type StaffProfile = { staffId: number; fullName: string; email: string; mobileNumber: string | null; roles: StaffRole[] };
type SessionResponse = StaffSession & { expiresInSeconds?: number; tokenType?: string };

let accessToken: string | null = null;
let csrfToken: string | null = null;
let refreshInFlight: Promise<SessionResponse | null> | null = null;
let logoutConfirmed = false;

export function hasStaffAccessToken() { return accessToken !== null; }
export function wasStaffLogoutConfirmed() { return logoutConfirmed; }

async function getCsrfToken() {
  if (csrfToken) return csrfToken;
  const response = await fetch(`${API_BASE_URL}/api/auth/staff/csrf`, { credentials: "include", headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("Could not verify the Staff session.");
  csrfToken = ((await response.json()) as { csrfToken?: string }).csrfToken || null;
  return csrfToken;
}

async function refreshSession(): Promise<SessionResponse | null> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = getCsrfToken().then((token) => token
    ? fetch(`${API_BASE_URL}/api/auth/staff/refresh`, { method: "POST", credentials: "include", headers: { "X-XSRF-TOKEN": token, Accept: "application/json" } })
    : null).then(async (response) => {
      if (!response || response.status === 401) return null;
      if (!response.ok) throw new Error("Could not refresh the Staff session.");
      const result = await response.json() as SessionResponse;
      if (!result.accessToken || !result.email) throw new Error("The server returned an incomplete Staff session.");
      accessToken = result.accessToken; csrfToken = result.csrfToken || null;
      logoutConfirmed = false;
      return result;
    }).finally(() => { refreshInFlight = null; });
  return refreshInFlight;
}

export async function loginStaff(email: string, password: string): Promise<StaffSession> {
  const response = await fetch(`${API_BASE_URL}/api/auth/staff/login`, {
    method: "POST", credentials: "include", headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (response.status === 401) throw new Error("Email or password is incorrect, or the staff account has no active role.");
  if (!response.ok) throw new Error(`Staff sign-in is unavailable (HTTP ${response.status}).`);
  const result = await response.json() as SessionResponse;
  if (!result.accessToken || !result.email || !Array.isArray(result.roles)) throw new Error("The server returned an incomplete Staff session.");
  accessToken = result.accessToken; csrfToken = result.csrfToken || null;
  logoutConfirmed = false;
  return result;
}

export async function restoreStaffSession() {
  try { return await refreshSession(); }
  catch { accessToken = null; csrfToken = null; throw new Error("Could not verify the Staff session. Check your connection and retry."); }
}

export async function staffAuthenticatedFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const send = (token: string | null) => {
    const headers = new Headers(init.headers);
    if (token) headers.set("Authorization", `Bearer ${token}`); else headers.delete("Authorization");
    return fetch(input, { ...init, headers });
  };
  let response = await send(accessToken);
  if (response.status !== 401) return response;
  const session = await refreshSession();
  if (!session) {
    accessToken = null; window.dispatchEvent(new Event("gbk-staff-session-expired")); return response;
  }
  response = await send(session.accessToken);
  if (response.status === 401) { accessToken = null; window.dispatchEvent(new Event("gbk-staff-session-expired")); }
  return response;
}

export async function loadStaffProfile() {
  const response = await staffAuthenticatedFetch(`${API_BASE_URL}/api/staff/me`, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(response.status === 401 ? "Your Staff session is no longer active. Sign in again." : `Could not load staff profile (HTTP ${response.status}).`);
  return await response.json() as StaffProfile;
}

export async function logoutStaff() {
  logoutConfirmed = false;
  try {
    if (refreshInFlight) {
      try { await refreshInFlight; } catch { /* Still attempt server-side logout with the session cookie. */ }
    }
    const token = await getCsrfToken();
    if (!token) throw new Error("The server did not provide a Staff logout token.");
    const response = await fetch(`${API_BASE_URL}/api/auth/staff/logout`, { method: "POST", credentials: "include", headers: { "X-XSRF-TOKEN": token, Accept: "application/json" } });
    if (!response.ok) throw new Error(`Staff logout failed (HTTP ${response.status}).`);
    logoutConfirmed = true;
  } finally { accessToken = null; csrfToken = null; }
}
