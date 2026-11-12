export type DashboardStats = {
  totalPatients: number;
  todaysVisits: number;
  availableDoctors: number;
  pendingFollowUps: number;
  registeredRecords: number;
  clinicalNotes: number;
};

const CACHE_TTL_MS = 30_000;
const statsByDoctor = new Map<
  string,
  { stats: DashboardStats; storedAt: number }
>();

export function getCachedDashboardStats(
  doctorEmail: string,
): DashboardStats | null {
  const entry = statsByDoctor.get(doctorEmail);
  if (!entry) return null;
  if (Date.now() - entry.storedAt > CACHE_TTL_MS) {
    statsByDoctor.delete(doctorEmail);
    return null;
  }
  return entry.stats;
}

export function cacheDashboardStats(
  doctorEmail: string,
  stats: DashboardStats,
) {
  statsByDoctor.set(doctorEmail, { stats, storedAt: Date.now() });
}

export function clearDashboardStatsCache() {
  statsByDoctor.clear();
}

export function notifyDashboardStatsChanged() {
  clearDashboardStatsCache();
  window.dispatchEvent(new Event("gbk-dashboard-stats-invalidated"));
}
