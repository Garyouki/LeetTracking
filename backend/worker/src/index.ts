import { createNotionPage } from './notion';
import { calculateNext } from './srs';

// 1. Define common CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request: Request, env: any): Promise<Response> {
    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: corsHeaders, // Use constant
      });
    }

    if (request.method !== 'POST') {
      // Add headers to 405 response
      return new Response('Method not allowed', {
        status: 405,
        headers: corsHeaders
      });
    }

    try {
      const { apiKey, action, payload } = await request.json();
      if (apiKey !== env.API_KEY) {
        // Add headers to 401 response
        return new Response('Unauthorized', {
          status: 401,
          headers: corsHeaders
        });
      }

      switch (action) {
        case 'review':
          return await handleReview(env, payload);
        case 'due':
          return await handleDue(env, payload);
        case 'setup-database':
          return await setupDatabase(env, payload);
        case 'create-database':
          return await createDatabase(env, payload);
        case 'sync-from-notion':
          return await syncFromNotion(env, payload);
        default:
          // Add headers to 400 response
          return new Response('Unknown action', {
            status: 400,
            headers: corsHeaders
          });
      }
    } catch (e: any) {
      console.error('Worker error', e);
      // Add headers to 500 response
      // Return error message for debugging
      return new Response(`Internal error: ${e.message}`, {
        status: 500,
        headers: corsHeaders
      });
    }
  },
};

async function handleReview(env: any, p: any) {
  const { userId, problem, rating, note, reviewedAt } = p;
  const problemId = `leetcode:${problem.id}`;
  const logId = `log:${Date.now()}:${problem.id}`;

  // Insert or update problem
  await env.DB.prepare(
    `INSERT OR REPLACE INTO problems (id, user_id, leetcode_id, slug, title, difficulty, tags, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    problemId,
    userId,
    problem.id,
    problem.slug,
    problem.title,
    problem.difficulty,
    JSON.stringify(problem.tags || []),
    'New',
    new Date().toISOString(),
    new Date().toISOString()
  ).run();

  // Get current SRS state
  const stateRow = await env.DB.prepare(
    `SELECT * FROM srs_state WHERE problem_id = ? AND user_id = ?`
  ).bind(problemId, userId).first();

  const newState = calculateNext(stateRow, rating, problem.difficulty);

  // Update SRS state
  await env.DB.prepare(
    `INSERT OR REPLACE INTO srs_state (problem_id, user_id, repetitions, interval_days, easiness_factor, last_reviewed_at, next_due_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    problemId,
    userId,
    newState.repetitions,
    newState.interval_days,
    newState.easiness_factor,
    newState.last_reviewed_at,
    newState.next_due_at,
    new Date().toISOString()
  ).run();

  // Insert review log
  await env.DB.prepare(
    `INSERT INTO review_logs (id, user_id, problem_id, reviewed_at, rating, action, raw_payload, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    logId,
    userId,
    problemId,
    reviewedAt || new Date().toISOString(),
    rating,
    'Review',
    JSON.stringify(p),
    new Date().toISOString()
  ).run();

  // Write to Notion (if user provided token/database)
  if (p.notionToken && p.notionDatabaseId) {
    try {
      console.log('Attempting to write to Notion...', {
        hasToken: !!p.notionToken,
        databaseId: p.notionDatabaseId,
        problemId,
        tokenLength: p.notionToken ? p.notionToken.length : 0,
        tokenPrefix: p.notionToken ? p.notionToken.substring(0, 10) : 'none',
      });

      // Check if page already exists by Slug
      const existing = await fetch(
        `https://api.notion.com/v1/databases/${p.notionDatabaseId}/query`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${p.notionToken}`,
            'Notion-Version': '2022-06-28',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            filter: {
              property: 'Slug',
              rich_text: { equals: problem.slug },
            },
          }),
        }
      );

      console.log('Notion query response status:', existing.status);

      if (!existing.ok) {
        const errorText = await existing.text();
        console.error('Notion query failed:', errorText);
        throw new Error(`Notion query failed: ${errorText}`);
      }

      const existingData = await existing.json();
      console.log('Notion query result:', existingData);

      const pagePayload = {
        parent: { database_id: p.notionDatabaseId },
        properties: {
          Name: {
            title: [{ text: { content: `[${problem.id}] ${problem.title}` } }],
          },
          'LC ID': { number: problem.id },
          Slug: { rich_text: [{ text: { content: problem.slug } }] },
          URL: { url: `https://leetcode.com/problems/${problem.slug}/` },
          Difficulty: { select: { name: problem.difficulty } },
          Status: { select: { name: 'Reviewing' } },
          'Next Due': { date: { start: newState.next_due_at.split('T')[0] } },
          'My Notes': { rich_text: [{ text: { content: note || '' } }] },
          Tags: {
            multi_select: (problem.tags || []).map((tag: any) => ({ name: tag.name }))
          },
        },
      };

      if (existingData.results && existingData.results.length > 0) {
        console.log('Updating existing Notion page:', existingData.results[0].id);
        // Update existing page
        const updateResp = await fetch(`https://api.notion.com/v1/pages/${existingData.results[0].id}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${p.notionToken}`,
            'Notion-Version': '2022-06-28',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ properties: pagePayload.properties }),
        });
        console.log('Notion update response status:', updateResp.status);
        if (!updateResp.ok) {
          const errorText = await updateResp.text();
          console.error('Notion update error:', errorText);
        }
      } else {
        console.log('Creating new Notion page');
        // Create new page
        const createResp = await createNotionPage(p.notionToken, p.notionDatabaseId, pagePayload);
        console.log('Notion create response:', createResp);
      }
    } catch (e) {
      console.error('Notion write failed:', e);
      console.error('Notion error details:', (e as Error).message, (e as Error).stack);
      // Do not fail the whole request
    }
  } else {
    console.log('Skipping Notion write - missing token or database ID', {
      hasToken: !!p.notionToken,
      hasDatabaseId: !!p.notionDatabaseId,
    });
  }

  return Response.json({ ok: true, nextDue: newState.next_due_at }, {
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
  });
}

