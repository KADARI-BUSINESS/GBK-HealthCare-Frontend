import { useEffect, useState } from "react";

export type TableColumn = {
  id: string;
  label: string;
  required?: boolean;
  defaultVisible?: boolean;
};

type Portal = "admin" | "doctor";
type Preference = { version: 1; hiddenColumnIds: string[] };

export function createColumnPreferenceKey(portal: Portal, userIdentity: string | number, tableId: string) {
  const value = String(userIdentity).trim().toLowerCase();
  let hash = 14695981039346656037n;
  const mask = (1n << 64n) - 1n;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash ^ BigInt(value.charCodeAt(index))) * 1099511628211n) & mask;
  }
  return `gbk:column-preferences:v1:${portal}:${hash.toString(16)}:${tableId}`;
}

function defaults(columns: TableColumn[]) {
  return new Set(columns.filter((column) => column.required || column.defaultVisible !== false).map((column) => column.id));
}

export function readColumnPreference(key: string, columns: TableColumn[]) {
  const visible = defaults(columns);
  if (typeof window === "undefined") return visible;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return visible;
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return visible;
    const preference = value as Partial<Preference>;
    if (preference.version !== 1 || !Array.isArray(preference.hiddenColumnIds)
        || preference.hiddenColumnIds.length > columns.length
        || !preference.hiddenColumnIds.every((id): id is string => typeof id === "string")) return visible;
    const known = new Set(columns.map((column) => column.id));
    for (const id of preference.hiddenColumnIds) {
      const column = columns.find((candidate) => candidate.id === id);
      if (known.has(id) && column && !column.required) visible.delete(id);
    }
  } catch {
    // Keep table defaults when browser storage is unavailable or malformed.
  }
  return visible;
}

export function writeColumnPreference(key: string, columns: TableColumn[], visible: Set<string>) {
  if (typeof window === "undefined") return;
  const hiddenColumnIds = columns.filter((column) => !column.required && !visible.has(column.id)).map((column) => column.id);
  try {
    window.localStorage.setItem(key, JSON.stringify({ version: 1, hiddenColumnIds } satisfies Preference));
  } catch {
    // Column visibility remains usable for the current page if storage is unavailable.
  }
}

export function useColumnVisibility(portal: Portal, userIdentity: string | number, tableId: string, columns: TableColumn[]) {
  const key = createColumnPreferenceKey(portal, userIdentity, tableId);
  const [saved, setSaved] = useState(() => ({ key, visible: readColumnPreference(key, columns) }));
  const visible = saved.key === key ? saved.visible : readColumnPreference(key, columns);

  useEffect(() => {
    if (saved.key === key) writeColumnPreference(key, columns, saved.visible);
  }, [columns, key, saved]);

  const setColumnVisible = (id: string, show: boolean) => {
    const column = columns.find((candidate) => candidate.id === id);
    if (!column || column.required) return;
    setSaved((current) => {
      const next = new Set(current.key === key ? current.visible : visible);
      if (show) next.add(id); else next.delete(id);
      return { key, visible: next };
    });
  };

  const showAll = () => setSaved({ key, visible: new Set(columns.map((column) => column.id)) });
  const resetToDefault = () => setSaved({ key, visible: defaults(columns) });
  const isVisible = (id: string) => visible.has(id);
  return { isVisible, visibleCount: visible.size, setColumnVisible, showAll, resetToDefault };
}
