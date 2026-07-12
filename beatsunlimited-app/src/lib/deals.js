import { supabase } from "./supabase.js";

// Deal persistence. Primary path is the token-scoped Supabase RPCs
// (bu_create_deal / bu_get_deal / bu_countersign_deal / bu_decline_deal).
// If Supabase is unconfigured or the schema hasn't been applied yet, deals
// fall back to localStorage so the full flow stays testable end-to-end —
// `local: true` on the returned deal marks that mode for the UI.

const LS_KEY = "bu_local_deals";

function readLocal() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; } catch { return {}; }
}

function writeLocal(deals) {
  localStorage.setItem(LS_KEY, JSON.stringify(deals));
}

function randomToken() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function localCreate(payload) {
  const deals = readLocal();
  const deal = {
    ...payload,
    id: crypto.randomUUID(),
    deal_token: randomToken(),
    artist_signed_at: new Date().toISOString(),
    producer_signed_name: null,
    producer_signed_at: null,
    decline_reason: null,
    status: "proposed",
    created_at: new Date().toISOString(),
    local: true,
  };
  deals[deal.deal_token] = deal;
  writeLocal(deals);
  return deal;
}

export async function createDeal({ beat, deal, artistName }) {
  const payload = {
    beat_video_id: beat.videoId,
    beat_title: beat.title,
    producer_name: beat.producer,
    producer_url: beat.producerUrl ?? null,
    deal_type: deal.type,
    master_split: deal.master,
    publishing_split: deal.pub,
    upfront_fee: deal.upfront,
    artist_name: artistName.trim(),
  };

  if (supabase) {
    const { data, error } = await supabase.rpc("bu_create_deal", {
      p_beat_video_id: payload.beat_video_id,
      p_beat_title: payload.beat_title,
      p_producer_name: payload.producer_name,
      p_producer_url: payload.producer_url,
      p_deal_type: payload.deal_type,
      p_master_split: payload.master_split,
      p_publishing_split: payload.publishing_split,
      p_upfront_fee: payload.upfront_fee,
      p_artist_name: payload.artist_name,
    });
    if (!error && data) return data;
    console.warn("bu_create_deal failed, falling back to local deal:", error?.message);
  }
  return localCreate(payload);
}

export async function getDeal(token) {
  if (supabase) {
    const { data, error } = await supabase.rpc("bu_get_deal", { p_token: token });
    if (!error && data) return data;
  }
  return readLocal()[token] ?? null;
}

export async function countersignDeal(token, producerName) {
  if (supabase) {
    const { data, error } = await supabase.rpc("bu_countersign_deal", {
      p_token: token,
      p_producer_name: producerName.trim(),
    });
    if (!error && data) return data;
    if (error && !readLocal()[token]) throw new Error(error.message);
  }
  const deals = readLocal();
  const deal = deals[token];
  if (!deal) throw new Error("Deal not found");
  if (deal.status !== "proposed") throw new Error("Deal already resolved");
  deal.status = "countersigned";
  deal.producer_signed_name = producerName.trim();
  deal.producer_signed_at = new Date().toISOString();
  writeLocal(deals);
  return deal;
}

export async function declineDeal(token, reason) {
  if (supabase) {
    const { data, error } = await supabase.rpc("bu_decline_deal", {
      p_token: token,
      p_reason: reason ?? null,
    });
    if (!error && data) return data;
    if (error && !readLocal()[token]) throw new Error(error.message);
  }
  const deals = readLocal();
  const deal = deals[token];
  if (!deal) throw new Error("Deal not found");
  if (deal.status !== "proposed") throw new Error("Deal already resolved");
  deal.status = "declined";
  deal.decline_reason = reason || null;
  writeLocal(deals);
  return deal;
}

export function countersignUrl(deal) {
  return `${window.location.origin}${window.location.pathname}#/deal/${deal.deal_token}`;
}
