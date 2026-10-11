# Triple T — original specification

This is the build spec the project was created from (2026-10-04), kept for reference.

## Decisions that override the spec

The owner made these decisions after the spec was written. They take precedence over the text below.

1. **Vikunja import: dropped.** The data couldn't be exported, so cards are entered by hand. Nothing implements the import, the "Needs info" badge, the import report page, or the mapper tests. The `./import` volume stays in `docker-compose.yml` only because it's the owner's existing file.
2. **Required fields: title only.** Notes and labels are optional (UI and API).
3. **Labels:** per board, with no seeded defaults. A label can be created from inside a card.
4. **Currency:** USD.
5. **Nightly backups: deferred** ("we'll add that later"). The admin JSON export is implemented; the README documents manual backup and restore.
6. **Comments are per video (2026-10-11):** the card-level Comments section was removed as redundant with Notes. Each video in a card has its own comment thread. Card comments from before the change still show read-only as "Earlier comments" (authors can edit or delete them). The comment badge on the card front counts all of them.
7. **docker-compose.yml:** exactly the owner's Traefik setup, as shown below.

Implementation choices made where the spec was silent:

- **"Today"** is decided by `TZ`. Cards in Done never get the today highlight.
- **Done list changes:** making a list the Done list clears the day on cards already in it. The Done list can't be deleted until another list is made Done.
- **Archived cards in a deleted list** move with the active ones, so they can still be restored.
- **Comments** are a flat list under each card, newest first (no nested replies).
- **Moving cards on a phone:** the card modal has an "in list" picker.
- **Session cookies** last 30 days and slide forward. Login is limited to 10 attempts per IP per 15 minutes and 10 failures per username per 15 minutes.

---

## Original spec

### Context
My partner and I track TikTok Shop products on a Kanban board. We like Trello's look and feel but don't want to pay for it. We tried Vikunja and didn't like how it handles things. Build a self-hosted web app called **Triple T (TikTok Tracker)** that looks and feels like Trello, with the specific features below. It runs in Docker on my homelab behind Traefik, and we mostly use it on desktop and iPhone.

### Tech stack
- **Frontend:** React + TypeScript + Vite, Tailwind CSS, dnd-kit for drag and drop (with mouse and touch sensors)
- **Backend:** Node.js (LTS) + TypeScript, Fastify, Socket.IO for real-time updates
- **Database:** SQLite (better-sqlite3, WAL mode) with Drizzle ORM and migrations
- **Packaging:** one multi-stage Dockerfile; the backend serves the built frontend on port 3000
- **Tests:** Vitest for the core logic listed under "Tests"

### Users and auth
- Username and password login. Hash passwords with argon2. Sessions use a secure, httpOnly, SameSite=Lax cookie.
- No public registration. On first startup, create an admin from the `ADMIN_USERNAME` and `ADMIN_PASSWORD` env vars.
- An admin-only users page to create users, reset passwords, and deactivate users. Every user can change their own password and display name.
- Each user gets an initials avatar with a color.
- Rate-limit login attempts. The app is publicly reachable.
- Every card records created by, last edited by, and timestamps. Show these in the card detail view.

### Boards, columns, labels
- Multiple boards. All users can see and edit all boards. Boards can be created, renamed, color-themed, archived, and restored.
- Columns: add, rename, drag to reorder, and delete. Deleting a column that has cards asks where to move them first.
- Each board has exactly one column marked as the Done column, set in board settings. New boards are seeded with To Do / In Progress / Done.
- Labels are per board. Each has a custom name and color, managed in board settings, and they display as Trello-style colored pills.

### Cards
**Required fields.** ~~Title, notes, and at least one label are required.~~ *(Changed: title only.)* Notes are Markdown with a simple editor and rendered preview.

**Colored banner**
- The banner is optional. It's a colored strip across the top of the card, like Trello's color cover, not a full-card background.
- It's free-form: pick any color (preset swatches plus a custom color picker) and type any text, which shows on the banner.
- Banner text automatically switches between black and white for readable contrast.

**Day of the week and sorting**
- Optional field: Sunday–Saturday.
- Within a column, cards sort by day, with the week starting Sunday (Sun → Sat). Cards with no day go at the bottom.
- Cards can be dragged to reorder within the same day group. Dragging never changes a card's day; a dropped card snaps into its own day group.
- Moving a card into the Done column clears its day of the week. Enforce this on the server, not just the UI.
- Cards whose day is today get a subtle highlight, using the `TZ` env var (default `America/Chicago`).

