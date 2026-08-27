"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import type { User } from "@supabase/supabase-js";

const SYNC_KEYS = [
  "promptLibrary:personalPrompts",
  "promptLibrary:hiddenPromptIds",
  "promptLibrary:favourites",
  "promptLibrary:profile",
  "promptLibrary:avatar",
  "promptLibrary:filters",
  "promptLibrary:favoriteOrder",
  "promptLibrary:theme",
  "promptLibrary:usageEvents",
] as const;

type SyncState = Record<string, string>;

function readLocalState(): SyncState {
  const state: SyncState = {};
  for (const key of SYNC_KEYS) {
    try {
      const value = window.localStorage.getItem(key);
      if (value !== null) state[key] = value;
    } catch {}
  }
  return state;
}

function hasMeaningfulLocalState(state: SyncState) {
  return Object.keys(state).some((key) => {
    const value = state[key];
    return value && value !== "[]" && value !== "{}" && value !== "light";
  });
}

function mergePromptArrays(localRaw?: string, cloudRaw?: string) {
  try {
    const local = localRaw ? JSON.parse(localRaw) : [];
    const cloud = cloudRaw ? JSON.parse(cloudRaw) : [];
    if (!Array.isArray(local) || !Array.isArray(cloud)) return localRaw ?? cloudRaw ?? "[]";
    const merged = new Map<string, any>();
    for (const item of [...cloud, ...local]) {
      if (!item?.id) continue;
      const previous = merged.get(item.id);
      if (!previous) merged.set(item.id, item);
      else {
        const previousTime = new Date(previous.updatedAt ?? previous.createdAt ?? 0).getTime();
        const itemTime = new Date(item.updatedAt ?? item.createdAt ?? 0).getTime();
        if (itemTime >= previousTime) merged.set(item.id, item);
      }
    }
    return JSON.stringify([...merged.values()]);
  } catch {
    return localRaw ?? cloudRaw ?? "[]";
  }
}

function mergeSetArrays(localRaw?: string, cloudRaw?: string) {
  try {
    const local = localRaw ? JSON.parse(localRaw) : [];
    const cloud = cloudRaw ? JSON.parse(cloudRaw) : [];
    if (!Array.isArray(local) || !Array.isArray(cloud)) return localRaw ?? cloudRaw ?? "[]";
    return JSON.stringify([...new Set([...cloud, ...local].map(String))]);
  } catch {
    return localRaw ?? cloudRaw ?? "[]";
  }
}

function mergeStates(local: SyncState, cloud: SyncState): SyncState {
  if (!hasMeaningfulLocalState(local)) return { ...cloud };
  const result: SyncState = { ...cloud, ...local };

  result["promptLibrary:personalPrompts"] = mergePromptArrays(
    local["promptLibrary:personalPrompts"],
    cloud["promptLibrary:personalPrompts"],
  );
  result["promptLibrary:usageEvents"] = mergePromptArrays(
    local["promptLibrary:usageEvents"],
    cloud["promptLibrary:usageEvents"],
  );
  for (const key of [
    "promptLibrary:hiddenPromptIds",
    "promptLibrary:favourites",
    "promptLibrary:favoriteOrder",
  ]) {
    result[key] = mergeSetArrays(local[key], cloud[key]);
  }

  return result;
}

function writeLocalState(state: SyncState) {
  for (const [key, value] of Object.entries(state)) {
    try {
      window.localStorage.setItem(key, value);
    } catch {}
  }
}

