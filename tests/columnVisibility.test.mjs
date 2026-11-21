import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createColumnPreferenceKey,
  readColumnPreference,
  writeColumnPreference,
} from "../src/components/common/columnVisibility.ts";

const columns = [
  { id: "patient", label: "Patient", required: true },
  { id: "patientId", label: "Patient ID", required: true },
  { id: "notes", label: "Notes" },
  { id: "actions", label: "Actions", required: true },
];

function installStorage() {
  const values = new Map();
  globalThis.window = {
    localStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    },
  };
  return values;
}

test("column visibility persists across a page reload using the versioned preference", () => {
  const values = installStorage();
  const key = createColumnPreferenceKey("doctor", 60001, "follow-ups");

  writeColumnPreference(key, columns, new Set(["patient", "patientId", "actions"]));
  const stored = JSON.parse(values.get(key));
  const restored = readColumnPreference(key, columns);

  assert.deepEqual(stored, { version: 1, hiddenColumnIds: ["notes"] });
  assert.deepEqual([...restored], ["patient", "patientId", "actions"]);
});

test("preferences are isolated by portal, user, and table", () => {
  assert.notEqual(createColumnPreferenceKey("doctor", 60001, "patient-records"), createColumnPreferenceKey("doctor", 60002, "patient-records"));
  assert.notEqual(createColumnPreferenceKey("doctor", 60001, "patient-records"), createColumnPreferenceKey("admin", "admin@example.test", "patient-records"));
  assert.notEqual(createColumnPreferenceKey("admin", "admin@example.test", "doctor-management"), createColumnPreferenceKey("admin", "admin@example.test", "approval-history"));
});

test("required columns stay visible even if saved storage attempts to hide them", () => {
  const values = installStorage();
  const key = createColumnPreferenceKey("doctor", 60001, "patient-records");
  values.set(key, JSON.stringify({ version: 1, hiddenColumnIds: ["patient", "patientId", "actions", "notes"] }));

  assert.deepEqual([...readColumnPreference(key, columns)], ["patient", "patientId", "actions"]);
});

test("invalid or old-version preference data falls back to visible defaults", () => {
  const values = installStorage();
  const key = createColumnPreferenceKey("doctor", 60001, "todays-visits");
  values.set(key, JSON.stringify({ version: 99, hiddenColumnIds: ["notes"] }));
  assert.deepEqual([...readColumnPreference(key, columns)], ["patient", "patientId", "notes", "actions"]);
  values.set(key, JSON.stringify({ version: 1, hiddenColumnIds: ["notes", 12] }));
  assert.deepEqual([...readColumnPreference(key, columns)], ["patient", "patientId", "notes", "actions"]);
});
