import { API_BASE_URL } from "../config/api";

type TokenResponse = {
  accessToken: string;
  doctorEmail: string;
  csrfToken?: string;
};

let accessToken: string | null = null;
let csrfToken: string | null = null;
let refreshInFlight: Promise<TokenResponse | null> | null = null;

async function loadCsrfToken(): Promise<string | null> {
  if (csrfToken) return csrfToken;
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/doctor/csrf`, {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error("Unable to validate the current session.");
    const result = (await response.json()) as { csrfToken?: string };
    csrfToken = result.csrfToken || null;
    return csrfToken;
  } catch {
    throw new Error("Unable to connect to the authentication server.");
  }
}

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function setCsrfToken(token: string | null) {
  csrfToken = token;
}

async function refreshSession(): Promise<TokenResponse | null> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = loadCsrfToken()
    .then((token) =>
      token
        ? fetch(`${API_BASE_URL}/api/auth/doctor/refresh`, {
            method: "POST",
            credentials: "include",
            headers: { "X-XSRF-TOKEN": token, Accept: "application/json" },
          })
        : null,
    )
    .then(async (response) => {
      if (response?.status === 401) return null;
      if (!response?.ok) throw new Error("Unable to refresh the current session.");
      const session = (await response.json()) as TokenResponse;
      if (!session.accessToken || !session.doctorEmail) {
        throw new Error("The server returned an incomplete session.");
      }
      accessToken = session.accessToken;
      csrfToken = session.csrfToken || null;
      return session;
    })
    .finally(() => {
      refreshInFlight = null;
    });

  return refreshInFlight;
}

export function restoreSession() {
  return refreshSession();
}

export async function endSession() {
  try {
    if (refreshInFlight) await refreshInFlight;
    const token = await loadCsrfToken();
    if (token) {
      await fetch(`${API_BASE_URL}/api/auth/doctor/logout`, {
        method: "POST",
        credentials: "include",
        headers: { "X-XSRF-TOKEN": token },
      });
    }
  } catch {
    // Clear local authentication even if the server cannot be reached.
  } finally {
    accessToken = null;
    csrfToken = null;
  }
}

export async function authenticatedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const send = (token: string | null) => {
    const headers = new Headers(init.headers);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    else headers.delete("Authorization");
    return fetch(input, { ...init, headers });
  };

  let response = await send(accessToken);
  if (response.status !== 401) return response;

  let refreshed: TokenResponse | null;
  try {
    refreshed = await refreshSession();
  } catch {
    return response;
  }
  if (!refreshed) {
    accessToken = null;
    window.dispatchEvent(new Event("gbk-session-expired"));
    return response;
  }

  response = await send(refreshed.accessToken);
  return response;
}
