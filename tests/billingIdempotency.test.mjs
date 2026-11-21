import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BillingAttemptDetailsChangedError,
  BillingAttemptInProgressError,
  BillingAttemptRecordError,
  BillingAttemptStorageError,
  beginBillingAttemptRequest,
  clearBillingAttempt,
  clearStaffBillingAttempts,
  getOrCreateBillingAttempt,
  replaceBillingAttemptWithNewKey,
} from "../src/api/billingIdempotency.ts";

function installStorage() {
  const values = new Map();
  globalThis.window = {
    sessionStorage: {
      get length() {
        return values.size;
      },
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
      key: (index) => [...values.keys()][index] ?? null,
    },
  };
  return values;
}

const fingerprintA = "a".repeat(64);
const fingerprintB = "b".repeat(64);

test("saved payment and refund keys survive module reloads and are scoped by staff, operation, and record", async () => {
  installStorage();
  const payment = getOrCreateBillingAttempt(701, "payment", 3001, fingerprintA);
  const reloadedModule = await import(`../src/api/billingIdempotency.ts?reload=${Date.now()}`);
  const restoredPayment = reloadedModule.getOrCreateBillingAttempt(701, "payment", 3001, fingerprintA);
  const refund = getOrCreateBillingAttempt(701, "refund", 4001, fingerprintA);
  const otherStaff = getOrCreateBillingAttempt(702, "payment", 3001, fingerprintA);
  const otherInvoice = getOrCreateBillingAttempt(701, "payment", 3002, fingerprintA);

  assert.equal(restoredPayment.idempotencyKey, payment.idempotencyKey);
  assert.notEqual(refund.idempotencyKey, payment.idempotencyKey);
  assert.notEqual(otherStaff.idempotencyKey, payment.idempotencyKey);
  assert.notEqual(otherInvoice.idempotencyKey, payment.idempotencyKey);
});

test("changed request details cannot reuse a pending key", () => {
  installStorage();
  const original = getOrCreateBillingAttempt(703, "payment", 3003, fingerprintA);

  assert.throws(
    () => getOrCreateBillingAttempt(703, "payment", 3003, fingerprintB),
    BillingAttemptDetailsChangedError,
  );
  assert.equal(
    getOrCreateBillingAttempt(703, "payment", 3003, fingerprintA).idempotencyKey,
    original.idempotencyKey,
  );
});

test("an explicitly confirmed new attempt replaces the pending key for its new fingerprint", () => {
  installStorage();
  const original = getOrCreateBillingAttempt(710, "payment", 3010, fingerprintA);

  const next = replaceBillingAttemptWithNewKey(710, "payment", 3010, fingerprintB);

  assert.notEqual(next.idempotencyKey, original.idempotencyKey);
  assert.equal(
    getOrCreateBillingAttempt(710, "payment", 3010, fingerprintB).idempotencyKey,
    next.idempotencyKey,
  );
});

test("confirmed success cleanup allows a new key for a new attempt", () => {
  installStorage();
  const original = getOrCreateBillingAttempt(704, "refund", 4004, fingerprintA);

  clearBillingAttempt(704, "refund", 4004);
  const next = getOrCreateBillingAttempt(704, "refund", 4004, fingerprintB);

  assert.notEqual(next.idempotencyKey, original.idempotencyKey);
});

test("logout clears only the current staff member's saved billing keys", () => {
  installStorage();
  const currentStaff = getOrCreateBillingAttempt(705, "payment", 3005, fingerprintA);
  const otherStaff = getOrCreateBillingAttempt(706, "refund", 4006, fingerprintA);

  clearStaffBillingAttempts(705);

  assert.notEqual(
    getOrCreateBillingAttempt(705, "payment", 3005, fingerprintA).idempotencyKey,
    currentStaff.idempotencyKey,
  );
  assert.equal(
    getOrCreateBillingAttempt(706, "refund", 4006, fingerprintA).idempotencyKey,
    otherStaff.idempotencyKey,
  );
});

test("malformed storage and unavailable storage fail closed without generating a request key", () => {
  const values = installStorage();
  values.set("gbk.billing.idempotency.v1.707.payment.3007", "{malformed");
  assert.throws(
    () => getOrCreateBillingAttempt(707, "payment", 3007, fingerprintA),
    BillingAttemptRecordError,
  );

  globalThis.window = {};
  assert.throws(
    () => getOrCreateBillingAttempt(708, "payment", 3008, fingerprintA),
    BillingAttemptStorageError,
  );
});

test("logout cannot clear a key while its payment or refund request is in flight", () => {
  installStorage();
  getOrCreateBillingAttempt(709, "payment", 3009, fingerprintA);
  const finish = beginBillingAttemptRequest(709);

  assert.throws(() => clearStaffBillingAttempts(709), BillingAttemptInProgressError);
  finish();
  clearStaffBillingAttempts(709);
  assert.equal(globalThis.window.sessionStorage.length, 0);
});
