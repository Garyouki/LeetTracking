import { describe, it, expect, beforeEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { storage } from 'wxt/utils/storage';
import {
  getCurrentSchemaVersion,
  setSchemaVersion,
  runMigrations,
  migrations as appMigrations,
  type Migration,
} from '../migrations';
import { STORAGE_KEYS } from '../storage-keys';

describe('migrations', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  describe('getCurrentSchemaVersion', () => {
    it('should return 0 when no version is stored', async () => {
      const version = await getCurrentSchemaVersion();
      expect(version).toBe(0);
    });

    it('should return stored version', async () => {
      await storage.setItem(STORAGE_KEYS.schemaVersion, 5);
      const version = await getCurrentSchemaVersion();
      expect(version).toBe(5);
    });
  });

  describe('setSchemaVersion', () => {
    it('should set schema version', async () => {
      await setSchemaVersion(3);
      const stored = await storage.getItem(STORAGE_KEYS.schemaVersion);
      expect(stored).toBe(3);
    });
  });

  describe('runMigrations', () => {
    it('should run migrations in order', async () => {
      const executionOrder: number[] = [];

      const migrations: Migration[] = [
        {
          version: 3,
          description: 'Third migration',
          migrate: async () => {
            executionOrder.push(3);
          },
        },
        {
          version: 1,
          description: 'First migration',
          migrate: async () => {
            executionOrder.push(1);
          },
        },
        {
          version: 2,
          description: 'Second migration',
          migrate: async () => {
            executionOrder.push(2);
          },
        },
      ];

      await runMigrations(migrations);

      expect(executionOrder).toEqual([1, 2, 3]);
      expect(await getCurrentSchemaVersion()).toBe(3);
    });

    it('should only run migrations newer than current version', async () => {
      await setSchemaVersion(2);

      const executionOrder: number[] = [];
      const migrations: Migration[] = [
        {
          version: 1,
          description: 'Old migration',
          migrate: async () => {
            executionOrder.push(1);
          },
        },
        {
          version: 2,
          description: 'Current migration',
          migrate: async () => {
            executionOrder.push(2);
          },
        },
        {
          version: 3,
          description: 'New migration',
          migrate: async () => {
            executionOrder.push(3);
          },
        },
        {
          version: 4,
          description: 'Newer migration',
          migrate: async () => {
            executionOrder.push(4);
          },
        },
      ];

      await runMigrations(migrations);

      expect(executionOrder).toEqual([3, 4]);
      expect(await getCurrentSchemaVersion()).toBe(4);
    });

    it('should handle empty migrations array', async () => {
      await runMigrations([]);
      expect(await getCurrentSchemaVersion()).toBe(0);
    });

    it('should throw error for duplicate migration versions', async () => {
      const migrations: Migration[] = [
        {
          version: 1,
          description: 'First migration',
          migrate: async () => { },
        },
        {
          version: 2,
          description: 'Second migration',
          migrate: async () => { },
        },
        {
          version: 1,
          description: 'Duplicate version',
          migrate: async () => { },
        },
      ];

      await expect(runMigrations(migrations)).rejects.toThrow('Duplicate migration version detected: 1');
    });

    it('should stop and throw error if migration fails', async () => {
      const executionOrder: number[] = [];

      const migrations: Migration[] = [
        {
          version: 1,
          description: 'Success migration',
          migrate: async () => {
            executionOrder.push(1);
          },
        },
        {
          version: 2,
          description: 'Failing migration',
          migrate: async () => {
            executionOrder.push(2);
            throw new Error('Migration failed');
          },
        },
        {
          version: 3,
          description: 'Should not run',
          migrate: async () => {
            executionOrder.push(3);
          },
        },
      ];

      await expect(runMigrations(migrations)).rejects.toThrow('Failed to run migration 2');

      expect(executionOrder).toEqual([1, 2]);
      expect(await getCurrentSchemaVersion()).toBe(1); // Only first migration succeeded
    });

    it('should update version after each successful migration', async () => {
      const versions: number[] = [];

      const migrations: Migration[] = [
        {
          version: 1,
          description: 'First',
          migrate: async () => {
            // Version should still be 0 during first migration
            versions.push(await getCurrentSchemaVersion());
          },
        },
        {
          version: 2,
          description: 'Second',
          migrate: async () => {
            // Version should be 1 during second migration
            versions.push(await getCurrentSchemaVersion());
          },
        },
      ];

      await runMigrations(migrations);

      expect(versions).toEqual([0, 1]);
      expect(await getCurrentSchemaVersion()).toBe(2);
    });

    it('should migrate leetsrs storage keys to leettracking without overwriting existing new data', async () => {
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
      } as const;

      // Old data
      const oldCardId = 'card-123';
      await storage.setItem(OLD_KEYS.cards, {
        'two-sum': { id: oldCardId },
      });
      await storage.setItem(OLD_KEYS.stats, { '2026-01-01': { reviews: 1 } });
      await storage.setItem(`${OLD_KEYS.notes}:${oldCardId}` as const, { text: 'hello' });
      await storage.setItem(OLD_KEYS.maxNewCardsPerDay, 7);
      await storage.setItem(OLD_KEYS.dataUpdatedAt, '2026-01-01T00:00:00.000Z');

      // New data already present should not be overwritten
      await storage.setItem(STORAGE_KEYS.maxNewCardsPerDay, 99);

      await runMigrations(appMigrations);

      expect(await getCurrentSchemaVersion()).toBe(1);

      const newCards = await storage.getItem<Record<string, { id?: string }>>(STORAGE_KEYS.cards);
      expect(newCards?.['two-sum']?.id).toBe(oldCardId);

      const newStats = await storage.getItem<Record<string, unknown>>(STORAGE_KEYS.stats);
      expect(newStats).toBeTruthy();

      const newNote = await storage.getItem<{ text: string }>(`${STORAGE_KEYS.notes}:${oldCardId}` as const);
      expect(newNote?.text).toBe('hello');

      // Should not overwrite existing new value
      expect(await storage.getItem<number>(STORAGE_KEYS.maxNewCardsPerDay)).toBe(99);

      // Data that didn't exist in new storage should be copied
      expect(await storage.getItem<string>(STORAGE_KEYS.dataUpdatedAt)).toBe('2026-01-01T00:00:00.000Z');
    });
  });
});
