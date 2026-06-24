# Tsundoku — Project Context

> **To continue in a new conversation**: hand Claude this file at the start. Say "Read `/Users/utkarshgupta/Documents/tsundoku/CONTEXT.md` and we'll continue from there." Last updated: 2026-06-24.

---

## TL;DR

Personal AI-builder portfolio project for **Utkarsh Gupta**. A mobile-first webapp where you photograph a bookshelf and get two flavors of reading recommendations:

1. **Next reads** — safe adjacent picks given the shelf
2. **Shadow library** *(the differentiator)* — books your collection IMPLIES you'd love but you'd never find on your own; the prompt explicitly tells Gemini to find the *gap*

Built outside work to improve AI-builder profile. Goal: shareable demo + a "what I learned about vision-LLM OCR" blog post once there's enough usage.

**Current state**: Phases 0 → 3 + UI revamp shipped. Live, no auth, recommendations validated against Open Library so hallucinated titles get dropped. Visual identity: warm cream / terracotta accent, Crimson Pro serif for book titles, Geist Sans for UI.

---

## Live URLs

| URL | What |
|---|---|
| `https://tsundoku-one.vercel.app/` | Production app |
| `https://github.com/ug4672/tsundoku` | Public repo |
| `https://vercel.com/ug4672s-projects/tsundoku` | Vercel dashboard |

Vercel project: `ug4672s-projects/tsundoku`. Scope: `ug4672s-projects` (team ID `team_hxbJjxTzOdRZQ9QJA2Zbrt0f`). Personal auto-deploy on `main` not yet wired via Vercel Git integration — deploys go through `vercel --prod` from CLI for now.

---

## File map (all in `/Users/utkarshgupta/Documents/tsundoku/`)

| File | Purpose |
|---|---|
| `app/page.tsx` | The whole app. Single client component: upload → extract → favorites → mode toggle → recommend → render. |
| `app/layout.tsx` | Root layout. Loads Geist Sans + Geist Mono + Crimson Pro fonts. Metadata, PWA capable flags, viewport theme color. |
| `app/globals.css` | Tailwind v4 entry. Defines warm cream/sepia palette + dark variant as CSS custom props + `@theme inline` so `bg-surface`, `text-foreground`, `border-border`, `bg-accent-soft` etc. work. Has `.shimmer` keyframe for loading states. |
| `app/manifest.ts` | PWA manifest (file convention). Cream bg + terracotta theme. |
| `app/icon.tsx` | 192px home-screen icon. `ImageResponse` with 📚 on terracotta bg. |
| `app/apple-icon.tsx` | 180px iOS home-screen icon. Same. |
| `app/api/scan/route.ts` | `POST /api/scan` — accepts FormData with `image`, calls `gemini-2.5-flash` with `responseMimeType: "application/json"` + schema, returns `{ books: [{title, author?, confidence}] }`. |
| `app/api/recommend/route.ts` | `POST /api/recommend` — accepts `{ books, favorites?, mode }`, calls Gemini with NEXT_READS_PROMPT or SHADOW_LIBRARY_PROMPT, validates every rec against Open Library `/search.json` (drops unresolvable), enriches survivors with cover URL + canonical title + first publish year. |
| `package.json` | Next 16.2.9, React 19.2.4, Tailwind v4, TypeScript, `@google/genai@2.9.0`. |
| `.env.local` | `GEMINI_API_KEY=…` — gitignored. |
| `AGENTS.md` / `CLAUDE.md` | Auto-added by `create-next-app@latest` — warns that Next 16 has breaking changes from training data; points at `node_modules/next/dist/docs/`. |
| `CONTEXT.md` | This file. |

**Git repo**: https://github.com/ug4672/tsundoku (public, `main` branch)

---

## Architecture

