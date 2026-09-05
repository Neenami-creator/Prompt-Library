# Prompt Library

A standalone Next.js app holding Nina's 514-prompt library. It no longer depends on
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

- **`prompts`** — the library. 514 rows. Every edit, favourite, archive and copy-count
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

## One thing worth knowing

### There is no login

Anyone who has the URL can read, edit, add and archive prompts. This mirrors how the
original ChatGPT Sites app worked — its API was open too — so nothing got *less* safe in
the move. Vercel's "Vercel Authentication" is currently switched on for this project,
which means only someone signed in to your Vercel account can reach it. Turn that off in
**Vercel → Project → Settings → Deployment Protection** if you want a link you can open
without signing in or share with someone else.

If you'd rather have a real login later, Supabase Auth plus tightened row-level security
policies is the natural next step.

---

## Changelog

### 2026-09-05 — Bulk add: 29 new prompts

- **485 → 514 prompts.** A batch of 30 supplied prompts was normalised and inserted
  directly into the Supabase `prompts` table. All 29 inserted rows carry
  `source = 'Bulk add — 2026-09-05'`, so the batch can be identified or reversed in one
  statement. No categories were added or removed — still 28.
- **Distribution:** image generation & editing +7 (98), website & ux strategy +9 (28),
  animation & storyboarding +3 (9), visual design & infographics +2 (9), app building &
  saas +2 (16), branding & creative direction +2 (57), and one each to dashboards & data
  visualisation (16), software engineering & code quality (21) and analysis & decision
  support (29).
- **New "Website Build Series".** Seven of the additions form a sequential agency-website
  workflow — creative direction → experience design → hero → motion → build sequence →
  polish → launch audit. Rather than create a 29th category, they stayed in
  "website & ux strategy", share a `Website Build Series` tag, and are numbered
  "Step 1 of the website build series" … "Step 7" in their descriptions.
- **One prompt skipped as a duplicate.** A supplied "advanced image quality enhancer"
  duplicated the existing *Enhance Image Quality* and *Upscale Image Resolution*, so 30
  supplied became 29 inserted.
- **Source repairs.** Two prompts had arrived spliced into one another and were separated
  (*Hand-Drawn Whiteboard Infographic* and *Rick and Morty Scene Conversion*);
  *GitHub Portfolio Dashboard Builder* was rebuilt from a source containing literal `\n`
  escapes and unfilled variables; stray API parameters and a model-name prefix were
  stripped from two image prompts; and *No-Code Website Build Sequence* had a missing tool
  name replaced with an `[AI BUILDER]` placeholder.
- **Note for next time:** "image generation & editing" is now 98 of 514 prompts — 19% of
  the library, and the obvious candidate for a future split.

### 2026-08-29 — Library audit and curation pass

- **Fixed: the eleven prompts cut off during the original migration.** These had arrived
  from the ChatGPT Sites export with the literal marker `[truncated for model]` in the
  prompt body. All eleven have since been rebuilt with complete, natural endings and are
  marked `recovery_status = 'rebuilt'` in the database: Complete Brand Strategy Blueprint,
  Create My Personalised AI Money Map, Expert Newsletter Strategist, Gallery-Quality
  Graphite Dog Portrait, Luxury Visual Identity Designer, Master Graphite Fashion Portrait
  & Artist's Workspace, Master Prompt — Product Infographic Generator, Premium Brand
  Naming System, Pro Songwriting Assistant, Redesign an Existing Page Without Changing
  Content or Functionality, Ultimate Text Summariser. No prompt in the library shows the
  truncation marker any more.
- **Recategorised 77 prompts** to fix a taxonomy that had drifted as the library grew:
  pulled 6 astrology/spirituality prompts out of "productivity & organisation" (their own
  category now), folded the tool-named "gemini" category into "dashboards & data
  visualisation", consolidated three separate NotebookLM categories into one, consolidated
  a "faceless content" theme that had been scattered across four different categories,
  and cleaned up several other thin or overlapping categories. 35 categories became 28.
- **Removed 40 archived prompts** that had been sitting invisible in the app (an old
  "essentials" quick-command set and a batch of additional image-generation techniques).
  None duplicated anything in the active library, so a backup of their content was kept
  before deletion.

---

## Backups

The **Export** menu (top right, desktop) downloads the whole library as JSON or Markdown,
and **Import JSON** reads it back. Worth doing occasionally.
