# Triple T (TikTok Tracker) — project guide for Claude

Self-hosted, Trello-style Kanban board for tracking TikTok Shop products. Two users (owner + partner), mostly desktop and iPhone. Deployed with Docker behind Traefik at `https://ttt.jamesdkenney.com`.

- Original requirements: [docs/SPEC.md](docs/SPEC.md). Read the "Decisions that override the spec" section there first.
- Setup, deployment, and user-facing docs: [README.md](README.md).

## Stack

- **shared/**: TypeScript types plus pure logic used by both sides (no I/O).
- **server/**: Node 24, Fastify 5, Socket.IO 4, better-sqlite3 (WAL) with Drizzle ORM, argon2, zod. Bundled with tsup.
- **web/**: React 19, Vite 8, Tailwind 4, dnd-kit (mouse, touch and keyboard sensors), zustand, react-markdown, lucide-react, vite-plugin-pwa.
- **Tests**: Vitest 5 (`shared/src/*.test.ts`, `server/src/*.test.ts`).
- npm workspaces. TypeScript is pinned to ~5.9 on purpose (TS 7 is the native port; tooling compatibility is untested).

## Commands (run from the repo root)

```bash
npm install
npm run dev          # API on :3000 (tsx watch) + Vite on :5173 (proxies /api and /socket.io)
npm test             # vitest run
npm run typecheck    # shared, server, web
npm run build        # web/dist + server/dist
npm run db:generate -w server   # after editing server/src/db/schema.ts
docker build -t triple-t:test .
```

- Dev config lives in `.env.dev` at the root. It's gitignored, so on a new machine you have to create it (see README → Development). It holds `PUBLIC_URL=http://localhost:5173`, `DATA_DIR=./data-dev`, `SESSION_SECRET`, `ADMIN_USERNAME`/`ADMIN_PASSWORD`, and optional `TEST_USER2`/`TEST_USER2_PASSWORD` for a second test user.
- The dev database lives at `server/data-dev/` (gitignored). Delete it to start fresh; the admin is recreated from `.env.dev`.
- The browser preview launch config is `.claude/launch.json`: `triple-t` is dev on :5173; `triple-t-prod` runs the built app on :3400 (run `npm run build` first). Use the prod one to test the service worker and update flow, which are off in dev.

## Layout

```
shared/src/  days.ts (sort order, drop positions, Done rule, weekdayInTz)
             totals.ts, validation.ts, filter.ts, color.ts (banner contrast, themes)
             due.ts, tiktok.ts (URL allowlist), types.ts (wire types, Patch)
server/src/  app.ts (Fastify setup, CSRF origin check, static/SPA serving)
             index.ts (startup, shutdown), env.ts, auth.ts (argon2, sessions, admin bootstrap)
             realtime.ts (Socket.IO rooms + presence), serialize.ts (row → wire, loadBoardState)
             routes/{auth,admin,boards,cards}.ts, services/tiktok.ts (oEmbed + thumbnail fetch, SSRF guards)
             services/backgrounds.ts (wallpaper upload: sharp → webp max 2560px + 480x320 thumb)
             db/schema.ts + server/drizzle/ (migrations, applied automatically at startup)
web/src/     stores/board.ts (normalized board state, applyPatch, optimistic mutate with rollback)
             lib/actions.ts (every mutation), lib/api.ts, lib/socket.ts, lib/useDraft.ts
             pages/BoardPage.tsx (dnd-kit wiring), components/board/* (card front, modal, settings…)
```

## Core rules (don't break these; tests cover most of them)

- **Card order** is computed, never stored as a list: sort by `dayRank` (Sun=0 … Sat=6, then no day = 7), then `position`, then `id`. `computeDropPosition` clamps a drop into the card's own day group. **Dragging never changes a card's day.**
- **List sort options:** `columns.sort` is `day` (default: the order above), `title` (A to Z, natural and case-insensitive) or `due` (soonest first, undated last). `sortCardsBy()` in `shared/days.ts` applies it per list in `BoardPage`.
  - In `title` and `due` lists the order is automatic: reordering within the list is a no-op on drop.
  - A card dropped into one of those lists gets `appendPosition` within its day group, so the list still has a sensible manual order if it goes back to `day`.
- **The Done rule:** a card in the board's single `isDone` column always has `dayOfWeek = null`. Every path enforces it on the server via `dayForColumn()`: move, create, update, restore, column delete, and setting the done column. The client applies the same rule optimistically.
- **Required fields:** only the title. Validation lives in `shared/src/validation.ts` and runs on both sides.
- **Realtime:** every mutation returns a `Patch` and broadcasts it to room `board:<id>`, skipping the sender (identified by the `x-socket-id` header). The client applies it optimistically, rolls back on error, and then reloads the board.
  - Last write wins.
  - Text fields use `useDraft` so incoming updates don't overwrite a field the user is typing in. Every field saves without a Save button, on blur. Notes save on click or tap outside the notes section, Tab out, Escape, or when the card closes (the unmount save in `NotesEditor`); only "Discard changes" throws an edit away.
  - Reconnecting rejoins the room and reloads the full board.
- **Due dates are date-only:** `cards.due_at` stores 23:59:59.999 of the chosen day in the server `TZ` (`endOfDayInTz` in `shared/due.ts`, which handles DST). That makes a card amber on its due day and red the day after. The picker is a calendar in `DuePopover`, and clicking a day saves and closes. Show due dates with `formatDue(ms, tz)` so the day matches the board's time zone, not the viewer's.
- **Metrics are monthly:** `video_values` is keyed by (video, field, month `YYYY-MM`) and holds raw strings. On the wire it's `Video.months[month][fieldId]`, and `PATCH /api/videos/:id` requires `{ month, values }`.
  - Totals are calculated, never stored: `computeTotal(field, videos.flatMap(v => videoFieldValues(v, field.id, period)))`, where `period` is `'all'` or a month (`shared/months.ts`). Sum fields add across months; average fields average every monthly entry.
  - The board-wide period (`useBoard.period`, remembered per board in localStorage) drives the card-front badges and the card's Totals tiles.
  - Each video has its own month picker for entering numbers, plus an all-time line and a history table. "Current month" uses `monthInTz` with the server `TZ`.
- **Board backgrounds:** `boards.color` holds a preset id (`BOARD_THEMES` in `shared/color.ts`; ids are stored, so never rename or remove one), a `#rrggbb`, or `gradient:#from:#to:angle`. It's validated by `isBoardColor`; never accept arbitrary CSS. An optional `background_image` is layered over the color by `boardBackground()`. Uploads are always re-encoded with sharp (this also validates them and strips EXIF/GPS), and they're served only to signed-in users from `/api/backgrounds/:file`.
- **Comments live on videos:** `comments.video_id` points at the video, and `card_id` is still set for loading, search and cascades. Create comments with `POST /api/videos/:id/comments`; there's no card-level create route any more. Rows with `video_id` null are older card comments and render read-only in `EarlierCardComments`. Deleting a video deletes its comments explicitly in the route and lists them in `removed.comments`. Dev databases migrated before the hand-added `ON DELETE cascade` in `0003` don't have it, so keep the explicit delete.
- **Label colors:** `labels.color` is `#rrggbb` or a gradient value `gradient:#from:#to:90` (the same format as board gradients; the UI only makes left-to-right ones). It's validated by `isLabelColor`. Always render with `colorFill()` and `readableTextColor()` from `shared/color.ts`; for a gradient, the latter picks the text color that stays readable at both ends. The presets are `LABEL_COLORS` (40) and `LABEL_GRADIENTS` (15); lists use the separate `LIST_COLORS`.
- **Due date outline:** a card with a due date gets a highlighter-yellow outline (`HIGHLIGHTER` box-shadow in `CardFront`) when its list has `columns.highlight_due` on.
  - The setting defaults to on, and is off for lists whose name matches /needs recording/i, both in migration 0006 and when a list is created. It's toggled from the list menu.
  - The "today" highlight is a gold stripe down the left edge (`TODAY_STRIPE`), not a ring, so the two never look alike.
  - `CardFront` sets `boxShadow` inline, so add any new shadow to that list rather than using Tailwind `shadow-*` or `ring-*` classes.
- **Saved banners:** the `banner_presets` table holds (board, color) → text, unique per board and color. They're in `BoardState.bannerPresets` and patch kind `bannerPresets`, set with `PUT /api/boards/:id/banner-presets` (an upsert) and removed with `DELETE /api/banner-presets/:id`. In `BannerPopover`, picking a color that has a preset also sets the banner text.
- **Gantt view** (`?view=gantt`, `GanttView.tsx`): shows the same filtered cards as the board, grouped by list in board order.
  - `ganttSpan()` in `shared/gantt.ts` places each card. The day of week means "this week's plan" (Done clears it), so it goes on that weekday of the current Sunday-start week in `TZ`; the due date is absolute; with both, the bar runs between them and is flagged `late` if the plan is after the due date.
  - Cards with neither don't appear and are counted below the chart. Clicking a bar opens the card modal over the chart.
- **List colors:** `columns.color` holds `#rrggbb` or null. The list background is `color-mix(in srgb, <color> var(--list-tint), var(--list))`, which gives a pastel in light mode and a deep shade in dark mode (`--list-tint` is set per theme in `index.css`).
- **App updates (`web/src/lib/updates.ts`):**
  - The service worker uses `registerType: 'prompt'`, so a new version waits until we hand over.
  - Each build gets an id (`__BUILD_ID__` plus `dist/version.json`). The server reads it at startup, emits it as `version` on every socket connection, and includes it in `/healthz`.
  - When the id differs, or the worker finds an update (checked every 30 minutes and whenever the app comes back to the foreground), an "A new version… Reload" bar appears. If the tab is hidden and no input is focused, the update applies by itself.
  - `applyUpdate()` posts `SKIP_WAITING` to the waiting worker, waits for `controllerchange`, then reloads. A plain reload would just get the old cached app again. vite-plugin-pwa's own `updateSW(true)` doesn't reload in this case, so don't rely on it.
- **TikTok fetches:** only hosts on the allowlist; redirects are followed manually and every hop is re-checked; private IPs are refused; there's a timeout and size caps; thumbnails are saved to `/data/thumbnails`.
- **Security:** sessions use a signed httpOnly SameSite=Lax cookie (`Secure` when `PUBLIC_URL` is https). Mutations are rejected when the `Origin` header doesn't match the request host or `PUBLIC_URL`. Login is rate-limited. Keep the frontend free of inline scripts (the CSP from Traefik's `security-headers@file` middleware is unknown).

## Gotchas already learned

- Fastify rejects a POST that has `content-type: application/json` and an empty body. `lib/api.ts` always sends `{}`.
- Node's `net.BlockList`: adding `::ffff:0:0/96` matches **every** IPv4 address. IPv4 rules already cover IPv4-mapped IPv6.
- Shutdown has to close Socket.IO first (`preClose` hook in `realtime.ts`), otherwise `app.close()` hangs on open websockets. `index.ts` also force-exits after 5 seconds.
- The browser-preview tool sets `PORT`, so the server's dev script pins `PORT=3000` and Vite uses `--strictPort`.
- The Vite proxy rewrites the Host header, which is why the CSRF check also accepts the `PUBLIC_URL` host.
- The Docker entrypoint chowns `/data` and then drops to the `node` user with `setpriv`. Bind mounts are often owned by root.
- `.pt-safe`, `.pb-safe` and `.px-safe` in `index.css` are unlayered, so they **override** Tailwind padding on the same element (this once zeroed the board's left padding). To combine padding with a safe area, use `pl-[max(0.75rem,env(safe-area-inset-left))]`.
- The board canvas is an outer horizontal scroller with an inner `mx-auto w-max` row. This centers the lists when they fit, without clipping when they overflow (`justify-center` would clip the left side).
- Never focus or move the cursor from an inline callback ref (`ref={(el) => …}`). React calls it again on every render, so the cursor jumps while you type; this was the notes "jumps to the bottom" bug. Use a `useLayoutEffect` keyed to the moment you mean, such as `[editing, tab]` in `NotesEditor`.
- iOS: inputs use `text-base` on phones to stop the zoom-on-focus. Cards set `-webkit-touch-callout:none` so long-press starts a drag (TouchSensor, 250ms delay).

## Status

- **Done:** everything in the spec except the items under "Decisions" in docs/SPEC.md.
- **Not yet verified:** long-press drag on a real iPhone; Traefik's actual CSP header against the app.
- **Possible next work** (ask first): nightly SQLite backups to `/data/backups` keeping 14 (deferred by the owner); code-splitting the ~630 KB JS bundle.

## Working conventions

- Match the existing style: shared logic in `shared/`, mutations through `lib/actions.ts`, server responses as `Patch` objects.
- Add or extend Vitest tests for any change to sorting, the Done rule, totals, validation, or the TikTok guards.
- Commit with clear messages. The branch is `main` on `github.com/Jkenney85/triple-t`.
