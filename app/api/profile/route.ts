import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * Lets whoever is using the library set their own display name and title
 * (e.g. "Shane" / "Mission Commander") from inside the app, the same way the
 * avatar photo already can be. Stored as a small JSON blob in the existing
 * `assets` table under a reserved name — the same table and upsert pattern
 * `/api/avatar` already uses — so no schema change is needed.
 */
const ASSET_NAME = "profile.json";
const DEFAULTS = { name: "Nina", title: "Mission Commander" };
const MAX_FIELD_LENGTH = 60;

function parseProfile(payload: unknown) {
  if (typeof payload !== "string" || !payload) return DEFAULTS;
  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64").toString("utf8")) as {
      name?: unknown;
      title?: unknown;
    };
    const name =
      typeof decoded.name === "string" && decoded.name.trim() ? decoded.name.trim() : DEFAULTS.name;
    const title =
      typeof decoded.title === "string" && decoded.title.trim()
        ? decoded.title.trim()
        : DEFAULTS.title;
    return { name, title };
  } catch {
    return DEFAULTS;
  }
}

export async function GET() {
  const { data, error } = await supabase
    .from("assets")
    .select("payload")
    .eq("name", ASSET_NAME)
    .maybeSingle();

  if (error) {
    return Response.json(DEFAULTS);
  }
  return Response.json(parseProfile(data?.payload));
}

export async function POST(request: Request) {
  let body: { name?: unknown; title?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "That request could not be read." }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim().slice(0, MAX_FIELD_LENGTH) : "";
  const title = typeof body.title === "string" ? body.title.trim().slice(0, MAX_FIELD_LENGTH) : "";

  if (!name) {
    return Response.json({ error: "Add a name first." }, { status: 400 });
  }

  const payload = Buffer.from(
    JSON.stringify({ name, title: title || DEFAULTS.title }),
    "utf8",
  ).toString("base64");

  const { error } = await supabase
    .from("assets")
    .upsert({ name: ASSET_NAME, content_type: "application/json", payload }, { onConflict: "name" });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
