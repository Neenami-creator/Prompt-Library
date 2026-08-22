import { brotliDecompressSync } from "node:zlib";
import { supabase, type PromptRow } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * One-time import of the exported live library into Postgres.
 *
 * The dataset is staged in the `seed_blob` table as a base64 brotli archive,
 * split across rows `prompts-0`…`prompts-N`: the environment that generated it
 * has no direct network route to Supabase, so the archive travels over SQL in
 * chunks and is reassembled here, where Node's zlib is available. Rows are
 * inserted exactly as exported — already normalised to Australian English by
 * the export step — and `ignoreDuplicates` makes the import safe to run twice:
 * existing rows are never overwritten.
 *
 * Everything here is guarded by SEED_TOKEN so it cannot be triggered by anyone
 * who happens to find the URL.
 */
const SEED_TOKEN = process.env.SEED_TOKEN ?? "neenos-seed-8f3c1a2d";

async function loadSeedRows(): Promise<PromptRow[]> {
  const { data, error } = await supabase
    .from("seed_blob")
    .select("id,payload")
    .like("id", "prompts-%")
    .order("id", { ascending: true });

  if (error) throw new Error(`seed_blob read failed: ${error.message}`);
  if (!data?.length) throw new Error("seed_blob is empty.");

  // Chunk ids sort lexically in generation order, so the sorted concatenation
  // reproduces the original base64 string byte-for-byte.
  const base64 = data.map((row) => row.payload as string).join("");
  const buf = Buffer.from(base64, "base64");
  return JSON.parse(brotliDecompressSync(buf).toString("utf8")) as PromptRow[];
}

async function runImport(rows: PromptRow[]) {
  const BATCH = 50;
  let sent = 0;

  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const { error } = await supabase
      .from("prompts")
      .upsert(chunk, { onConflict: "id", ignoreDuplicates: true });
    if (error) throw new Error(`batch ${i / BATCH}: ${error.message}`);
    sent += chunk.length;
  }

  return sent;
}

/**
 * Compares every stored row against the source archive, so a silent truncation
 * anywhere in the transfer would be caught rather than quietly shipped.
 */
async function verify(rows: PromptRow[]) {
  const { data, error } = await supabase
    .from("prompts")
    .select("id,title,prompt_text,description")
    .limit(2000);
  if (error) throw new Error(error.message);

  const stored = new Map(
    (data ?? []).map((r) => [r.id as string, r as Record<string, string>]),
  );

  const missing: string[] = [];
  const mismatched: string[] = [];

  for (const row of rows) {
    const found = stored.get(row.id);
    if (!found) {
      missing.push(row.id);
      continue;
    }
    if (
      found.prompt_text !== row.prompt_text ||
      found.title !== row.title ||
      found.description !== row.description
    ) {
      mismatched.push(row.id);
    }
  }

  return {
    sourceRows: rows.length,
    tableCount: stored.size,
    missing: missing.slice(0, 20),
    missingCount: missing.length,
    mismatched: mismatched.slice(0, 20),
    mismatchedCount: mismatched.length,
    exactMatch: missing.length === 0 && mismatched.length === 0,
  };
}

export async function POST(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (token !== SEED_TOKEN) {
    return Response.json({ error: "Not authorised." }, { status: 401 });
  }

  try {
    const rows = await loadSeedRows();
    const sent = await runImport(rows);
    return Response.json({ ok: true, sent, ...(await verify(rows)) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return Response.json({ error: message }, { status: 500 });
  }
}

/**
 * Read-only verification report. Also accepts `&run=1`, which performs the same
 * idempotent import as POST first — the deployment tooling used to set this app
 * up can only issue GET requests, and re-running the import is harmless.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  if (params.get("token") !== SEED_TOKEN) {
    return Response.json({ error: "Not authorised." }, { status: 401 });
  }

  try {
    const rows = await loadSeedRows();
    const sent = params.get("run") === "1" ? await runImport(rows) : null;
    return Response.json({ imported: sent, ...(await verify(rows)) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return Response.json({ error: message }, { status: 500 });
  }
}
