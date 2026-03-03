export const STORAGE_KEYS = {
  cards: 'local:leettracking:cards',
  stats: 'local:leettracking:stats',
  notes: 'local:leettracking:notes',
  maxNewCardsPerDay: 'sync:leettracking:maxNewCardsPerDay',
  dayStartHour: 'sync:leettracking:dayStartHour',
  animationsEnabled: 'sync:leettracking:animationsEnabled',
  theme: 'sync:leettracking:theme',
  autoClearLeetcode: 'sync:leettracking:autoClearLeetcode',
  schemaVersion: 'local:leettracking:schemaVersion',
  // Tracks when actual data was last modified (for sync)
  dataUpdatedAt: 'local:leettracking:dataUpdatedAt',
  // GitHub Gist Sync
  githubPat: 'sync:leettracking:githubPat',
  gistId: 'sync:leettracking:gistId',
  gistSyncEnabled: 'sync:leettracking:gistSyncEnabled',
  lastSyncTime: 'local:leettracking:lastSyncTime',
  lastSyncDirection: 'local:leettracking:lastSyncDirection',
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

export function getNoteStorageKey(cardId: string): `local:leettracking:notes:${string}` {
  return `${STORAGE_KEYS.notes}:${cardId}`;
}