```
┌──────────────────────────────────┐
│  Browser (mobile-first)              │
│  - Camera capture via <input>        │
│  - All UI is a single client comp    │
└──────────────┬───────────────────────┘
               │
               ▼
┌────────────────────────────────────────────────────┐
│  Vercel: tsundoku (Next.js 16, App Router)         │
│  Region: auto (Vercel global)                      │
│  Runtime: Node.js 20                               │
│                                                    │
│  /api/scan          (POST, multipart image)        │
│  /api/recommend     (POST, JSON)                   │
└────┬────────────────────────────────────────────────┘
     │
     ├──► Google Gemini API   (gemini-2.5-flash, vision + JSON output)
     │       - Vision extraction of book spines
     │       - Recommendation generation (two prompts)
     │
     └──► Open Library         (openlibrary.org/search.json, free, no auth)
             - Validate every recommendation exists
             - Pull cover_i → covers.openlibrary.org/b/id/{cover_i}-M.jpg
             - Canonical title + author + first publish year
```

No database yet (Phase 4 will add persistence — Firestore likely; Supabase was ruled out for stack-consolidation reasons; see Decisions).

---

## Stack

- **Framework:** Next.js 16 (App Router, Turbopack build), TypeScript, React 19
- **Styling:** Tailwind CSS v4 (CSS-first config in `globals.css`)
- **Fonts:** Geist Sans (UI), Geist Mono (code), Crimson Pro (book titles + section headlines)
- **Vision + reasoning:** Google Gemini 2.5 Flash via `@google/genai` SDK
- **Book metadata:** Open Library API (free, no auth)
- **Hosting:** Vercel (free tier, production)
- **Deploy:** `vercel --prod --scope ug4672s-projects` from CLI

Free monthly cost: $0 at hobby scale.

---

## API endpoints

### `POST /api/scan`

Receives an image, returns extracted book list.

**Request:** `multipart/form-data` with field `image` (any browser-supported image MIME).

**Response:**
```json
{
  "books": [
    { "title": "Norwegian Wood", "author": "Haruki Murakami", "confidence": "high" },
    { "title": "Beloved", "author": null, "confidence": "medium" }
  ]
}
```

Confidence is `"high" | "medium" | "low"`. Gemini is prompted to skip rather than guess on unreadable spines.

### `POST /api/recommend`

Takes the extracted books + optional favorites + mode, returns enriched recommendations.

**Request:**
```json
{
  "books": [{ "title": "...", "author": "..." }, ...],
  "favorites": ["The Brothers Karamazov", "Beloved"],
  "mode": "next" | "shadow"
}
```

`favorites` are optional (defaults to empty) and capped at 5 server-side. `mode` defaults to `"next"`.

**Response:**
```json
{
  "mode": "shadow",
  "recommendations": [
    {
      "title": "The Periodic Table",
      "author": "Primo Levi",
      "first_publish_year": 1975,
      "cover_url": "https://covers.openlibrary.org/b/id/12345-M.jpg",
      "open_library_key": "/works/OL1234W",
      "why": "...",
      "bridge_title": "Beloved"
    }
  ]
}
```

Open Library validation drops hallucinated titles before they reach the client.

---

## Two prompts (the differentiator)

Both prompts are in `app/api/recommend/route.ts`. The full system prompts:

**NEXT_READS_PROMPT** — *"Recommend 5 books they will safely love — natural next picks given the themes, genres, and sensibilities of their collection. Stay close to what they already enjoy."*

**SHADOW_LIBRARY_PROMPT** — *"Your job is to find the GAP. Look for the implied taste behind the explicit choices. Reach across genres and disciplines the reader only flirts with on this shelf. Avoid the obvious adjacent pick. If they own Murakami, don't recommend another magic-realist novel — find what that taste reveals. Cross genres. A reader of literary fiction + popular science is hungry for narrative non-fiction. A reader of philosophy + thrillers is hungry for taut political memoir. Look for the through-line."*

Both prompts require: real published books only; not already on shelf; bridge book from the shelf; one specific "why" sentence. Both use Gemini structured output (`responseMimeType: "application/json"` + schema) to force valid JSON.

---

## Decisions made

