import { API_BASE_URL } from "../config/api";

type AdminSessionResponse = {
  accessToken: string;
  adminEmail: string;
  csrfToken?: string;
  expiresInSeconds?: number;
};

let accessToken: string | null = null;
let csrfToken: string | null = null;
let refreshInFlight: Promise<AdminSessionResponse | null> | null = null;
let logoutConfirmed = false;

export function hasAdminAccessToken() { return accessToken !== null; }
export function wasAdminLogoutConfirmed() { return logoutConfirmed; }

async function loadCsrfToken() {
  if (csrfToken) return csrfToken;
  const response = await fetch(`${API_BASE_URL}/api/auth/admin/csrf`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error("Could not verify the Admin session.");
  const result = (await response.json()) as { csrfToken?: string };
  csrfToken = result.csrfToken || null;
  return csrfToken;
}

async function refreshSession(): Promise<AdminSessionResponse | null> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = loadCsrfToken()
    .then((token) => token
      ? fetch(`${API_BASE_URL}/api/auth/admin/refresh`, {
        method: "POST",
        credentials: "include",
        headers: { "X-XSRF-TOKEN": token, Accept: "application/json" },
      })
      : null)
    .then(async (response) => {
      if (!response) return null;
      if (response.status === 401) return null;
      if (!response.ok) throw new Error("Could not refresh the Admin session.");
      const session = (await response.json()) as AdminSessionResponse;
      if (!session.accessToken || !session.adminEmail) throw new Error("The server returned an incomplete Admin session.");
      accessToken = session.accessToken;
      csrfToken = session.csrfToken || null;
      logoutConfirmed = false;
      return session;
    })
    .finally(() => { refreshInFlight = null; });
  return refreshInFlight;
}

export async function restoreAdminSession() {
  try {
    return await refreshSession();
  } catch {
    accessToken = null;
    csrfToken = null;
    throw new Error("Could not verify the Admin session. Check your connection and retry.");
  }
}

export async function loginAdmin(email: string, password: string) {
  const response = await fetch(`${API_BASE_URL}/api/auth/admin/login`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (response.status === 401) throw new Error("Email or password is incorrect.");
  if (!response.ok) throw new Error(`Admin sign-in is unavailable (HTTP ${response.status}).`);
  const session = (await response.json()) as AdminSessionResponse;
  if (!session.accessToken || !session.adminEmail) throw new Error("The server returned an incomplete Admin session.");
  accessToken = session.accessToken;
  csrfToken = session.csrfToken || null;
  logoutConfirmed = false;
  return session;
}

export async function logoutAdmin() {
  logoutConfirmed = false;
  try {
    if (refreshInFlight) {
      try { await refreshInFlight; } catch { /* Still attempt server-side logout with the session cookie. */ }
    }
    const token = await loadCsrfToken();
    if (!token) throw new Error("The server did not provide an Admin logout token.");
    const response = await fetch(`${API_BASE_URL}/api/auth/admin/logout`, {
      method: "POST",
      credentials: "include",
      headers: { "X-XSRF-TOKEN": token, Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`Admin logout failed (HTTP ${response.status}).`);
    logoutConfirmed = true;
  } finally {
    accessToken = null;
    csrfToken = null;
  }
}

export async function adminAuthenticatedFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const send = (token: string | null) => {
    const headers = new Headers(init.headers);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    else headers.delete("Authorization");
    return fetch(input, { ...init, headers });
  };
  let response = await send(accessToken);
  if (response.status !== 401) return response;
  const session = await refreshSession();
  if (!session) {
    accessToken = null;
    window.dispatchEvent(new Event("gbk-admin-session-expired"));
    return response;
  }
  response = await send(session.accessToken);
  if (response.status === 401) {
    accessToken = null;
    window.dispatchEvent(new Event("gbk-admin-session-expired"));
  }
  return response;
}
