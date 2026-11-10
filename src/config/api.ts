const PRODUCTION_API_BASE_URL = "https://d1za358jnqe9lo.cloudfront.net";

export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL?.trim() || PRODUCTION_API_BASE_URL
).replace(/\/+$/, "");

export const PATIENT_API_URL = `${API_BASE_URL}/api/patients`;
export const FOLLOW_UP_API_URL = `${API_BASE_URL}/api`;
