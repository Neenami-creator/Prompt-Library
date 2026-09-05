diff --git a/README.md b/README.md
index 17dc34d..2fb0161 100644
--- a/README.md
+++ b/README.md
@@ -1,6 +1,6 @@
 # Prompt Library
 
-A standalone Next.js app holding Nina's 485-prompt library. It no longer depends on
+A standalone Next.js app holding Nina's 514-prompt library. It no longer depends on
 ChatGPT Sites, Cloudflare D1 or any OpenAI infrastructure.
 
 **Live:** https://neenos-prompt-library.vercel.app
@@ -18,7 +18,7 @@ ChatGPT Sites, Cloudflare D1 or any OpenAI infrastructure.
 
 ### Tables
 
-- **`prompts`** — the library. 485 rows. Every edit, favourite, archive and copy-count
+- **`prompts`** — the library. 514 rows. Every edit, favourite, archive and copy-count
   made in the app writes here, so changes persist.
 - **`assets`** — the 17 custom icons plus the avatar, stored base64. Served by
   `/api/icon/[file]`, which `next.config.ts` maps back onto the original
@@ -85,6 +85,34 @@ policies is the natural next step.
 
 ## Changelog
 
+### 2026-09-05 — Bulk add: 29 new prompts
+
+- **485 → 514 prompts.** A batch of 30 supplied prompts was normalised and inserted
+  directly into the Supabase `prompts` table. All 29 inserted rows carry
+  `source = 'Bulk add — 2026-09-05'`, so the batch can be identified or reversed in one
+  statement. No categories were added or removed — still 28.
+- **Distribution:** image generation & editing +7 (98), website & ux strategy +9 (28),
+  animation & storyboarding +3 (9), visual design & infographics +2 (9), app building &
+  saas +2 (16), branding & creative direction +2 (57), and one each to dashboards & data
+  visualisation (16), software engineering & code quality (21) and analysis & decision
+  support (29).
+- **New "Website Build Series".** Seven of the additions form a sequential agency-website
+  workflow — creative direction → experience design → hero → motion → build sequence →
+  polish → launch audit. Rather than create a 29th category, they stayed in
+  "website & ux strategy", share a `Website Build Series` tag, and are numbered
+  "Step 1 of the website build series" … "Step 7" in their descriptions.
+- **One prompt skipped as a duplicate.** A supplied "advanced image quality enhancer"
+  duplicated the existing *Enhance Image Quality* and *Upscale Image Resolution*, so 30
+  supplied became 29 inserted.
+- **Source repairs.** Two prompts had arrived spliced into one another and were separated
+  (*Hand-Drawn Whiteboard Infographic* and *Rick and Morty Scene Conversion*);
+  *GitHub Portfolio Dashboard Builder* was rebuilt from a source containing literal `\n`
+  escapes and unfilled variables; stray API parameters and a model-name prefix were
+  stripped from two image prompts; and *No-Code Website Build Sequence* had a missing tool
+  name replaced with an `[AI BUILDER]` placeholder.
+- **Note for next time:** "image generation & editing" is now 98 of 514 prompts — 19% of
+  the library, and the obvious candidate for a future split.
+
 ### 2026-08-29 — Library audit and curation pass
 
 - **Fixed: the eleven prompts cut off during the original migration.** These had arrived
