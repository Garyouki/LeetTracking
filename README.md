# LeetTracking

LeetTracking is a Chrome extension that adds spaced repetition to LeetCode problem practice.

## Fork notice

This project is a fork of **LeetSRS** by Matt Drake:

- https://github.com/mattcdrake/LeetSRS

Major changes in this fork:

- Renamed branding to **LeetTracking**
- Updated extension icons
- Migrated storage key prefix from `leetsrs` to `leettracking` (existing user data is copied to new keys on first run)
- GitHub Gist backup filename changed to `leettracking-backup.json` (with fallback support for the legacy filename)

## Features

- Uses **[TS-FSRS](https://github.com/open-spaced-repetition/ts-fsrs)** for the spaced repetition algorithm
- Daily review queue with optimized problem ordering
- Works directly on leetcode.com
- Rate after solving, or add to review later
- Configurable daily new card limits
- Day start offset (0-23 hours past midnight)
- Optional sync via GitHub Gists
- Dark/light theme support

## Development

Prerequisites:

- Node.js + npm

Install dependencies:

```bash
npm install
```

Run dev build:

```bash
npm run dev
```

Load the unpacked extension in Chrome:

- Open `chrome://extensions`
- Enable **Developer mode**
- Click **Load unpacked**
- Select this folder:
  - `.output/chrome-mv3-dev`

## Build

```bash
npm run build
```

Then load the unpacked extension from:

- `.output/chrome-mv3`

## GitHub Gist Sync (Optional)

- Create a GitHub Personal Access Token with `gist` scope
- Configure token + Gist ID in the extension settings

## Notion Sync Setup (Optional)

Do not commit real credentials. Each user must configure their own worker and credentials in extension settings:

- `Notion Token`
- `API Key` (your own worker secret, never shared)
- `Sync Service URL` (your own worker URL, for example `https://your-worker.workers.dev`)
- `Notion Database ID` (or auto-create from the settings page)

Worker deployment instructions:

- See `backend/worker/README.md`

## Google OAuth Setup

`wxt.config.ts` uses a placeholder OAuth client ID. Replace it with your own Google OAuth client ID before building:

- `YOUR_GOOGLE_OAUTH_CLIENT_ID.apps.googleusercontent.com`

## License

MIT
