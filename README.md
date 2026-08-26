# Prompt Library

A standalone Next.js app holding Nina's 463-prompt library. It no longer depends on
ChatGPT Sites, Cloudflare D1 or any OpenAI infrastructure.

**Live:** https://neenos-prompt-library.vercel.app

---

## Architecture

| Layer | What it is |
| --- | --- |
| App | Next.js 15 (App Router) + React 19, TypeScript |
| Hosting | Vercel (project `neenos-prompt-library`) |
| Database | Supabase Postgres, project `custom-prompt-library` (`tdxmwkywkrhuwgpgnhdo`), region ap-southeast-2, free tier |
| Data access | `@supabase/supabase-js` over PostgREST with the publishable ("anon") key |

### Tables

- **`prompts`** — the library. 463 rows. Every edit, favourite, archive and copy-count
  made in the app writes here, so changes persist.
- **`assets`** — the 17 custom icons plus the avatar, stored base64. Served by
  `/api/icon/[file]`, which `next.config.ts` maps back onto the original
  `/icons/*.webp` and `/neen-avatar.jpg` URLs. Nothing in the page markup had to change.
- **`seed_blob`** — the original import archive (brotli + base64, 8 parts). Kept as a
  cold backup of the exact data that was migrated; nothing reads it at runtime.

### Routes

- `GET /api/prompts` — the library plus the audit counts the drawer displays.
- `POST /api/prompts` — add a prompt.
- `PATCH /api/prompts` — edit, favourite, archive, or increment the copy count
  (via the `increment_copy_count` Postgres function, so concurrent copies can't
  clobber each other).
- `GET /api/icon/[file]` — icons and avatar, cached immutably for a year.
- `GET|POST /api/seed` — one-off import and integrity report. Token-guarded.
  Already run; you should never need it again.

Australian-English normalisation (`lib/australian-english.ts`, 96 rules) still runs on
everything you add or edit, exactly as it did on the original site.

---

## Running it locally

```bash
npm install
npm run dev      # http://localhost:3000
```

`npm run build` runs a source integrity check first (see below), then builds.

## Source integrity check

The migration had to move every character of this app through a text-only channel, so
`integrity.json` records a sha256 for each source file and `npm run build` verifies them.
A failing build means a file changed since it was sealed.

**If you edited a file on purpose, that failure is expected.** Run:

```bash
npm run reseal
```

...to record the new hashes, then build again.

---

## Two things worth knowing

### 1. There is no login

Anyone who has the URL can read, edit, add and archive prompts. This mirrors how the
original ChatGPT Sites app worked — its API was open too — so nothing got *less* safe in
the move. Vercel's "Vercel Authentication" is currently switched on for this project,
which means only someone signed in to your Vercel account can reach it. Turn that off in
**Vercel → Project → Settings → Deployment Protection** if you want a link you can open
without signing in or share with someone else.

If you'd rather have a real login later, Supabase Auth plus tightened row-level security
policies is the natural next step.

### 2. Eleven prompts were already cut off before the migration

These eleven arrived from the ChatGPT Sites export with the literal marker
`[truncated for model]` in the prompt body, each around 2,000 characters — the export
itself clipped them. They were migrated exactly as found; nothing was lost or altered
here, but the endings are missing and would need to be pasted back in from wherever the
originals live:

1. Complete Brand Strategy Blueprint
2. Create My Personalised AI Money Map
3. Expert Newsletter Strategist
4. Gallery-Quality Graphite Dog Portrait
5. Luxury Visual Identity Designer
6. Master Graphite Fashion Portrait & Artist's Workspace
7. Master Prompt — Product Infographic Generator
8. Premium Brand Naming System
9. Pro Songwriting Assistant
10. Redesign an Existing Page Without Changing Content or Functionality
11. Ultimate Text Summariser

Search the library for `truncated` to find them.

---

## Backups

The **Export** menu (top right, desktop) downloads the whole library as JSON or Markdown,
and **Import JSON** reads it back. Worth doing occasionally.
