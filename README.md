# Tsundoku 📚

> *Tsundoku (積ん読)* — the Japanese practice of acquiring books and letting them pile up unread.

Photograph your bookshelf. Get reading recommendations from books you already own — plus a *shadow library* of titles you'd love but haven't found yet.

## Status

🚧 Work in progress. Building in public.

- [x] Phase 0 — Foundation
- [ ] Phase 1 — Core loop (upload → extract → recommend)
- [ ] Phase 2 — Mobile-friendly UI + low-confidence handling
- [ ] Phase 3 — Shadow library (the differentiator)
- [ ] Phase 4 — Saved shelves + sign-in
- [ ] Phase 5 — Public launch

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind v4
- Vercel (hosting)
- Google Gemini (vision + recommendations)
- Open Library API (book metadata + covers)
- Firestore (persistence — added in Phase 4)

## Local development

```bash
npm install
npm run dev
```

App runs on http://localhost:3000.
