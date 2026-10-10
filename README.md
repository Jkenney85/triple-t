# Triple T — TikTok Tracker

A self-hosted, Trello-style Kanban board for tracking TikTok Shop products. Each card is a product; each product can have several TikTok videos, each with its own metrics (views, CTR, sales, GMV, or whatever fields you define), and the card totals them up.

- Boards, lists and cards that look and feel like Trello, in light and dark mode
- Cards sort by **day of week** (Sun → Sat, then cards with no day). Dragging reorders within a day group and never changes the day.
- Moving a card into the board's **Done** list clears its day (enforced by the server)
- Colored banners with free text, per-board labels, due dates, product links, Markdown notes, comments
- TikTok videos with thumbnails fetched and stored locally, plus per-video custom metric fields with sum/average totals
- Live updates between everyone viewing a board, with presence avatars
- Search and filters per board, plus a search across all boards
- Installable on iPhone as a home-screen app (PWA)

## Quick start (Docker + Traefik)

1. Copy the project to your server and create the env file:

   ```bash
   cp .env.example .env
   ```

2. Edit `.env`:

   | Variable | Required | What it does |
   | --- | --- | --- |
   | `PUBLIC_URL` | yes | The URL you open the app at, e.g. `https://ttt.jamesdkenney.com`. An `https://` URL turns on Secure cookies. |
   | `SESSION_SECRET` | yes | At least 32 random characters, used to sign session cookies. Generate one with `openssl rand -hex 32`. |
   | `ADMIN_USERNAME` | first run | Username for the first admin account. |
   | `ADMIN_PASSWORD` | first run | Password for the first admin account (8+ characters). |
   | `TZ` | no | IANA time zone used to decide what "today" is for the day highlight. Defaults to `America/Chicago`. |

   The admin account is created **only when the database has no users**. Changing these values later does not change the existing admin. Use the app's profile page to change your password.

3. Build and start:

   ```bash
   docker compose up -d --build
   ```

4. Open `PUBLIC_URL` and sign in with the admin credentials.

The included `docker-compose.yml` matches your Traefik setup: router `triple-t`, the `websecure` entrypoint, the `letsencrypt` resolver, and the `security-headers@file` middleware, on the external `proxy` network. The container listens on port 3000 and has a built-in healthcheck at `/healthz`.

### First login and users

- There's no public sign-up. As admin, open the avatar menu, then **Manage users** to add your partner. You can also reset passwords, grant admin, and deactivate accounts there. Deactivating someone signs them out immediately.
- Everyone can change their own display name, avatar color, and password from **Profile & password**.
- Each IP address is limited to 10 login attempts per 15 minutes, and each username to 10 failed attempts per 15 minutes.

### Traefik notes

**Websockets** work through Traefik with no extra configuration. Traefik passes the `Upgrade` header through by default, and Socket.IO falls back to long-polling if a websocket ever can't be opened.

**The `security-headers` middleware.** The app works under a strict policy: it has no inline scripts, no third-party scripts or fonts, and thumbnails are served from the app itself. If your middleware sets a `Content-Security-Policy`, make sure it allows at least:

```
default-src 'self';
script-src 'self';
style-src 'self';
img-src 'self' data: blob:;
connect-src 'self' wss://ttt.jamesdkenney.com;
worker-src 'self';
manifest-src 'self';
frame-ancestors 'none';
```

- `connect-src` must allow the `wss://` URL for live updates. Some browsers don't treat `'self'` as covering websockets.
- `worker-src` and `manifest-src` (or a `default-src 'self'` fallback) are needed for the installable app and its service worker.
- `X-Frame-Options`, HSTS, `Referrer-Policy`, `X-Content-Type-Options`, and `Permissions-Policy` are all fine.
- Avoid `Cross-Origin-Embedder-Policy: require-corp` unless you also set `Cross-Origin-Resource-Policy`. The app doesn't need it.

**Quick check after deploying:** open the board in two browsers and edit a card in one. If the other updates without a refresh, websockets are getting through. If you see "Reconnecting…" stuck at the top, check the browser console for CSP errors.

## Add it to your iPhone home screen

1. Open `PUBLIC_URL` in **Safari**.
2. Tap the **Share** button, then **Add to Home Screen**, then **Add**.
3. Open Triple T from the home screen and sign in. The home-screen app keeps its own cookies separate from Safari, so you sign in once more there.

