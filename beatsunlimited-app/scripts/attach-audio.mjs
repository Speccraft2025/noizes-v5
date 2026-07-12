#!/usr/bin/env node
// Attach a producer-supplied MP3 to a catalog beat.
//
//   node scripts/attach-audio.mjs <video_id> <path/to/beat.mp3>
//   node scripts/attach-audio.mjs <video_id> <https://producer-hosted-url>
//
// A local file is uploaded to the public `beat-files` storage bucket via the
// service role; a URL is stored as-is. Either way beat_catalog.download_url
// is set and the app's "Free Download" button starts serving the real MP3.
//
// Only use files the producer has actually provided/authorized — this tool
// intentionally has no way to fetch audio from YouTube.

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

const [videoId, source] = process.argv.slice(2);
if (!videoId || !source) {
  console.error("Usage: node scripts/attach-audio.mjs <video_id> <file.mp3 | https://url>");
  process.exit(1);
}
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (env or ../studio/.env)");
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

let downloadUrl;
if (/^https?:\/\//i.test(source)) {
  downloadUrl = source;
} else {
  const bytes = readFileSync(source);
  const objectPath = `${videoId}/${path.basename(source)}`;
  const { error } = await db.storage
    .from("beat-files")
    .upload(objectPath, bytes, { contentType: "audio/mpeg", upsert: true });
  if (error) {
    console.error(`upload failed: ${error.message}`);
    process.exit(1);
  }
  downloadUrl = db.storage.from("beat-files").getPublicUrl(objectPath).data.publicUrl;
  console.log(`uploaded ${bytes.length} bytes → ${downloadUrl}`);
}

const { data, error } = await db
  .from("beat_catalog")
  .update({ download_url: downloadUrl })
  .eq("video_id", videoId)
  .select("video_id, title");
if (error) {
  console.error(`beat_catalog update failed: ${error.message}`);
  process.exit(1);
}
if (!data?.length) {
  console.error(`No beat with video_id "${videoId}" in beat_catalog — run npm run ingest first.`);
  process.exit(1);
}
console.log(`download_url set for ${data[0].video_id} — ${data[0].title}`);
