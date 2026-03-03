import { getUserId } from './user';
import { storage } from '#imports';

interface ReviewPayload {
  userId: string;
  problem: {
    id: number;
    slug: string;
    title: string;
    difficulty: 'Easy' | 'Medium' | 'Hard';
    tags?: string[];
  };
  rating: 'Again' | 'Hard' | 'Good' | 'Easy';
  note?: string;
  reviewedAt?: string;
  notionToken?: string;
  notionDatabaseId?: string;
}

type NotionSyncConfig = {
  apiKey: string;
  syncUrl: string;
};

async function getNotionSyncConfig(): Promise<NotionSyncConfig> {
  const apiKey = ((await storage.getItem('local:notion-api-key')) as string | undefined)?.trim();
  const syncUrl = ((await storage.getItem('local:notion-sync-url')) as string | undefined)?.trim();

  if (!syncUrl) {
    throw new Error('Sync service URL is required');
  }
  if (!apiKey) {
    throw new Error('API key is required');
  }

  return { apiKey, syncUrl };
}

export async function createNotionDatabase(notionToken: string, databaseName?: string, parentPageId?: string) {
  // First, get user's workspace pages to find a suitable parent
  let targetPageId = parentPageId;

  if (!targetPageId) {
    // Search for a suitable parent page
    const searchResp = await fetch('https://api.notion.com/v1/search', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${notionToken}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filter: {
          property: 'object',
          value: 'page',
        },
        page_size: 10,
      }),
    });

    if (!searchResp.ok) {
      const errorText = await searchResp.text();
      throw new Error(`Failed to search for pages: ${errorText}`);
    }

    const searchResult = await searchResp.json();

    // Use the first page found as parent
    if (searchResult.results && searchResult.results.length > 0) {
      targetPageId = searchResult.results[0].id;
      console.log('Using page as parent:', targetPageId);
    } else {
      throw new Error('No pages found in workspace. Please create a page first or provide a parent page ID.');
    }
  }

  // Create the database with all required properties
  const createResp = await fetch('https://api.notion.com/v1/databases', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${notionToken}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      parent: { type: 'page_id', page_id: targetPageId },
      title: [
        {
          type: 'text',
          text: { content: databaseName || 'LeetSRS Tracking' },
        },
      ],
      properties: {
        Name: { title: {} },
        'LC ID': { number: {} },
        Slug: { rich_text: {} },
        URL: { url: {} },
        Difficulty: {
          select: {
            options: [
              { name: 'Easy', color: 'green' },
              { name: 'Medium', color: 'yellow' },
              { name: 'Hard', color: 'red' },
            ],
          },
        },
        Status: {
          select: {
            options: [
              { name: 'New', color: 'gray' },
              { name: 'Learning', color: 'blue' },
              { name: 'Reviewing', color: 'orange' },
              { name: 'Mastered', color: 'green' },
            ],
          },
        },
        'Next Due': { date: {} },
        'My Notes': { rich_text: {} },
        Tags: {
          multi_select: {
            options: [
              { name: 'Array', color: 'brown' },
              { name: 'String', color: 'brown' },
              { name: 'Linked List', color: 'brown' },
              { name: 'Tree', color: 'brown' },
              { name: 'Graph', color: 'brown' },
              { name: 'Dynamic Programming', color: 'brown' },
              { name: 'Backtracking', color: 'brown' },
              { name: 'Greedy', color: 'brown' },
              { name: 'Binary Search', color: 'brown' },
              { name: 'Math', color: 'brown' },
              { name: 'Two Pointers', color: 'brown' },
              { name: 'Bit Manipulation', color: 'brown' },
              { name: 'Stack', color: 'brown' },
              { name: 'Queue', color: 'brown' },
              { name: 'Heap', color: 'brown' },
              { name: 'Trie', color: 'brown' },
              { name: 'Divide and Conquer', color: 'brown' },
              { name: 'Sliding Window', color: 'brown' },
              { name: 'Hash Table', color: 'brown' },
              { name: 'Sorting', color: 'brown' },
            ],
          },
        },
      },
    }),
  });

  if (!createResp.ok) {
    const errorText = await createResp.text();
    console.error('Database creation failed:', errorText);
    throw new Error(`Database creation failed: ${errorText}`);
  }

  const result = await createResp.json();
  console.log('Database created successfully:', result.id);

  return result;
}

export async function syncReview(payload: Omit<ReviewPayload, 'userId' | 'notionToken' | 'notionDatabaseId'>) {
  let userId: string;
  try {
    userId = await getUserId();
    console.log('Got current user ID:', userId);
  } catch (error) {
    console.error('Failed to get user ID for Notion sync:', error);
    throw new Error('Google login required for Notion sync. Please sign in with Google first.');
  }

  const notionToken = (await storage.getItem('local:notion-token')) as string | undefined;
  const notionDatabaseId = (await storage.getItem('local:notion-database-id')) as string | undefined;
  const { apiKey, syncUrl } = await getNotionSyncConfig();

  console.log('syncReview called with:', {
    userId,
    hasNotionToken: !!notionToken,
    hasNotionDatabaseId: !!notionDatabaseId,
    hasApiKey: !!apiKey,
    syncUrl,
  });

  // Check if this is a new Google account and we have old data
  if (userId.startsWith('google:') && notionDatabaseId) {
    console.log('User is using Google account, checking if we need to migrate data...');
    // The worker will handle data migration based on the new user ID
  }

  const body: ReviewPayload = {
    userId,
    notionToken,
    notionDatabaseId,
    ...payload,
  };

  console.log('Sending request to:', syncUrl);
  console.log('Request body:', body);

  const resp = await fetch(syncUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      apiKey,
      action: 'review',
      payload: body,
    }),
  });

  console.log('Response status:', resp.status);
  console.log('Response headers:', resp.headers);

  if (!resp.ok) {
    const err = await resp.text();
    console.error('Response error body:', err);
    throw new Error(`Sync failed: ${err}`);
  }
  return resp.json();
}

export async function getDueProblems() {
  const userId = await getUserId();
  const { apiKey, syncUrl } = await getNotionSyncConfig();

  const res = await fetch(syncUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apiKey,
      action: 'due',
      payload: { userId },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Fetch due failed: ${err}`);
  }
  return res.json();
}

export async function createDatabase(databaseName?: string, parentPageId?: string) {
  const notionToken = (await storage.getItem('local:notion-token')) as string | undefined;
  const { apiKey, syncUrl } = await getNotionSyncConfig();

  if (!notionToken) {
    throw new Error('Notion token is required');
  }

  const res = await fetch(syncUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apiKey,
      action: 'create-database',
      payload: {
        notionToken,
        databaseName: databaseName || 'LeetSRS Tracking',
        parentPageId,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Database creation failed: ${err}`);
  }

  const result = await res.json();

  // Auto-save the created database ID
  await storage.setItem('local:notion-database-id', result.databaseId);

  return result;
}
