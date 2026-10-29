export interface RecentSessionAssignment {
  id: string;
  updatedAt?: number | null;
}

export interface VisibleSessionCategoryGroup<T> {
  key: string;
  label: string;
  sessions: T[];
}

export interface RecentSessionPartition<T> {
  group: VisibleSessionCategoryGroup<T>;
  /** Sessions outside the visible recent window, newest first. */
  remaining: T[];
}

export function partitionRecentSessions<T extends RecentSessionAssignment>(
  sessions: readonly T[],
  limit: number,
  label: string,
): RecentSessionPartition<T> {
  const requested = Math.floor(Number(limit));
  const safeLimit = Number.isFinite(requested) && requested > 0 ? requested : sessions.length;
  const sorted = [...sessions].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  return {
    group: {
      key: "recent",
      label,
      sessions: sorted.slice(0, safeLimit),
    },
    remaining: sorted.slice(safeLimit),
  };
}
