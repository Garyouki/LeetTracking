import { storage } from '#imports';
import { STORAGE_KEYS } from './storage-keys';

export interface Migration {
  version: number;
  description: string;
  migrate: () => Promise<void>;
}

const SCHEMA_VERSION_KEY = STORAGE_KEYS.schemaVersion;

export async function getCurrentSchemaVersion(): Promise<number> {
  const version = await storage.getItem<number>(SCHEMA_VERSION_KEY);
  return version ?? 0;
}

export async function setSchemaVersion(version: number): Promise<void> {
  await storage.setItem(SCHEMA_VERSION_KEY, version);
}

export async function runMigrations(migrations: Migration[]): Promise<void> {
  // Check for duplicate version numbers
  const seenVersions = new Set<number>();
  for (const migration of migrations) {
    if (seenVersions.has(migration.version)) {
      throw new Error(`Duplicate migration version detected: ${migration.version}`);
    }
    seenVersions.add(migration.version);
  }

  const currentVersion = await getCurrentSchemaVersion();
  const sortedMigrations = [...migrations].sort((a, b) => a.version - b.version);

  for (const migration of sortedMigrations) {
    if (migration.version > currentVersion) {
      try {
        await migration.migrate();
        await setSchemaVersion(migration.version);
      } catch (error) {
        throw new Error(`Failed to run migration ${migration.version}: ${error}`);
      }
    }
  }
}

export const migrations: Migration[] = [
  {
    version: 1,
    description: 'Migrate storage keys prefix from leetsrs to leettracking',
    migrate: async () => {
      const OLD_KEYS = {
        cards: 'local:leetsrs:cards',
        stats: 'local:leetsrs:stats',
        notes: 'local:leetsrs:notes',
        maxNewCardsPerDay: 'sync:leetsrs:maxNewCardsPerDay',
        dayStartHour: 'sync:leetsrs:dayStartHour',
        animationsEnabled: 'sync:leetsrs:animationsEnabled',
        theme: 'sync:leetsrs:theme',
        autoClearLeetcode: 'sync:leetsrs:autoClearLeetcode',
        dataUpdatedAt: 'local:leetsrs:dataUpdatedAt',
        githubPat: 'sync:leetsrs:githubPat',
        gistId: 'sync:leetsrs:gistId',
        gistSyncEnabled: 'sync:leetsrs:gistSyncEnabled',
        lastSyncTime: 'local:leetsrs:lastSyncTime',
        lastSyncDirection: 'local:leetsrs:lastSyncDirection',
      } as const;

      const KEY_MAP = [
        { oldKey: OLD_KEYS.cards, newKey: STORAGE_KEYS.cards },
        { oldKey: OLD_KEYS.stats, newKey: STORAGE_KEYS.stats },
        { oldKey: OLD_KEYS.maxNewCardsPerDay, newKey: STORAGE_KEYS.maxNewCardsPerDay },
        { oldKey: OLD_KEYS.dayStartHour, newKey: STORAGE_KEYS.dayStartHour },
        { oldKey: OLD_KEYS.animationsEnabled, newKey: STORAGE_KEYS.animationsEnabled },
        { oldKey: OLD_KEYS.theme, newKey: STORAGE_KEYS.theme },
        { oldKey: OLD_KEYS.autoClearLeetcode, newKey: STORAGE_KEYS.autoClearLeetcode },
        { oldKey: OLD_KEYS.dataUpdatedAt, newKey: STORAGE_KEYS.dataUpdatedAt },
        { oldKey: OLD_KEYS.githubPat, newKey: STORAGE_KEYS.githubPat },
        { oldKey: OLD_KEYS.gistId, newKey: STORAGE_KEYS.gistId },
        { oldKey: OLD_KEYS.gistSyncEnabled, newKey: STORAGE_KEYS.gistSyncEnabled },
        { oldKey: OLD_KEYS.lastSyncTime, newKey: STORAGE_KEYS.lastSyncTime },
        { oldKey: OLD_KEYS.lastSyncDirection, newKey: STORAGE_KEYS.lastSyncDirection },
      ] as const;

      for (const { oldKey, newKey } of KEY_MAP) {
        const existingNewValue = await storage.getItem<unknown>(newKey);
        if (existingNewValue != null) continue;

        const oldValue = await storage.getItem<unknown>(oldKey);
        if (oldValue == null) continue;

        await storage.setItem(newKey, oldValue);
      }

      // Notes are stored per-card with the card UUID as the suffix.
      // We migrate notes for all cards found in the old cards store.
      const oldCards =
        (await storage.getItem<Record<string, { id?: string }>>(OLD_KEYS.cards)) ?? ({} as Record<string, { id?: string }>);

      const cardIds = new Set<string>();
      for (const storedCard of Object.values(oldCards)) {
        if (storedCard?.id && typeof storedCard.id === 'string') {
          cardIds.add(storedCard.id);
        }
      }

      for (const cardId of cardIds) {
        const oldNoteKey = `${OLD_KEYS.notes}:${cardId}` as const;
        const newNoteKey = `${STORAGE_KEYS.notes}:${cardId}` as const;

        const existingNewNote = await storage.getItem<unknown>(newNoteKey);
        if (existingNewNote != null) continue;

        const oldNote = await storage.getItem<unknown>(oldNoteKey);
        if (oldNote == null) continue;

        await storage.setItem(newNoteKey, oldNote);
      }
    },
  },
  // Example migration (version 1):
  // {
  //   version: 1,
  //   description: 'Add difficulty field to cards',
  //   migrate: async () => {
  //     const cards = await storage.getItem<Record<string, any>>(STORAGE_KEYS.cards);
  //     if (cards) {
  //       for (const cardId in cards) {
  //         if (!cards[cardId].difficulty) {
  //           cards[cardId].difficulty = 'medium';
  //         }
  //       }
  //       await storage.setItem(STORAGE_KEYS.cards, cards);
  //     }
  //   }
  // }
];