| Decision | Why |
|---|---|
| **Next.js + Vercel** over Python + Cloud Run | Stack diversity on profile (masterclass tool is already Python/Cloud Run). Next 16 + Vercel AI surface is hot. Tighter local dev loop. |
| **Public repo from day 1** | "Build in public" is half the profile value. Commit history shows phased growth. |
| **Single `app/page.tsx` client component** | Whole app fits in one file. Adding Server Components for the recs step would add zero value at this size. Refactor when it hurts. |
| **Append-only state in React (no library)** | `useState` only; no Zustand/Redux. Whole UI flow is linear: file → books → recs. |
| **Skip Supabase; plan Firestore for Phase 4** | We're in GCP for the masterclass tool already. Firestore free tier is generous, no separate account, NoSQL fits the messy-JSON shape. |
| **Validate every rec against Open Library** | Cheapest hallucination filter possible. If a model invents a title, Open Library won't have it; we drop the row. Doesn't catch every fake but catches most. |
| **Heart-tap favorites cap at 5** | More than 5 dilutes the taste anchor signal in the prompt. Limit forces curation. |
| **Two distinct prompts over one with a "mode" knob** | A single prompt with `if mode == shadow` produces hedgey output. Two separate, opinionated prompts beats one diplomatic one. |
| **Open Library search (`/search.json`) over the Works API** | One call, returns enough fields for the card (title, author, cover_i, year, work key). |
| **Cover size = `-M.jpg`** | ~180px tall, ~30 KB. Small enough to load 5 in parallel without ceremony, big enough not to look pixelated. |
| **`gemini-2.5-flash` not Pro** | Free tier accommodates Flash easily; vision quality is more than enough for spines; latency is ~5–15s vs ~30s for Pro. |
| **Append-only manifest config in `app/manifest.ts`** | Next.js file convention auto-generates `/manifest.webmanifest` + the `<link rel="manifest">`. No manual head injection. |
| **Tailwind v4 CSS-first config** | Color palette is CSS custom props in `globals.css` mapped through `@theme inline`. Lets us use `bg-surface`, `text-foreground`, etc. directly without a JS config. |
| **Warm cream + terracotta palette ("Direction C")** | Considered: A (full literary), B (pure minimal), C (bookish-modern). C balances emotional name-fit with a profile-clean screenshot. |
| **Crimson Pro serif only on book titles + section heads** | Signals "literary" without going full Substack-newsletter; UI text stays in Geist Sans for legibility. |

---

## Gotchas — non-obvious things that bit me

1. **`create-next-app` is interactive** — needed to pass `--typescript --tailwind --eslint --app --no-src-dir --turbopack --import-alias="@/*" --use-npm` to avoid prompts.

2. **`AGENTS.md` in the scaffolded project warns about Next 16 breaking changes from training data** — the relevant ones for this app: `params`/`searchParams`/`cookies`/`headers` are all async in v16. Doesn't bite us yet because no dynamic routes; will bite as soon as `/event/[id]`-style pages appear.

3. **Tailwind v4 has no `tailwind.config.js` by default** — palette lives in `globals.css` via `@theme inline` + CSS custom props.

4. **`vercel --yes` with multiple teams requires `--scope`** — first deploy errored with `missing_scope`. Always pass `--scope ug4672s-projects`.

5. **`vercel env add` only adds to ONE environment per call** — needed three calls (Production, Preview, Development) to fully wire `GEMINI_API_KEY`.

6. **Empty-body POST to `/api/scan` returns 500 with no body** — `request.formData()` throws and Vercel emits a bare 500 instead of our JSON error. Not user-facing (browser always sends a body), but noted.

7. **Open Library cover URL with no `cover_i`** — about 10–15% of search hits have no cover. The rec card falls back to a "No cover" placeholder; not a bug.

8. **The `@google/genai` SDK has two APIs** — `ai.models.generateContent(...)` (classic, well-supported, used here) and `ai.interactions.create(...)` (new high-level wrapper). Stick with `models.generateContent` for now; `interactions` has an upcoming breaking change to function calling per the SDK README.

