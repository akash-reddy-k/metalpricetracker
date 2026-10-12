# MetalPrices.Online

Real-time precious metals spot prices (Gold, Silver, Platinum, Palladium) with live duty-inclusive cost calculations for 13 countries, plus an automated weekly market-news article.

**Live site**: [metalprices.online](https://metalprices.online)

---

## Project Structure

```
metalpricetracker/
  backend/          Node.js/Hono API server
  frontend/         React/Vite SPA + static SEO pages
  deployment/       Deployment docs
  .github/          CI/CD workflows
```

---

## Local Development

The backend and frontend are independent packages. Run them in two separate terminals.

### Terminal 1 — Backend (port 3000)

```bash
cd backend
npm install
npm run dev      # hot reload on file changes
# or: npm start  # no hot reload (same as production)
```

The API is now available at `http://localhost:3000`. Test it:

```bash
curl http://localhost:3000/health
curl http://localhost:3000/snapshot
```

### Terminal 2 — Frontend (port 5173)

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` in your browser. The frontend defaults to `http://localhost:3000` for the backend when `VITE_HONO_SERVER_URL` is not set, so no extra config is needed locally.

### Optional — set a custom backend URL

Create `frontend/.env.local`:

```env
VITE_HONO_SERVER_URL=http://localhost:3000
```

---

## Available Scripts

### Backend (`cd backend`)

| Command | Description |
|---|---|
| `npm run dev` | Start with hot reload (development) |
| `npm start` | Start without hot reload (production-like) |
| `npx tsc -p tsconfig.json --noEmit` | Typecheck |

### Frontend (`cd frontend`)

| Command | Description |
|---|---|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Production build + generate SEO pages |
| `npm run lint` | ESLint |
| `npm run format` | Prettier (write) |
| `npm run format:check` | Prettier (check only) |
| `npm run preview` | Preview production build locally |
| `npm run generate-news` | Generate the weekly news article (see [Weekly News Generator](#weekly-news-generator)) |

---

## Production Deployment

| | Platform | Deploys when |
|---|---|---|
| **Frontend** | Cloudflare Pages | GitHub release published |
| **Backend** | Render | GitHub release published |

Both deploy from the same release tag via a single workflow (`.github/workflows/deploy.yml`).
Render auto-deploy must be **disabled** — deploys only via the release workflow.

**Backend** (Render settings):
- Root directory: `backend`
- Build command: `npm ci`
- Start command: `npm start`

**Frontend** (Cloudflare Pages settings):
- Root directory: `frontend`
- Build command: `npm ci && npm run build`
- Build output: `dist`

### Required GitHub secrets (repo → Settings → Secrets → Actions)

| Secret | Description |
|---|---|
| `CLOUDFLARE_API_TOKEN` | CF API token with Pages:Edit permission |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID |
| `VITE_HONO_SERVER_URL` | Backend URL e.g. `https://api.metalprices.online` |
| `RENDER_DEPLOY_HOOK` | Render deploy hook URL (Settings → Deploy Hook) |
| `GEMINI_API_KEY` | _(Optional)_ Google AI Studio key for the [weekly news generator](#weekly-news-generator); falls back to a template if unset |

### Required environment variables

**Render** (backend):
- None required — CORS is open to all origins

**Cloudflare Pages** (frontend):
- `VITE_HONO_SERVER_URL` — e.g. `https://api.metalprices.online`
- `VITE_GOOGLE_TAG_ID` — Google Analytics tag (optional)

---

## Weekly News Generator

A GitHub Actions workflow (`.github/workflows/weekly-news.yml`) publishes a
plain-English precious-metals market recap once a week, hands-free. Articles are
served at `/news` and `/news/:date/:slug` on the live site.

**How it works**

1. Runs every Sunday at 00:30 UTC, or on demand via *Actions → Weekly News Generator → Run workflow*.
2. `npm run generate-news` pulls live metal prices plus the macro drivers that move them — US Dollar Index (DXY), US 10-year Treasury yield, WTI crude — from TradingView, computes week-over-week moves, and asks Google Gemini to write the article. If Gemini is unavailable it falls back to a deterministic template, so the job always produces an article.
3. The result is written to `frontend/src/data/news.json` (newest first, capped at the latest 52 entries so the list self-trims to ~1 year). Each entry is tagged `generator: "gemini" | "template"`.
4. Because `main` is protected ("Changes must be made through a pull request"), the workflow pushes to a dated branch `news/weekly-YYYY-MM-DD`, opens a PR, polls until the required checks (the Cloudflare Pages deploy) pass, then squash-merges the PR and deletes the branch — all via the GitHub REST API using the built-in `GITHUB_TOKEN`. If it can't merge within ~15 minutes it leaves the PR open for a manual merge.

**One article per date.** Re-running for a date that already has an article is a no-op — except that a successful Gemini run will _upgrade_ an article that previously fell back to the template.

**Configuration**

| Name | Kind | Description |
|---|---|---|
| `GEMINI_API_KEY` | Secret | Google AI Studio key (free tier). If unset, the template fallback is used. |
| `GEMINI_MODEL` | Variable _(optional)_ | Override the Gemini model. Defaults to `gemini-3.8-flash`. |

Run it locally (writes `frontend/src/data/news.json`):

```bash
cd frontend
GEMINI_API_KEY=... npm run generate-news   # omit the key to use the template fallback
```

---

## API Endpoints

Base URL: `https://api.metalprices.online`

| Endpoint | Description |
|---|---|
| `GET /health` | Server health + uptime info |
| `GET /snapshot` | Latest quotes snapshot |
| `GET /live-quotes` | SSE stream — push updates every 30s |
| `GET /history?symbol=TVC:GOLD&range=30d` | OHLC bar history |
| `GET /india-rates` | India-specific purity/duty breakdown |
| `GET /tickers` | Allowlisted ticker list |