async function handleDue(env: any, p: any) {
  const { userId } = p;
  const rows = await env.DB.prepare(
    `SELECT p.*, s.next_due_at FROM problems p
     JOIN srs_state s ON p.id = s.problem_id AND p.user_id = s.user_id
     WHERE p.user_id = ? AND s.next_due_at <= datetime('now')
     ORDER BY s.next_due_at ASC`
  ).bind(userId).all();

  return Response.json({ ok: true, due: rows.results || [] }, {
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
  });
}

async function syncFromNotion(env: any, p: any) {
  const { userId, notionToken, databaseId } = p;

  console.log('Starting sync from Notion to D1 for user:', userId);

  // 1. Get all pages from Notion
  const notionPages = [];
  let cursor = undefined;

  do {
    const queryBody = cursor ? { start_cursor: cursor } : {};

    const response = await fetch(
      `https://api.notion.com/v1/databases/${databaseId}/query`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${notionToken}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(queryBody),
      }
    ).then((r) => r.json());

    notionPages.push(...response.results);
    cursor = response.next_cursor;
  } while (cursor);

  console.log(`Found ${notionPages.length} pages in Notion`);

  // 2. Get all problems from D1
  const d1Problems = await env.DB.prepare(
    `SELECT id, user_id FROM problems WHERE user_id = ?`
  ).bind(userId).all();

  const d1ProblemIds = new Set(d1Problems.results.map((p: any) => p.id));
  const notionProblemIds = new Set();

  // 3. Sync Notion pages to D1
  for (const page of notionPages) {
    const props = page.properties;
    const lcId = props['LC ID']?.number;
    const slug = props.Slug?.rich_text?.[0]?.plain_text;
    const title = props.Name?.title?.[0]?.plain_text;
    const difficulty = props.Difficulty?.select?.name;
    const nextDue = props['Next Due']?.date?.start;
    const notes = props['My Notes']?.rich_text?.[0]?.plain_text;

    if (!lcId || !slug) continue;

    const problemId = `leetcode:${lcId}`;
    notionProblemIds.add(problemId);

    // Update or insert problem
    await env.DB.prepare(`
      INSERT OR REPLACE INTO problems 
      (id, user_id, leetcode_id, slug, title, difficulty, tags, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      problemId,
      userId,
      lcId.toString(),
      slug,
      title || '',
      difficulty || 'Medium',
      JSON.stringify([]), // Tags not stored in Notion for now
      'Reviewing',
      new Date().toISOString(),
      new Date().toISOString()
    ).run();

    // Update SRS state if nextDue exists
    if (nextDue) {
      await env.DB.prepare(`
        INSERT OR REPLACE INTO srs_state
        (problem_id, user_id, repetitions, interval_days, easiness_factor, last_reviewed_at, next_due_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        problemId,
        userId,
        1, // Default repetitions
        1, // Default interval
        2.5, // Default easiness
        new Date().toISOString(),
        nextDue,
        new Date().toISOString()
      ).run();
    }
  }

  // 4. Delete D1 problems that don't exist in Notion
  for (const problemId of d1ProblemIds) {
    if (!notionProblemIds.has(problemId)) {
      await env.DB.prepare(`DELETE FROM problems WHERE id = ? AND user_id = ?`).bind(problemId, userId).run();
      await env.DB.prepare(`DELETE FROM srs_state WHERE problem_id = ? AND user_id = ?`).bind(problemId, userId).run();
      await env.DB.prepare(`DELETE FROM review_logs WHERE problem_id = ? AND user_id = ?`).bind(problemId, userId).run();
    }
  }

  console.log(`Sync completed: ${notionProblemIds.size} problems synced, ${d1ProblemIds.size - notionProblemIds.size} problems deleted`);

  return Response.json({
    ok: true,
    message: 'Sync completed',
    synced: notionProblemIds.size,
    deleted: d1ProblemIds.size - notionProblemIds.size
  }, {
    headers: corsHeaders,
  });
}

