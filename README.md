# SOB Bot

A Discord bot that tracks emoji reactions and builds reaction leaderboards per guild.

## What it does

- Tracks emoji add/remove reaction events in guild messages.
- Provides leaderboards:
  - `/emojileaderboard <emoji> [period]`
  - `/emojimosreacted <emoji> [period]`
- Supports dynamic, custom leaderboards per server:
  - Create custom leaderboard words/aliases with `/define-leaderboard`.
  - Remove and list them with `/remove-leaderboard` and `/list-leaderboards`.
- Supports both:
  - Slash commands
  - Prefix commands (customizable per guild, default `!`)
- Paginated embed responses for long results.
- Optional settings:
  - Prefix, self-react penalty, fmbot mapping info.
- Optional periodic SQLite DB backup to S3.

## Tech stack

- TypeScript + Bun runtime
- [discord.js](https://discord.js.org/)
- SQLite (via `bun:sqlite`)

## Quick start

### 1) Install dependencies

```bash
bun install
```

### 2) Configure environment

Copy `.env.example` to `.env` and fill required values:

```bash
cp .env.example .env
```

Required:

- `DISCORD_TOKEN`
- `DISCORD_CLIENT_ID`

Optional:

- `GLOBAL_ADMINS` (comma-separated user IDs)
- S3 backup vars (`S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_ENDPOINT`, `BACKUP_INTERVAL_HOURS`)

### 3) Run

```bash
bun run dev      # hot reload during development
bun run start    # run once
bun run deploy-commands  # register global slash commands
```

## Main scripts

- `bun run dev` — run with watch
- `bun run start` — run bot
- `bun run deploy-commands` — deploy global slash commands
- `bun run check` — format check + lint + typecheck
- `bun run fmt` / `bun run lint` / `bun run typecheck`

## Permissions/Intents

Bot enables:

- Guilds
- Guild messages
- Message content
- Guild message reactions

Intents are needed for reaction and message tracking functionality.

## Data and persistence

Data is stored in `data/bot.db` (SQLite) with these main tables:

- `reaction_events`
- `guild_leaderboards`
- `guild_settings`

On startup, tables/indexes are auto-created/migrated in-place.

## Files of interest

- `src/index.ts` — bot bootstrap, handlers
- `src/client.ts` — extended Discord client + SQLite init
- `src/core/router.ts` — prefix command routing + dynamic aliases
- `src/core/database.ts` — DB schema/init
- `src/modules/*` — feature modules (leaderboard, custom leaderboard, admin, emoji tracking, help)
- `src/utils/*` — shared utilities

## License

MIT (or update as needed).