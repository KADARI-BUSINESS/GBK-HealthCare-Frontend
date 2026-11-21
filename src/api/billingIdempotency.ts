export type BillingAttemptOperation = "payment" | "refund";

export type BillingAttempt = {
  idempotencyKey: string;
  fingerprint: string;
};

type StoredAttempt = BillingAttempt & {
  version: 1;
  staffId: number;
  operation: BillingAttemptOperation;
  scopeId: number;
};

export class BillingAttemptError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BillingAttemptError";
  }
}

export class BillingAttemptDetailsChangedError extends BillingAttemptError {
  constructor(operation: BillingAttemptOperation) {
    super(
      `A pending ${operation} attempt exists with different details. Retry the original request or explicitly start a new attempt.`,
    );
    this.name = "BillingAttemptDetailsChangedError";
  }
}

export class BillingAttemptRecordError extends BillingAttemptError {
  constructor() {
    super(
      "The saved billing retry record is invalid. No new key was generated and no request was sent.",
    );
    this.name = "BillingAttemptRecordError";
  }
}

export class BillingAttemptStorageError extends BillingAttemptError {
  constructor(message = "Session storage is unavailable. No new key was generated and no request was sent.") {
    super(message);
    this.name = "BillingAttemptStorageError";
  }
}

export class BillingAttemptInProgressError extends BillingAttemptError {
  constructor() {
    super("A payment or refund request is still in progress. Wait for it to finish before signing out.");
    this.name = "BillingAttemptInProgressError";
  }
}

const STORAGE_PREFIX = "gbk.billing.idempotency.v1";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FINGERPRINT_PATTERN = /^[0-9a-f]{64}$/i;
const activeRequestsByStaff = new Map<number, number>();

export function beginBillingAttemptRequest(staffId: number): () => void {
  if (!Number.isSafeInteger(staffId) || staffId <= 0) throw new BillingAttemptRecordError();
  activeRequestsByStaff.set(staffId, (activeRequestsByStaff.get(staffId) ?? 0) + 1);
  let active = true;
  return () => {
    if (!active) return;
    active = false;
    const remaining = (activeRequestsByStaff.get(staffId) ?? 1) - 1;
    if (remaining > 0) activeRequestsByStaff.set(staffId, remaining);
    else activeRequestsByStaff.delete(staffId);
  };
}

export function hasActiveBillingAttemptRequest(staffId: number): boolean {
  return (activeRequestsByStaff.get(staffId) ?? 0) > 0;
}

function getSessionStorage(): Storage {
  try {
    if (typeof window === "undefined" || !window.sessionStorage) {
      throw new Error("Session storage is not available.");
    }
    return window.sessionStorage;
  } catch {
    throw new BillingAttemptStorageError();
  }
}

function getStorageKey(
  staffId: number,
  operation: BillingAttemptOperation,
  scopeId: number,
): string {
  if (!Number.isSafeInteger(staffId) || staffId <= 0 || !Number.isSafeInteger(scopeId) || scopeId <= 0) {
    throw new BillingAttemptRecordError();
  }
  return `${STORAGE_PREFIX}.${staffId}.${operation}.${scopeId}`;
}

function isStoredAttempt(value: unknown): value is StoredAttempt {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    record.version === 1 &&
    Number.isSafeInteger(record.staffId) &&
    (record.operation === "payment" || record.operation === "refund") &&
    Number.isSafeInteger(record.scopeId) &&
    typeof record.idempotencyKey === "string" &&
    UUID_PATTERN.test(record.idempotencyKey) &&
    typeof record.fingerprint === "string" &&
    FINGERPRINT_PATTERN.test(record.fingerprint)
  );
}

export function getOrCreateBillingAttempt(
  staffId: number,
  operation: BillingAttemptOperation,
  scopeId: number,
  fingerprint: string,
): BillingAttempt {
  if (!FINGERPRINT_PATTERN.test(fingerprint)) throw new BillingAttemptRecordError();
  const storageKey = getStorageKey(staffId, operation, scopeId);
  const storage = getSessionStorage();
  let serialized: string | null;
  try {
    serialized = storage.getItem(storageKey);
  } catch {
    throw new BillingAttemptStorageError();
  }

  if (serialized !== null) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(serialized);
    } catch {
      throw new BillingAttemptRecordError();
    }
    if (!isStoredAttempt(parsed)) throw new BillingAttemptRecordError();
    if (
      parsed.staffId !== staffId ||
      parsed.operation !== operation ||
      parsed.scopeId !== scopeId
    ) {
      throw new BillingAttemptRecordError();
    }
    if (parsed.fingerprint !== fingerprint) {
      throw new BillingAttemptDetailsChangedError(operation);
    }
    return { idempotencyKey: parsed.idempotencyKey, fingerprint: parsed.fingerprint };
  }

  let idempotencyKey: string;
  try {
    idempotencyKey = globalThis.crypto.randomUUID();
  } catch {
    throw new BillingAttemptStorageError(
      "A secure UUID could not be generated. No billing request was sent.",
    );
  }
  const attempt: StoredAttempt = {
    version: 1,
    staffId,
    operation,
    scopeId,
    idempotencyKey,
    fingerprint,
  };
  const serializedAttempt = JSON.stringify(attempt);
  try {
    storage.setItem(storageKey, serializedAttempt);
    if (storage.getItem(storageKey) !== serializedAttempt) {
      throw new Error("The billing retry record could not be verified.");
    }
  } catch {
    throw new BillingAttemptStorageError();
  }
  return { idempotencyKey, fingerprint };
}