It opens full screen with no browser bars. On a phone, swipe sideways between lists, **long-press a card to drag it**, and tap a card to open it. The card's "in list" picker is the quickest way to move a card on a phone. The app needs a connection; if you lose it, a **Reconnecting…** banner shows and the board resyncs automatically when you're back.

## Using it

- **Done list.** Each board has exactly one Done list. The seeded **Done** list starts as it. Change it in **Settings → Lists** or from a list's **⋯** menu. Moving a card into Done clears its day. A list can't be deleted while it's the Done list.
- **Deleting a list** that still has cards asks which list to move them to.
- **Labels** belong to each board. Create them in **Settings → Labels** or right from a card's **Labels** popover.
- **Metric fields** are per board: **Settings → Fields**. New boards start with Views (number), CTR (percent), Sales (number), and GMV (currency, USD).
  - Values are entered on each video in the card.
  - The card shows a total for each field. Number and currency default to *sum*, percent to *average*.
  - Turn on **On card** to show that total as a badge on the board.
- **Videos.** Paste a `tiktok.com` or `vm.tiktok.com` link.
  - The server resolves short links, fetches the title, author, and thumbnail through TikTok's oEmbed, and saves the thumbnail under `/data/thumbnails`. TikTok's own image links expire.
  - If the fetch fails, you get a placeholder and the link still works. Use the refresh button to try again.
  - Only TikTok domains are ever fetched.
- **Board backgrounds.** Go to **Settings → Background**:
  - pick one of 24 gradients or 10 solid colors;
  - build your own two-color gradient (with a direction) or solid color;
  - or upload a photo as wallpaper (JPEG, PNG, or WebP, up to 25 MB).

  Photos are resized to at most 2560px and re-saved as WebP, which also strips location data from phone photos. They're stored under `/data/backgrounds`. The color you pick still shows while a photo loads.
- **Archive** a card from its detail view. **Archived** (in the board bar) lists archived cards, where you can restore them or delete them permanently.
- **Search.** **Filter** in the board bar searches titles, notes, banner text, and comments, and filters by label, day, banner color, due status, and whether a card has videos. The search box in the top bar searches every board and jumps to the card.
- **Admin export.** Avatar menu, then **Download JSON export**, gives a full dump of everything except passwords.

## Data, backups, and restore

Everything lives in `./data` on the host (`/data` in the container):

```
data/
  triple-t.db          SQLite database (WAL mode; -wal and -shm files sit beside it)
  thumbnails/          locally stored TikTok thumbnails
  backgrounds/         board wallpaper photos (+ small -thumb previews)
```

There's no automatic backup yet. To take one while the app is running, use SQLite's online backup, which is safe with WAL:

```bash
sqlite3 data/triple-t.db ".backup 'triple-t-$(date +%F).db'"
```

If you don't have `sqlite3` on the host, stop the container, copy the whole `data/` folder, and start it again:

```bash
docker compose stop
```

```bash
cp -a data "data-backup-$(date +%F)"
```

```bash
docker compose start
```

**To restore:** stop the container and replace `data/triple-t.db` with your backup. Delete any `triple-t.db-wal` and `triple-t.db-shm` files beside it, copy `thumbnails/` and `backgrounds/` back if you have them, then start the container.

The `./import` mount in the compose file is unused. It's left in so the file stays exactly as you have it.

## Updating

```bash
git pull
```

```bash
docker compose up -d --build
```

Database migrations run automatically on startup. Shutdown is graceful, so restarts take about a second.

## Development

You need Node 22 or newer.

```bash
npm install
```

Create `.env.dev` in the project root. It's gitignored; use `.env.example` as a guide and set `PUBLIC_URL=http://localhost:5173`, `DATA_DIR=./data-dev` and an admin username and password. Then:

```bash
npm run dev
```

The API runs on :3000 and Vite on :5173; open http://localhost:5173.

Other scripts: `npm test` (Vitest), `npm run typecheck`, `npm run build`. After changing `server/src/db/schema.ts`, generate a migration with `npm run db:generate -w server`.

### Layout

```
shared/   Types and pure logic used by both sides: day sorting, the Done rule,
          totals, validation, filters, banner contrast, the TikTok URL allowlist
server/   Fastify API, Socket.IO, Drizzle schema and migrations, TikTok fetcher
web/      React + Vite + Tailwind frontend, dnd-kit drag and drop, PWA
```