export default function SyncPanel() {
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const syncingRef = useRef(false);
  const readyRef = useRef(false);

  const label = useMemo(() => {
    if (user) return "Synced";
    return "Sync my library";
  }, [user]);

  async function pushState(currentUser = user) {
    if (!currentUser || syncingRef.current) return;
    syncingRef.current = true;
    try {
      const state = readLocalState();
      const { error } = await supabaseBrowser
        .from("user_library_sync")
        .upsert(
          { user_id: currentUser.id, state, updated_at: new Date().toISOString() },
          { onConflict: "user_id" },
        );
      if (error) throw error;
      setStatus("Synced");
    } catch {
      setStatus("Sync unavailable");
    } finally {
      syncingRef.current = false;
    }
  }

  async function initialiseSync(currentUser: User) {
    if (syncingRef.current) return;
    syncingRef.current = true;
    setStatus("Syncing…");
    try {
      const { data, error } = await supabaseBrowser
        .from("user_library_sync")
        .select("state")
        .eq("user_id", currentUser.id)
        .maybeSingle();

      if (error) throw error;

      const local = readLocalState();
      const cloud = (data?.state ?? {}) as SyncState;
      const merged = mergeStates(local, cloud);
      writeLocalState(merged);

      const { error: saveError } = await supabaseBrowser
        .from("user_library_sync")
        .upsert(
          { user_id: currentUser.id, state: merged, updated_at: new Date().toISOString() },
          { onConflict: "user_id" },
        );

      if (saveError) throw saveError;
      setStatus("Synced");
      readyRef.current = true;

      if (JSON.stringify(local) !== JSON.stringify(merged)) {
        window.setTimeout(() => window.location.reload(), 250);
      }
    } catch {
      setStatus("Sync needs setup");
    } finally {
      syncingRef.current = false;
    }
  }

  useEffect(() => {
    let mounted = true;

    void supabaseBrowser.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      const currentUser = data.session?.user ?? null;
      setUser(currentUser);
      if (currentUser) void initialiseSync(currentUser);
    });

    const { data: subscription } = supabaseBrowser.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) void initialiseSync(currentUser);
      else {
        readyRef.current = false;
        setStatus("");
      }
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    let lastSnapshot = JSON.stringify(readLocalState());
    const checkForChanges = () => {
      if (!readyRef.current) return;
      const nextSnapshot = JSON.stringify(readLocalState());
      if (nextSnapshot === lastSnapshot) return;
      lastSnapshot = nextSnapshot;
      void pushState(user);
    };

    const interval = window.setInterval(checkForChanges, 4000);
    const onVisibility = () => {
      if (document.visibilityState === "hidden") checkForChanges();
    };
    window.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("visibilitychange", onVisibility);
    };
  }, [user]);

  async function sendMagicLink(event: FormEvent) {
    event.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    setBusy(true);
    setStatus("Sending link…");
    const { error } = await supabaseBrowser.auth.signInWithOtp({
      email: trimmed,
      options: { emailRedirectTo: window.location.origin },
    });
    setBusy(false);
    if (error) setStatus(error.message);
    else setStatus("Check your email for the sign-in link");
  }

  async function signOut() {
    await pushState(user);
    await supabaseBrowser.auth.signOut();
    setOpen(false);
    setStatus("");
  }

  return (
    <>
      <button
        type="button"
        className="sync-library-button"
        onClick={() => setOpen(true)}
        aria-label={user ? "Open sync settings" : "Sync my library across devices"}
      >
        <span>{label}</span>
        <span className={user ? "sync-dot is-on" : "sync-dot"} aria-hidden="true" />
      </button>

      {open && (
        <div className="sync-layer" role="presentation" onMouseDown={() => setOpen(false)}>
          <section
            className="sync-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sync-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <p>OPTIONAL</p>
                <h2 id="sync-title">Sync my library</h2>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close">×</button>
            </header>

            {user ? (
              <div className="sync-content">
                <p>
                  Your personal prompts, favourites, hidden prompts, profile, photo,
                  appearance and library preferences can now follow you across devices.
                </p>
                <strong>{user.email}</strong>
                <span>{status || "Synced"}</span>
                <button type="button" className="secondary-button" onClick={() => void pushState()}>
                  Sync now
                </button>
                <button type="button" className="subtle-button" onClick={() => void signOut()}>
                  Stop syncing on this device
                </button>
              </div>
            ) : (
              <form className="sync-content" onSubmit={sendMagicLink}>
                <p>
                  Enter your email. We’ll send you a secure sign-in link — no password needed.
                  Use the same email on another device to bring your personal library with you.
                </p>
                <label>
                  <span>Email</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    required
                  />
                </label>
                <button className="primary-button" disabled={busy}>
                  {busy ? "Sending…" : "Email me a sign-in link"}
                </button>
                {status && <span className="sync-status">{status}</span>}
                <small>Sync is optional. You can keep using the library without signing in.</small>
              </form>
            )}
          </section>
        </div>
      )}
    </>
  );
}
