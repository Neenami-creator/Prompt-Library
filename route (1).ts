import { supabase, PROMPT_COLUMNS, type PromptRow } from "@/lib/supabase";
import { normaliseAustralianEnglish } from "@/lib/australian-english";

export const dynamic = "force-dynamic";

type PromptPayload = {
  id?: string;
  title?: string;
  category?: string;
  tags?: unknown;
  description?: string;
  promptText?: string;
  source?: string;
  recoveryStatus?: string;
  aliases?: unknown;
  featured?: boolean;
  favorite?: boolean;
  archived?: boolean;
  incrementCopy?: boolean;
};

function parseList(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function cleanList(value: unknown) {
  return Array.isArray(value)
    ? [...new Set(value.map(String).map((item) => item.trim()).filter(Boolean))]
    : [];
}

function serialise(row: PromptRow) {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    tags: parseList(row.tags_json),
    description: row.description,
    promptText: row.prompt_text,
    source: row.source,
    recoveryStatus: row.recovery_status,
    aliases: parseList(row.aliases_json),
    featured: row.featured,
    favorite: row.favorite,
    archived: row.archived,
    copyCount: row.copy_count,
    lastCopiedAt: row.last_copied_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const includeArchived = url.searchParams.get("archived") === "true";

    let query = supabase
      .from("prompts")
      .select(PROMPT_COLUMNS)
      .order("featured", { ascending: false })
      .order("title", { ascending: true })
      .limit(2000);

    if (!includeArchived) query = query.eq("archived", false);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    const rows = (data ?? []) as PromptRow[];

    return Response.json({
      prompts: rows.map(serialise),
      audit: {
        seedCount: rows.length,
        recoveredFromPrototype: rows.filter((item) =>
          item.source.includes("latest Mission Control prototype"),
        ).length,
        rebuiltBodies: rows.filter((item) => item.recovery_status === "rebuilt")
          .length,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as PromptPayload;
    const title = normaliseAustralianEnglish(payload.title?.trim() ?? "");
    const promptText = normaliseAustralianEnglish(payload.promptText?.trim() ?? "");
    if (!title || !promptText) {
      return Response.json(
        { error: "A title and full prompt are required." },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();
    const id = payload.id?.trim() || slugify(title) || crypto.randomUUID();

    const insert = {
      id,
      title,
      category: payload.category?.trim().toLowerCase() || "uncategorised",
      tags_json: JSON.stringify(
        cleanList(payload.tags).map(normaliseAustralianEnglish),
      ),
      description: normaliseAustralianEnglish(payload.description?.trim() || ""),
      prompt_text: promptText,
      source: payload.source?.trim() || "Added in prompt library",
      recovery_status: payload.recoveryStatus || "added",
      aliases_json: JSON.stringify(
        cleanList(payload.aliases).map(normaliseAustralianEnglish),
      ),
      featured: Boolean(payload.featured),
      favorite: Boolean(payload.favorite),
      archived: false,
      copy_count: 0,
      last_copied_at: null,
      created_at: now,
      updated_at: now,
    };

    const { data, error } = await supabase
      .from("prompts")
      .insert(insert)
      .select(PROMPT_COLUMNS)
      .single();

    if (error) throw new Error(error.message);

    return Response.json({ prompt: serialise(data as PromptRow) }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const payload = (await request.json()) as PromptPayload;
    const id = payload.id?.trim();
    if (!id) {
      return Response.json({ error: "Prompt id is required." }, { status: 400 });
    }

    if (payload.incrementCopy) {
      const { error: rpcError } = await supabase.rpc("increment_copy_count", {
        prompt_id: id,
      });
      if (rpcError) throw new Error(rpcError.message);
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (payload.title !== undefined)
      updates.title = normaliseAustralianEnglish(payload.title.trim());
    if (payload.category !== undefined)
      updates.category = payload.category.trim().toLowerCase();
    if (payload.tags !== undefined)
      updates.tags_json = JSON.stringify(
        cleanList(payload.tags).map(normaliseAustralianEnglish),
      );
    if (payload.description !== undefined)
      updates.description = normaliseAustralianEnglish(payload.description.trim());
    if (payload.promptText !== undefined)
      updates.prompt_text = normaliseAustralianEnglish(payload.promptText.trim());
    if (payload.source !== undefined) updates.source = payload.source.trim();
    if (payload.aliases !== undefined)
      updates.aliases_json = JSON.stringify(
        cleanList(payload.aliases).map(normaliseAustralianEnglish),
      );
    if (payload.featured !== undefined) updates.featured = payload.featured;
    if (payload.favorite !== undefined) updates.favorite = payload.favorite;
    if (payload.archived !== undefined) updates.archived = payload.archived;

    const hasFieldUpdates = Object.keys(updates).length > 1;
    if (hasFieldUpdates || !payload.incrementCopy) {
      const { error } = await supabase.from("prompts").update(updates).eq("id", id);
      if (error) throw new Error(error.message);
    }

    const { data, error: readError } = await supabase
      .from("prompts")
      .select(PROMPT_COLUMNS)
      .eq("id", id)
      .eq("archived", false)
      .maybeSingle();

    if (readError) throw new Error(readError.message);

    return Response.json({ prompt: data ? serialise(data as PromptRow) : null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return Response.json({ error: message }, { status: 500 });
  }
}
