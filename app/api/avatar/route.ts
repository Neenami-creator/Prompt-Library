import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * Lets the profile photo be replaced from inside the app itself, instead of
 * requiring a redeploy. The uploaded image is resized client-side, sent here
 * as a data URL, and written straight into the `assets` table under the same
 * name the rest of the app already reads — `/neen-avatar.jpg` — so nothing
 * else about how the photo is served needs to change.
 */
const MAX_DECODED_BYTES = 4_000_000; // comfortably under the platform's request-body limit

function parseDataUrl(value: unknown) {
  if (typeof value !== "string") return null;
  const match = /^data:(image\/[a-zA-Z0-9+.-]+);base64,([a-zA-Z0-9+/=]+)$/.exec(value);
  if (!match) return null;
  return { contentType: match[1], base64: match[2] };
}

export async function POST(request: Request) {
  let body: { dataUrl?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "That request could not be read." }, { status: 400 });
  }

  const parsed = parseDataUrl(body.dataUrl);
  if (!parsed) {
    return Response.json({ error: "Choose a valid image file." }, { status: 400 });
  }

  if (Buffer.byteLength(parsed.base64, "base64") > MAX_DECODED_BYTES) {
    return Response.json({ error: "That image is too large." }, { status: 400 });
  }

  const { error } = await supabase
    .from("assets")
    .upsert(
      { name: "neen-avatar.jpg", content_type: parsed.contentType, payload: parsed.base64 },
      { onConflict: "name" },
    );

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
