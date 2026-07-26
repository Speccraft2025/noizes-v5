-- Security hardening (2026-07-19) — run once in Supabase SQL editor.
-- 1. Acquisitions are paid objects: all legitimate writes go through the
--    service role (Paystack fulfillment). Close the client-side write door.
drop policy if exists "Authenticated users can acquire" on public.acquisitions;
drop policy if exists "Owners can update own acquisitions" on public.acquisitions;

-- 2. Pin profiles.role: it gates /studio and is assigned from the invite —
--    never self-escalatable from the client.
create or replace function public.protect_privileged_profile_columns()
returns trigger as $$
begin
  if coalesce(auth.role(), 'service_role') <> 'service_role' then
    new.is_admin := old.is_admin;
    -- role gates /studio access and is assigned from the invite at signup —
    -- never self-escalatable from the client.
    new.role := old.role;
    new.kyc_status := old.kyc_status;
    new.kyc_reviewed_at := old.kyc_reviewed_at;
    new.kyc_reviewer_id := old.kyc_reviewer_id;
    new.kyc_reject_reason := old.kyc_reject_reason;
    new.signing_public_key := old.signing_public_key;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;