async function createDatabase(env: any, p: any) {
  const { notionToken, databaseName, parentPageId } = p;

  console.log('Creating new Notion database:', databaseName);

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

  return Response.json({
    ok: true,
    message: 'Database created successfully',
    databaseId: result.id,
    databaseUrl: result.url,
  }, {
    headers: corsHeaders,
  });
}

async function setupDatabase(env: any, p: any) {
  const { notionToken, databaseId } = p;

  // First, get current database structure
  const dbInfo = await fetch(
    `https://api.notion.com/v1/databases/${databaseId}`,
    {
      headers: {
        Authorization: `Bearer ${notionToken}`,
        'Notion-Version': '2022-06-28',
      },
    }
  ).then((r) => r.json());

  console.log('Current database structure:', dbInfo.properties);

  // Check if 'My Notes' property exists
  const hasMyNotes = dbInfo.properties['My Notes'];
  const hasURL = dbInfo.properties.URL;

  const updates = [];

  // Add 'My Notes' property if it doesn't exist
  if (!hasMyNotes) {
    updates.push({
      property: 'My Notes',
      type: 'rich_text',
      rich_text: {},
    });
  }

  // Add 'URL' property if it doesn't exist
  if (!hasURL) {
    updates.push({
      property: 'URL',
      type: 'url',
      url: {},
    });
  }

  if (updates.length === 0) {
    return Response.json({ ok: true, message: 'Database already has required properties' }, {
      headers: corsHeaders,
    });
  }

  // Update database structure
  const updateResp = await fetch(
    `https://api.notion.com/v1/databases/${databaseId}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${notionToken}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: updates,
      }),
    }
  ).then((r) => r.json());

  console.log('Database update response:', updateResp);

  return Response.json({
    ok: true,
    message: 'Database structure updated',
    addedProperties: updates.map(u => u.property)
  }, {
    headers: corsHeaders,
  });
}