9. **`responseSchema` from `@google/genai` requires `Type.OBJECT` etc. enums** — not plain strings. Import: `import { GoogleGenAI, Type } from "@google/genai"`.

10. **`gemini-2.5-flash` rate limits on the free tier** — ~15 RPM. Fine for personal use; if Show-HN'd we'll get throttled. Upgrade path: paid tier (~$0.001/image) or fall back to Ollama llama3.2-vision locally.

---

## Known limitations / open items

| Item | Phase | Notes |
|---|---|---|
| No persistence | Phase 4 | No user accounts, no saved shelves. Refresh = lose your scan. |
| No "mark as read" feedback | Phase 4 | Recs don't disappear once you've read them. |
| No "is this title right?" confirmation for low-confidence extractions | Phase 2.5 | Right now low-confidence books still feed the prompt as-is. |
| No rate limiting on `/api/scan` or `/api/recommend` | Phase 5 | Anonymous abuse is possible. Free Gemini tier protects us softly. |
| US TZ correctness | N/A | App is country-agnostic. |
| Cover URLs hit Open Library directly (not proxied via `next/image`) | Phase 2.5 | Means no automatic image optimization. ~30 KB per cover is acceptable for now. |
| Search input on extracted list | Future | If shelves get to 50+ titles, scrolling becomes tedious. |
| Drag-and-drop on desktop upload | Future | Currently only click-to-pick + camera capture. |
| `vercel.com` GitHub Git auto-deploy not wired | Soon | Pushing to `main` doesn't currently trigger Vercel; I deploy manually via CLI. |
| OAuth/auth | Phase 4 | Plan: Google Sign-In via Next-Auth (or @auth/core). |
| Sharing / public links to a generated shadow library | Phase 5 | "Here's my shadow library" share card. |
| Analytics | Phase 5 | None yet. |

---

## Roadmap (where we are)

- **Phase 0** ✅ — Foundation: name + repo + scaffold + first deploy
- **Phase 1** ✅ — Core loop: upload → extract via Gemini vision → render
- **Phase 2** ✅ — Recommendations: `/api/recommend` + Open Library validation + PWA manifest
- **Phase 3** ✅ — Shadow library + favorites: two prompts + heart-tap taste anchors + mode toggle
- **UI revamp** ✅ — Warm cream palette, Crimson Pro serif, drop-zone upload, shimmer loading, footer
- **Phase 4** — Persistence + accounts (Firestore + Google Sign-In). Saved shelves, "my shelves" page, mark-as-read.
- **Phase 5** — Public launch: rate limiting, sample-scan landing page, blog post (*"What N bookshelf photos taught me about vision-LLM OCR"*), Show HN.

**Stretch later**: Chrome extension ("send this Amazon page to my shelf"), book-club mode (pool shelves of friends → recommend one book all would like), mood-gated picks ("for a flight"), local-Ollama version for a follow-up post.

---

## How to deploy

```bash
cd /Users/utkarshgupta/Documents/tsundoku
git push                                          # pushes main to GitHub
vercel --yes --prod --scope ug4672s-projects      # production deploy
```

Verify with `curl -sI https://tsundoku-one.vercel.app`.

To update env vars (if Gemini key ever changes):

```bash
echo "<NEW_KEY>" | vercel env add GEMINI_API_KEY production --scope ug4672s-projects
# Then redeploy: vercel --yes --prod --scope ug4672s-projects
```

---

## User profile

- **Name:** Utkarsh Gupta
- **Day job:** Performance Marketing, Interview Kickstart (`utkarsh.gupta@interviewkickstart.com`)
- **Personal GitHub:** `ug4672` (`ug4672@gmail.com`)
- **Goal for this project:** outside-of-work AI builder profile signal; not related to IK or marketing.
- **Constraints:** prefers free / low-friction; comfortable shipping to production; trusts Claude to take action and document changes.
- **Working style:** "build in public" — public repo, phased commits, willing to ship rough first then polish.
