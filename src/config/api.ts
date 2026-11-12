const PRODUCTION_API_BASE_URL = "https://d1za358jnqe9lo.cloudfront.net";
const DEVELOPMENT_API_BASE_URL = "http://localhost:5000";

export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL?.trim() ||
  (import.meta.env.DEV ? DEVELOPMENT_API_BASE_URL : PRODUCTION_API_BASE_URL)
).replace(/\/+$/, "");

export const PATIENT_API_URL = `${API_BASE_URL}/api/patients`;
export const FOLLOW_UP_API_URL = `${API_BASE_URL}/api`;
