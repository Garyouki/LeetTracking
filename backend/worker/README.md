# LeetTracking Sync Worker Setup

## Prerequisites

1. Install Wrangler
```bash
npm install -g wrangler
```

2. Log in to Cloudflare
```bash
wrangler login
```

3. Create a D1 database
```bash
wrangler d1 create leettracking
```

4. Configure `wrangler.toml`
```bash
cp wrangler.toml.example wrangler.toml
```

Edit `wrangler.toml` and set the `database_id` returned by the create command.

```toml
[[d1_databases]]
binding = "DB"
database_name = "leettracking"
database_id = "YOUR_DATABASE_ID"
```

5. Initialize schema
```bash
wrangler d1 execute leettracking --file=schema.sql
```

6. Set worker secret
```bash
wrangler secret put API_KEY
```
Use your own unique key. Do not reuse or share it publicly.

## Deploy

```bash
wrangler deploy
```

## Local Development

```bash
wrangler dev
```

## Notes

- Each user should deploy and configure their own worker.
- `API_KEY` is required for request authentication and should be unique per user.
- Do not hardcode tokens, keys, or service URLs in source code.
