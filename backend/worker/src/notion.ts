export interface NotionPagePayload {
  parent: { database_id: string };
  properties: Record<string, any>;
}

export async function createNotionPage(
  token: string,
  databaseId: string,
  payload: NotionPagePayload,
) {
  const r = await fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!r.ok) {
    const err = await r.text();
    throw new Error(`Notion API error: ${err}`);
  }
  return r.json();
}
