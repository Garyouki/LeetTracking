import { storage } from '#imports';
import { useState, useEffect } from 'react';
import { createDatabase } from '@/services/notion-sync';
import { getUserId } from '@/services/user';

export function NotionSyncSection() {
  const [enabled, setEnabled] = useState(false);
  const [notionToken, setNotionToken] = useState('');
  const [databaseId, setDatabaseId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [syncUrl, setSyncUrl] = useState('');
  const [parentPageId, setParentPageId] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [currentUserId, setCurrentUserId] = useState('');

  useEffect(() => {
    (async () => {
      setEnabled(await storage.getItem('local:notion-sync-enabled') ?? false);
      setNotionToken(await storage.getItem('local:notion-token') ?? '');
      setDatabaseId(await storage.getItem('local:notion-database-id') ?? '');
      setApiKey(await storage.getItem('local:notion-api-key') ?? '');
      setSyncUrl(await storage.getItem('local:notion-sync-url') ?? '');
      setParentPageId(await storage.getItem('local:notion-parent-page-id') ?? '');
      
      // Get and display current user ID for debugging
      try {
        const userId = await getUserId();
        setCurrentUserId(userId);
        console.log('Current user ID:', userId);
      } catch (error) {
        console.error('Failed to get user ID:', error);
        setCurrentUserId('Error: ' + (error as Error).message);
      }
    })();
  }, []);

  const updateStorage = async (key: string, value: any) => {
    await storage.setItem(`local:${key}`, value);
  };

  const handleCreateDatabase = async () => {
    if (!notionToken) {
      alert('Please enter your Notion token first');
      return;
    }
    if (!apiKey) {
      alert('Please enter your API key first');
      return;
    }
    if (!syncUrl) {
      alert('Please enter your Sync Service URL first');
      return;
    }

    setIsCreating(true);
    try {
      const result = await createDatabase('LeetSRS Tracking', parentPageId || undefined);
      alert(`Database created successfully! You can now start syncing.\nDatabase URL: ${result.databaseUrl}`);
      setDatabaseId(result.databaseId);
    } catch (error: any) {
      alert(`Failed to create database: ${error.message}`);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Notion Sync</h3>
        <button
          onClick={() => {
            const newState = !enabled;
            setEnabled(newState);
            updateStorage('notion-sync-enabled', newState);
          }}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            enabled ? 'bg-blue-600' : 'bg-gray-200'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              enabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* Debug info - show current user ID */}
      <div className="bg-gray-800 dark:bg-gray-800 p-2 rounded text-xs text-gray-300">
        <div className="font-mono break-all">User ID: {currentUserId}</div>
      </div>

      {enabled && (
        <>
          <div className="space-y-2">
            <label className="block text-sm font-medium">Notion Token</label>
            <input
              type="password"
              value={notionToken}
              onChange={(e) => {
                setNotionToken(e.target.value);
                updateStorage('notion-token', e.target.value);
              }}
              placeholder="secret_..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              maxLength={200}
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium">API Key (Your Own Worker)</label>
            <input
              type="text"
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                updateStorage('notion-api-key', e.target.value);
              }}
              placeholder="your-api-key"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
            <p className="text-xs text-gray-500">
              Use the API key from your own deployed worker. Do not share this key.
            </p>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium">Sync Service URL</label>
            <input
              type="text"
              value={syncUrl}
              onChange={(e) => {
                setSyncUrl(e.target.value);
                updateStorage('notion-sync-url', e.target.value);
              }}
              placeholder="https://your-worker.workers.dev"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
            <p className="text-xs text-gray-500">
              The deployed endpoint of your own sync worker.
            </p>
          </div>

          {!databaseId ? (
            // No database yet - show creation UI
            <>
              <div className="space-y-2">
                <label className="block text-sm font-medium">Parent Page ID *</label>
                <input
                  type="text"
                  value={parentPageId}
                  onChange={(e) => {
                    setParentPageId(e.target.value);
                    updateStorage('notion-parent-page-id', e.target.value);
                  }}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
                <p className="text-xs text-gray-500">
                  Required if your Notion workspace is empty. Create a page in Notion and copy its ID from the URL.
                </p>
              </div>

              <button
                onClick={handleCreateDatabase}
                disabled={isCreating || !notionToken || !apiKey || !syncUrl}
                className="w-full px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm"
              >
                {isCreating ? 'Creating...' : 'Auto-Create Database'}
              </button>
              <p className="text-xs text-gray-500">
                Don't have a database? Click this button to automatically create one with all required properties.
              </p>

              <div className="text-center py-2">
                <span className="text-xs text-gray-500">or</span>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium">Have an existing Database ID?</label>
                <input
                  type="text"
                  value={databaseId}
                  onChange={(e) => {
                    setDatabaseId(e.target.value);
                    updateStorage('notion-database-id', e.target.value);
                  }}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
                <p className="text-xs text-gray-500">
                  Enter your existing Notion database ID if you already have one.
                </p>
              </div>
            </>
          ) : (
            // Database exists - show database ID with option to change
            <div className="space-y-2">
              <label className="block text-sm font-medium">Database ID</label>
              <input
                type="text"
                value={databaseId}
                onChange={(e) => {
                  setDatabaseId(e.target.value);
                  updateStorage('notion-database-id', e.target.value);
                }}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
              <p className="text-xs text-gray-500">
                Database is configured and ready to sync.
              </p>
              <button
                onClick={() => setDatabaseId('')}
                className="w-full px-3 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-sm"
              >
                Clear Database ID
              </button>
              <p className="text-xs text-gray-500">
                Want to use a different database? Clear this ID to create or enter a new one.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