**Other card fields**
- Due date: shows a chip on the card front. Red when overdue, amber when due within 24 hours.
- Product link: a URL field, clickable.
- Comments: threaded under the card, with author and timestamp. Users can edit or delete their own comments.
- Archive: archive instead of delete. Each board has an "Archived items" view with restore and permanent delete.

**Videos.** A card represents one product and can have multiple TikTok videos. Each video has:
- A TikTok URL, shown as a clickable link that opens the video in a new tab.
- A thumbnail, title, and author, fetched automatically:
  - fetched server-side through TikTok's oEmbed endpoint (`https://www.tiktok.com/oembed?url=...`);
  - the thumbnail is downloaded and stored locally, because TikTok's CDN image URLs expire;
  - short links like `vm.tiktok.com` are resolved by following redirects server-side;
  - only URLs on TikTok domains are fetched, to prevent server-side request forgery;
  - a "refresh thumbnail" button; if fetching fails, show a placeholder and the link still works.
- Its own values for the board's custom metric fields.
- Thumbnails appear only in the opened card, not on the board.

### Custom metric fields
- Defined per board in board settings. Each field has a name, a type (number, percent, currency, text, URL, or date), a "show on card front" toggle, and a total mode (sum, average, or none; default sum for number and currency, average for percent).
- Values are entered per video. The card shows totals across all its videos for each field.
- Seed new boards with Views (number), CTR (percent), Sales (number), GMV (currency).
- Fields with "show on card front" display their total as small badges on the card front.

### Card front (board view)
From top to bottom:
1. Banner with its text
2. Label pills
3. Title
4. Badges row: day of week, due date, comment count, video count, and metric totals set to show on the front

Keep it compact like Trello.

### Real-time collaboration
- Socket.IO rooms per board. Every change appears live for other viewers without a refresh.
- Apply changes optimistically and roll back on server error. Last write wins.
- If a card is open while someone else edits it, update it live without clobbering a field the current user is typing in.
- Show avatars of who else is viewing the board.
- On reconnect, resync the board state.

### Search and filter
- A filter bar on each board: text search across title, notes, banner text, and comments. Filter by label, day of week, banner color, due status (overdue, due soon, none), and has videos / no videos.
- A global search across all boards that jumps to the card.

### Look and feel
- Closely match Trello's style:
  - horizontally scrolling columns;
  - light gray rounded lists;
  - white cards with a subtle shadow;
  - a colored board background;
  - "Add a card" at the bottom of each list;
  - card details in a centered modal.
- Don't copy Trello's logo or branding. Use an original "Triple T" wordmark and icon.
- Light and dark mode.

### Mobile and iPhone
- Fully responsive. On phones, columns swipe horizontally with snap scrolling, drag starts with a long-press, and touch targets are large.
- Installable PWA for iPhone:
  - web manifest;
  - `apple-touch-icon` and the iOS standalone meta tags;
  - safe-area insets;
  - a service worker that caches the app shell.
- Offline editing isn't needed. Show a clear "reconnecting…" state when offline.

### ~~Vikunja import~~ *(dropped; see Decisions)*

### Data and backups
- SQLite database, thumbnails, and backups all live under `/data`, mounted to `./data`.
- ~~Nightly SQLite backup into `/data/backups`, keeping the last 14.~~ *(Deferred.)*
- An admin button to download a full JSON export.

### Deployment
Env vars: `PUBLIC_URL`, `SESSION_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `TZ`. Provide `.env.example`; never hardcode secrets. Include a healthcheck endpoint. The `docker-compose.yml` uses the owner's Traefik setup:
- router `triple-t`, host `ttt.jamesdkenney.com`;
- `websecure` entrypoint and `letsencrypt` cert resolver;
- `security-headers@file` middleware;
- external `proxy` network.

Socket.IO websockets must work through Traefik, and the security-headers middleware must not block the PWA or websockets.

### Tests
Vitest tests for:
- the day-of-week sort order;
- clearing the day on moving into the Done column;
- totals math (sum and average);
- required-field validation;
- ~~the Vikunja mapper~~ *(dropped)*.

### Deliverables
- The working app.
- A README covering setup, env vars, first login, backups and restore, adding the app to the iPhone home screen, and updating.
- A short summary of what was built and anything left out or changed.
