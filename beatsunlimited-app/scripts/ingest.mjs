#!/usr/bin/env node
// Catalog ingestion for beatsunlimited.
//
// Two modes, picked automatically:
//   1. YOUTUBE_API_KEY set   → searches the YouTube Data API for fresh free
//      type-beat uploads per genre and upserts them into beat_catalog.
//   2. No key                → seeds/refreshes beat_catalog from the curated
//      list in src/data/beats.js, re-fetching titles via YouTube's public
//      oEmbed endpoint so stale/removed videos get deactivated.
//
// Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (falls back to reading
// ../studio/.env so it works out of the box in the Noizes V5 repo).
//
// Run:  node scripts/ingest.mjs
// Cron: schedule this on the server that owns the service role key. It must
//       never ship to the browser bundle.

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnvFile(p) {
  try {
    return Object.fromEntries(
      readFileSync(p, "utf8")
        .split("\n")
        .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
        .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
    );
  } catch {
    return {};
  }
}

const studioEnv = loadEnvFile(path.join(__dirname, "../../studio/.env"));
const SUPABASE_URL = process.env.SUPABASE_URL || studioEnv.PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || studioEnv.SUPABASE_SERVICE_ROLE_KEY;
const YT_KEY = process.env.YOUTUBE_API_KEY || studioEnv.YOUTUBE_API_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (env or ../studio/.env)");
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const GENRE_QUERIES = [
  { genre: "Afrobeats", q: "free afrobeat type beat instrumental" },
  { genre: "Drill", q: "free drill type beat" },
  { genre: "Amapiano", q: "free amapiano type beat instrumental" },
  { genre: "R&B", q: "free r&b type beat trapsoul" },
  { genre: "Hip-Hop", q: "free hip hop type beat" },
];

async function oembed(videoId) {
  const res = await fetch(
    `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`
  );
  if (!res.ok) return null;
  return res.json();
}

async function upsertBeats(rows) {
  const { error } = await db.from("beat_catalog").upsert(rows, { onConflict: "video_id" });
  if (error) throw new Error(`upsert failed: ${error.message}`);
}

async function seedFromCuratedList() {
  console.log("No YOUTUBE_API_KEY — seeding/refreshing from curated src/data/beats.js via oEmbed");
  const src = readFileSync(path.join(__dirname, "../src/data/beats.js"), "utf8");
  const ids = [...src.matchAll(/videoId:\s*"([^"]+)"/g)].map((m) => m[1]);
  const meta = Object.fromEntries(
    [...src.matchAll(/videoId:\s*"([^"]+)"[\s\S]*?genre:\s*"([^"]+)"[\s\S]*?tags:\s*\[([^\]]*)\][\s\S]*?tempo:\s*"([^"]+)"[\s\S]*?license:\s*"([^"]+)"/g)]
      .map((m) => [m[1], { genre: m[2], tags: m[3].split(",").map((t) => t.trim().replace(/^"|"$/g, "")).filter(Boolean), tempo: m[4], license: m[5] }])
  );

  const rows = [];
  for (const id of ids) {
    const oe = await oembed(id);
    if (!oe) {
      console.warn(`  ✗ ${id} — no longer embeddable, marking inactive`);
      await db.from("beat_catalog").update({ is_active: false }).eq("video_id", id);
      continue;
    }
    const m = meta[id] ?? {};
    rows.push({
      video_id: id,
      title: oe.title,
      producer: oe.author_name,
      producer_url: oe.author_url,
      genre: m.genre ?? null,
      tags: m.tags ?? [],
      tempo: m.tempo ?? null,
      license: m.license ?? "Free — terms in description",
      thumb: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      watch_url: `https://www.youtube.com/watch?v=${id}`,
      source: "seed",
      is_active: true,
    });
    console.log(`  ✓ ${id} — ${oe.title}`);
  }
  if (rows.length) await upsertBeats(rows);
  return rows.length;
}

async function ingestFromYouTubeApi() {
  console.log("YOUTUBE_API_KEY found — searching YouTube Data API");
  let total = 0;
  for (const { genre, q } of GENRE_QUERIES) {
    const url =
      "https://www.googleapis.com/youtube/v3/search" +
      `?part=snippet&type=video&videoEmbeddable=true&order=date&maxResults=10` +
      `&q=${encodeURIComponent(q)}&key=${YT_KEY}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`  ✗ ${genre}: YouTube API ${res.status} — ${(await res.text()).slice(0, 200)}`);
      continue;
    }
    const { items = [] } = await res.json();
    const rows = items
      .filter((it) => /free/i.test(it.snippet.title))
      .map((it) => ({
        video_id: it.id.videoId,
        title: it.snippet.title,
        producer: it.snippet.channelTitle,
        producer_url: `https://www.youtube.com/channel/${it.snippet.channelId}`,
        genre,
        tags: [],
        tempo: null,
        license: "Free — terms in description",
        thumb: it.snippet.thumbnails?.high?.url ?? `https://i.ytimg.com/vi/${it.id.videoId}/hqdefault.jpg`,
        watch_url: `https://www.youtube.com/watch?v=${it.id.videoId}`,
        source: "youtube_api",
        is_active: true,
      }));
    if (rows.length) await upsertBeats(rows);
    console.log(`  ✓ ${genre}: ${rows.length} beats upserted`);
    total += rows.length;
  }
  return total;
}

const count = YT_KEY ? await ingestFromYouTubeApi() : await seedFromCuratedList();
console.log(`Done — ${count} beats in this run.`);