export function replaceBillingAttemptWithNewKey(
  staffId: number,
  operation: BillingAttemptOperation,
  scopeId: number,
  fingerprint: string,
): BillingAttempt {
  if (!FINGERPRINT_PATTERN.test(fingerprint)) throw new BillingAttemptRecordError();
  const storageKey = getStorageKey(staffId, operation, scopeId);
  const storage = getSessionStorage();
  let idempotencyKey: string;
  try {
    idempotencyKey = globalThis.crypto.randomUUID();
  } catch {
    throw new BillingAttemptStorageError(
      "A secure UUID could not be generated. No billing request was sent.",
    );
  }
  const attempt: StoredAttempt = {
    version: 1,
    staffId,
    operation,
    scopeId,
    idempotencyKey,
    fingerprint,
  };
  const serializedAttempt = JSON.stringify(attempt);
  try {
    storage.setItem(storageKey, serializedAttempt);
    if (storage.getItem(storageKey) !== serializedAttempt) {
      throw new Error("The new billing retry record could not be verified.");
    }
  } catch {
    throw new BillingAttemptStorageError(
      "The new billing retry key could not be saved. No billing request was sent.",
    );
  }
  return { idempotencyKey, fingerprint };
}

export async function paymentRequestFingerprint(request: {
  invoiceId: number;
  amount: number;
  method: string;
  methodLabel: string | null;
  paymentReference: string | null;
}): Promise<string> {
  return hashRequest({
    invoiceId: request.invoiceId,
    amount: normalizeAmount(request.amount),
    method: request.method,
    methodLabel: normalizeText(request.methodLabel),
    paymentReference: normalizeText(request.paymentReference),
  });
}

export async function refundRequestFingerprint(request: {
  invoiceId: number;
  paymentId: number;
  amount: number;
  reason: string;
  refundReference: string | null;
}): Promise<string> {
  return hashRequest({
    invoiceId: request.invoiceId,
    paymentId: request.paymentId,
    amount: normalizeAmount(request.amount),
    reason: request.reason.trim(),
    refundReference: normalizeText(request.refundReference),
  });
}

export function clearBillingAttempt(
  staffId: number,
  operation: BillingAttemptOperation,
  scopeId: number,
): void {
  const storage = getSessionStorage();
  const storageKey = getStorageKey(staffId, operation, scopeId);
  try {
    storage.removeItem(storageKey);
    if (storage.getItem(storageKey) !== null) {
      throw new Error("The billing retry record could not be removed.");
    }
  } catch {
    throw new BillingAttemptStorageError(
      "The pending billing key could not be cleared. Keep retrying the original details; do not start a new attempt.",
    );
  }
}

export function clearStaffBillingAttempts(staffId: number): void {
  if (!Number.isSafeInteger(staffId) || staffId <= 0) throw new BillingAttemptRecordError();
  if (hasActiveBillingAttemptRequest(staffId)) {
    throw new BillingAttemptInProgressError();
  }
  const storage = getSessionStorage();
  const prefix = `${STORAGE_PREFIX}.${staffId}.`;
  try {
    for (let index = storage.length - 1; index >= 0; index -= 1) {
      const key = storage.key(index);
      if (key?.startsWith(prefix)) storage.removeItem(key);
    }
    for (let index = 0; index < storage.length; index += 1) {
      if (storage.key(index)?.startsWith(prefix)) {
        throw new Error("Pending billing keys remain in session storage.");
      }
    }
  } catch {
    throw new BillingAttemptStorageError(
      "Pending billing retry keys could not be cleared from this tab.",
    );
  }
}

function normalizeAmount(amount: number): string {
  if (!Number.isFinite(amount)) throw new BillingAttemptRecordError();
  return amount.toFixed(2);
}

function normalizeText(value: string | null): string | null {
  const normalized = value?.trim();
  return normalized || null;
}

async function hashRequest(request: object): Promise<string> {
  try {
    const bytes = new TextEncoder().encode(JSON.stringify(request));
    const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
  } catch {
    throw new BillingAttemptStorageError(
      "A secure request fingerprint could not be created. No billing request was sent.",
    );
  }
}
