import { supabase } from "./supabase.js";
import { beats as seedBeats } from "../data/beats.js";

// Loads the beat catalog from Supabase (populated by scripts/ingest.mjs).
// Falls back to the static seed array when the backend is unconfigured or
// the beat_catalog table is empty/missing.

function rowToBeat(row, i) {
  return {
    id: row.id ?? i + 1,
    videoId: row.video_id,
    title: row.title,
    producer: row.producer,
    producerUrl: row.producer_url,
    genre: row.genre ?? "Uncategorized",
    tags: row.tags ?? [],
    tempo: row.tempo ?? "Not tagged",
    license: row.license ?? "Free — terms in description",
    thumb: row.thumb ?? `https://i.ytimg.com/vi/${row.video_id}/hqdefault.jpg`,
    watchUrl: row.watch_url ?? `https://www.youtube.com/watch?v=${row.video_id}`,
    downloadUrl: row.download_url ?? null,
  };
}

export async function fetchCatalog() {
  if (supabase) {
    const { data, error } = await supabase
      .from("beat_catalog")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    if (!error && data?.length) {
      return { beats: data.map(rowToBeat), source: "supabase" };
    }
    if (error) console.warn("beat_catalog fetch failed, using seed beats:", error.message);
  }
  return { beats: seedBeats, source: "seed" };
}
