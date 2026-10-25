// Generated from the Noizesv5 Supabase schema on 2026-10-24. Do not edit by hand.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      acquisitions: {
        Row: {
          accepting_offers: boolean
          acquired_at: string | null
          asking_price: number | null
          certificate_hash: string | null
          currency: string
          edition_number: number | null
          id: string
          issued_at: string
          issuer_signature: string | null
          listed_at: string | null
          listing_state: string
          owner_id: string
          payment_reference: string | null
          previous_owner_id: string | null
          price_paid: number
          public_custodian_label: string | null
          registry_verified_at: string | null
          release_id: string
          status: string
          transferred_from_acquisition_id: string | null
        }
        Insert: {
          accepting_offers?: boolean
          acquired_at?: string | null
          asking_price?: number | null
          certificate_hash?: string | null
          currency?: string
          edition_number?: number | null
          id?: string
          issued_at?: string
          issuer_signature?: string | null
          listed_at?: string | null
          listing_state?: string
          owner_id: string
          payment_reference?: string | null
          previous_owner_id?: string | null
          price_paid?: number
          public_custodian_label?: string | null
          registry_verified_at?: string | null
          release_id: string
          status?: string
          transferred_from_acquisition_id?: string | null
        }
        Update: {
          accepting_offers?: boolean
          acquired_at?: string | null
          asking_price?: number | null
          certificate_hash?: string | null
          currency?: string
          edition_number?: number | null
          id?: string
          issued_at?: string
          issuer_signature?: string | null
          listed_at?: string | null
          listing_state?: string
          owner_id?: string
          payment_reference?: string | null
          previous_owner_id?: string | null
          price_paid?: number
          public_custodian_label?: string | null
          registry_verified_at?: string | null
          release_id?: string
          status?: string
          transferred_from_acquisition_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "acquisitions_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acquisitions_previous_owner_id_fkey"
            columns: ["previous_owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acquisitions_release_id_fkey"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "releases"
            referencedColumns: ["id"]
          },
        ]
      }
      audio_assets: {
        Row: {
          asset_type: string
          bit_depth: number
          channels: number
          created_at: string
          duration_ms: number
          filename: string | null
          id: string
          mime: string | null
          release_id: string
          role: string
          sample_rate: number
          scope: string
          sha256: string | null
          size_bytes: number
          storage_path: string | null
          technical: Json
          title: string | null
          track_id: string | null
          updated_at: string
          version_id: string | null
        }
        Insert: {
          asset_type?: string
          bit_depth?: number
          channels?: number
          created_at?: string
          duration_ms?: number
          filename?: string | null
          id?: string
          mime?: string | null
          release_id: string
          role: string
          sample_rate?: number
          scope: string
          sha256?: string | null
          size_bytes?: number
          storage_path?: string | null
          technical?: Json
          title?: string | null
          track_id?: string | null
          updated_at?: string
          version_id?: string | null
        }
        Update: {
          asset_type?: string
          bit_depth?: number
          channels?: number
          created_at?: string
          duration_ms?: number
          filename?: string | null
          id?: string
          mime?: string | null
          release_id?: string
          role?: string
          sample_rate?: number
          scope?: string
          sha256?: string | null
          size_bytes?: number
          storage_path?: string | null
          technical?: Json
          title?: string | null
          track_id?: string | null
          updated_at?: string
          version_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audio_assets_release_id_fkey"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "releases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audio_assets_track_fk"
            columns: ["release_id", "track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["release_id", "id"]
          },
          {
            foreignKeyName: "audio_assets_version_track_fk"
            columns: ["release_id", "track_id", "version_id"]
            isOneToOne: false
            referencedRelation: "audio_versions"
            referencedColumns: ["release_id", "track_id", "id"]
          },
        ]
      }
      audio_versions: {
        Row: {
          created_at: string
          id: string
          is_primary: boolean
          notes: string | null
          release_id: string
          role: string
          title: string
          track_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_primary?: boolean
          notes?: string | null
          release_id: string
          role?: string
          title?: string
          track_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_primary?: boolean
          notes?: string | null
          release_id?: string
          role?: string
          title?: string
          track_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audio_versions_track_fk"
            columns: ["release_id", "track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["release_id", "id"]
          },
        ]
      }
      beat_catalog: {
        Row: {
          created_at: string | null
          download_url: string | null
          genre: string | null
          id: string
          is_active: boolean
          license: string | null
          producer: string
          producer_url: string | null
          source: string
          tags: string[]
          tempo: string | null
          thumb: string | null
          title: string
          updated_at: string | null
          video_id: string
          watch_url: string | null
        }
        Insert: {
          created_at?: string | null
          download_url?: string | null
          genre?: string | null
          id?: string
          is_active?: boolean
          license?: string | null
          producer: string
          producer_url?: string | null
          source?: string
          tags?: string[]
          tempo?: string | null
          thumb?: string | null
          title: string
          updated_at?: string | null
          video_id: string
          watch_url?: string | null
        }
        Update: {
          created_at?: string | null
          download_url?: string | null
          genre?: string | null
          id?: string
          is_active?: boolean
          license?: string | null
          producer?: string
          producer_url?: string | null
          source?: string
          tags?: string[]
          tempo?: string | null
          thumb?: string | null
          title?: string
          updated_at?: string | null
          video_id?: string
          watch_url?: string | null
        }
        Relationships: []
      }
      beat_deals: {
        Row: {
          artist_name: string
          artist_signed_at: string
          beat_title: string
          beat_video_id: string
          created_at: string | null
          deal_token: string
          deal_type: string
          decline_reason: string | null
          id: string
          master_split: number
          producer_name: string
          producer_signed_at: string | null
          producer_signed_name: string | null
          producer_url: string | null
          publishing_split: number
          status: string
          updated_at: string | null
          upfront_fee: number
        }
        Insert: {
          artist_name: string
          artist_signed_at?: string
          beat_title: string
          beat_video_id: string
          created_at?: string | null
          deal_token?: string
          deal_type: string
          decline_reason?: string | null
          id?: string
          master_split: number
          producer_name: string
          producer_signed_at?: string | null
          producer_signed_name?: string | null
          producer_url?: string | null
          publishing_split: number
          status?: string
          updated_at?: string | null
          upfront_fee?: number
        }
        Update: {
          artist_name?: string
          artist_signed_at?: string
          beat_title?: string
          beat_video_id?: string
          created_at?: string | null
          deal_token?: string
          deal_type?: string
          decline_reason?: string | null
          id?: string
          master_split?: number
          producer_name?: string
          producer_signed_at?: string | null
          producer_signed_name?: string | null
          producer_url?: string | null
          publishing_split?: number
          status?: string
          updated_at?: string | null
          upfront_fee?: number
        }
        Relationships: []
      }
      collector_notes: {
        Row: {
          acquisition_id: string
          author_id: string
          body: string
          created_at: string | null
          id: string
          status: string
          updated_at: string | null
        }
        Insert: {
          acquisition_id: string
          author_id: string
          body: string
          created_at?: string | null
          id?: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          acquisition_id?: string
          author_id?: string
          body?: string
          created_at?: string | null
          id?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "collector_notes_acquisition_id_fkey"
            columns: ["acquisition_id"]
            isOneToOne: true
            referencedRelation: "acquisitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collector_notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_signing_keys: {
        Row: {
          created_at: string | null
          id: string
          private_key_encrypted: string
          public_key: string
        }
        Insert: {
          created_at?: string | null
          id: string
          private_key_encrypted: string
          public_key: string
        }
        Update: {
          created_at?: string | null
          id?: string
          private_key_encrypted?: string
          public_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_signing_keys_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      drop_analytics: {
        Row: {
          count: number
          day: string
          event: string
          release_id: string
        }
        Insert: {
          count?: number
          day?: string
          event: string
          release_id: string
        }
        Update: {
          count?: number
          day?: string
          event?: string
          release_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "drop_analytics_release_id_fkey"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "releases"
            referencedColumns: ["id"]
          },
        ]
      }
      exchange_analytics: {
        Row: {
          event: string
          event_count: number
          event_day: string
          event_key: string
          release_id: string | null
          updated_at: string
        }
        Insert: {
          event: string
          event_count?: number
          event_day?: string
          event_key: string
          release_id?: string | null
          updated_at?: string
        }
        Update: {
          event?: string
          event_count?: number
          event_day?: string
          event_key?: string
          release_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exchange_analytics_release_id_fkey"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "releases"
            referencedColumns: ["id"]
          },
        ]
      }
      exchange_rotation_impressions: {
        Row: {
          created_at: string
          release_id: string
          visitor_hash: string
          window_id: string
        }
        Insert: {
          created_at?: string
          release_id: string
          visitor_hash: string
          window_id: string
        }
        Update: {
          created_at?: string
          release_id?: string
          visitor_hash?: string
          window_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exchange_rotation_impressions_release_id_fkey"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "releases"
            referencedColumns: ["id"]
          },
        ]
      }
      exchange_rotation_snapshots: {
        Row: {
          catalogue_version: string
          created_at: string
          release_ids: string[]
          updated_at: string
          window_id: string
        }
        Insert: {
          catalogue_version: string
          created_at?: string
          release_ids?: string[]
          updated_at?: string
          window_id: string
        }
        Update: {
          catalogue_version?: string
          created_at?: string
          release_ids?: string[]
          updated_at?: string
          window_id?: string
        }
        Relationships: []
      }
      invites: {
        Row: {
          email: string
          invited_at: string | null
          invited_by: string | null
          role: string
        }
        Insert: {
          email: string
          invited_at?: string | null
          invited_by?: string | null
          role?: string
        }
        Update: {
          email?: string
          invited_at?: string | null
          invited_by?: string | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      kyc_submissions: {
        Row: {
          artist_name: string | null
          country: string
          full_name: string
          id: string
          id_document_path: string | null
          id_number: string
          id_type: string
          music_links: Json
          reject_reason: string | null
          reviewed_at: string | null
          reviewer_id: string | null
          selfie_path: string | null
          social_links: Json
          status: string
          submitted_at: string | null
          user_id: string
          years_active: string | null
        }
        Insert: {
          artist_name?: string | null
          country: string
          full_name: string
          id?: string
          id_document_path?: string | null
          id_number: string
          id_type: string
          music_links?: Json
          reject_reason?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          selfie_path?: string | null
          social_links?: Json
          status?: string
          submitted_at?: string | null
          user_id: string
          years_active?: string | null
        }
        Update: {
          artist_name?: string | null
          country?: string
          full_name?: string
          id?: string
          id_document_path?: string | null
          id_number?: string
          id_type?: string
          music_links?: Json
          reject_reason?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          selfie_path?: string | null
          social_links?: Json
          status?: string
          submitted_at?: string | null
          user_id?: string
          years_active?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kyc_submissions_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kyc_submissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      offers: {
        Row: {
          acquisition_id: string
          amount: number
          created_at: string | null
          currency: string
          id: string
          offerer_id: string
          release_id: string
          status: string
          updated_at: string | null
        }
        Insert: {
          acquisition_id: string
          amount: number
          created_at?: string | null
          currency?: string
          id?: string
          offerer_id: string
          release_id: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          acquisition_id?: string
          amount?: number
          created_at?: string | null
          currency?: string
          id?: string
          offerer_id?: string
          release_id?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "offers_acquisition_id_fkey"
            columns: ["acquisition_id"]
            isOneToOne: false
            referencedRelation: "acquisitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_offerer_id_fkey"
            columns: ["offerer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_release_id_fkey"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "releases"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_intents: {
        Row: {
          acquisition_id: string | null
          amount_subunits: number
          buyer_id: string | null
          created_at: string | null
          currency: string
          id: string
          kind: string
          offer_id: string | null
          paystack_data: Json | null
          reference: string
          release_id: string | null
          seller_id: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          acquisition_id?: string | null
          amount_subunits: number
          buyer_id?: string | null
          created_at?: string | null
          currency: string
          id?: string
          kind?: string
          offer_id?: string | null
          paystack_data?: Json | null
          reference: string
          release_id?: string | null
          seller_id?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          acquisition_id?: string | null
          amount_subunits?: number
          buyer_id?: string | null
          created_at?: string | null
          currency?: string
          id?: string
          kind?: string
          offer_id?: string | null
          paystack_data?: Json | null
          reference?: string
          release_id?: string | null
          seller_id?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_intents_acquisition_id_fkey"
            columns: ["acquisition_id"]
            isOneToOne: false
            referencedRelation: "acquisitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_intents_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_intents_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_intents_release_id_fkey"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "releases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_intents_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          display_name: string | null
          email: string | null
          id: string
          is_admin: boolean | null
          kyc_country: string | null
          kyc_full_name: string | null
          kyc_id_document_path: string | null
          kyc_id_number: string | null
          kyc_id_type: string | null
          kyc_reject_reason: string | null
          kyc_reviewed_at: string | null
          kyc_reviewer_id: string | null
          kyc_selfie_path: string | null
          kyc_status: string
          kyc_submitted_at: string | null
          location: string | null
          password_set: boolean
          role: string
          signing_public_key: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          id: string
          is_admin?: boolean | null
          kyc_country?: string | null
          kyc_full_name?: string | null
          kyc_id_document_path?: string | null
          kyc_id_number?: string | null
          kyc_id_type?: string | null
          kyc_reject_reason?: string | null
          kyc_reviewed_at?: string | null
          kyc_reviewer_id?: string | null
          kyc_selfie_path?: string | null
          kyc_status?: string
          kyc_submitted_at?: string | null
          location?: string | null
          password_set?: boolean
          role?: string
          signing_public_key?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          id?: string
          is_admin?: boolean | null
          kyc_country?: string | null
          kyc_full_name?: string | null
          kyc_id_document_path?: string | null
          kyc_id_number?: string | null
          kyc_id_type?: string | null
          kyc_reject_reason?: string | null
          kyc_reviewed_at?: string | null
          kyc_reviewer_id?: string | null
          kyc_selfie_path?: string | null
          kyc_status?: string
          kyc_submitted_at?: string | null
          location?: string | null
          password_set?: boolean
          role?: string
          signing_public_key?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_kyc_reviewer_id_fkey"
            columns: ["kyc_reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      provenance_events: {
        Row: {
          acquisition_id: string | null
          content_hash: string
          currency: string | null
          edition_number: number | null
          event_id: string | null
          from_owner_id: string | null
          id: string
          kind: string
          note: string | null
          occurred_at: string
          prev_hash: string | null
          price: number | null
          recorded_at: string
          release_id: string
          seq: number
          signature: string
          signer_public_key: string
          supersedes_event_id: string | null
          to_owner_id: string | null
        }
        Insert: {
          acquisition_id?: string | null
          content_hash: string
          currency?: string | null
          edition_number?: number | null
          event_id?: string | null
          from_owner_id?: string | null
          id?: string
          kind: string
          note?: string | null
          occurred_at?: string
          prev_hash?: string | null
          price?: number | null
          recorded_at?: string
          release_id: string
          seq: number
          signature: string
          signer_public_key: string
          supersedes_event_id?: string | null
          to_owner_id?: string | null
        }
        Update: {
          acquisition_id?: string | null
          content_hash?: string
          currency?: string | null
          edition_number?: number | null
          event_id?: string | null
          from_owner_id?: string | null
          id?: string
          kind?: string
          note?: string | null
          occurred_at?: string
          prev_hash?: string | null
          price?: number | null
          recorded_at?: string
          release_id?: string
          seq?: number
          signature?: string
          signer_public_key?: string
          supersedes_event_id?: string | null
          to_owner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "provenance_events_acquisition_id_fkey"
            columns: ["acquisition_id"]
            isOneToOne: false
            referencedRelation: "acquisitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provenance_events_from_owner_id_fkey"
            columns: ["from_owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provenance_events_release_id_fkey"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "releases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provenance_events_supersedes_event_id_fkey"
            columns: ["supersedes_event_id"]
            isOneToOne: false
            referencedRelation: "provenance_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provenance_events_to_owner_id_fkey"
            columns: ["to_owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      registry_signing_key: {
        Row: {
          created_at: string | null
          id: number
          private_key_encrypted: string
          public_key: string
        }
        Insert: {
          created_at?: string | null
          id?: number
          private_key_encrypted: string
          public_key: string
        }
        Update: {
          created_at?: string | null
          id?: number
          private_key_encrypted?: string
          public_key?: string
        }
        Relationships: []
      }
      release_appreciations: {
        Row: {
          appreciated: boolean
          created_at: string
          release_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          appreciated?: boolean
          created_at?: string
          release_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          appreciated?: boolean
          created_at?: string
          release_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "release_appreciations_release_id_fkey"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "releases"
            referencedColumns: ["id"]
          },
        ]
      }
      release_authenticity: {
        Row: {
          certificate: Json
          content_hash: string
          created_at: string | null
          id: string
          method: string
          package_id: string
          release_id: string
          signature: string | null
          signature_type: string
          signer_public_key: string | null
          verification_status: string
          verified_at: string | null
        }
        Insert: {
          certificate?: Json
          content_hash: string
          created_at?: string | null
          id?: string
          method?: string
          package_id: string
          release_id: string
          signature?: string | null
          signature_type?: string
          signer_public_key?: string | null
          verification_status?: string
          verified_at?: string | null
        }
        Update: {
          certificate?: Json
          content_hash?: string
          created_at?: string | null
          id?: string
          method?: string
          package_id?: string
          release_id?: string
          signature?: string | null
          signature_type?: string
          signer_public_key?: string | null
          verification_status?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "release_authenticity_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: true
            referencedRelation: "release_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "release_authenticity_release_id_fkey"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "releases"
            referencedColumns: ["id"]
          },
        ]
      }
      release_links: {
        Row: {
          created_at: string | null
          enabled: boolean
          id: string
          label: string
          link_type: string
          position: number
          release_id: string
          url: string
        }
        Insert: {
          created_at?: string | null
          enabled?: boolean
          id?: string
          label: string
          link_type?: string
          position?: number
          release_id: string
          url: string
        }
        Update: {
          created_at?: string | null
          enabled?: boolean
          id?: string
          label?: string
          link_type?: string
          position?: number
          release_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "release_links_release_id_fkey"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "releases"
            referencedColumns: ["id"]
          },
        ]
      }
      release_packages: {
        Row: {
          created_at: string | null
          experience_entry: string
          experience_summary: Json
          file_size: number
          filename: string | null
          id: string
          manifest_hash: string | null
          manifest_json: Json
          package_hash: string | null
          package_version: string | null
          release_id: string
          storage_path: string
          validated_at: string | null
          validation_status: string
          version: number
        }
        Insert: {
          created_at?: string | null
          experience_entry?: string
          experience_summary?: Json
          file_size?: number
          filename?: string | null
          id?: string
          manifest_hash?: string | null
          manifest_json?: Json
          package_hash?: string | null
          package_version?: string | null
          release_id: string
          storage_path: string
          validated_at?: string | null
          validation_status?: string
          version?: number
        }
        Update: {
          created_at?: string | null
          experience_entry?: string
          experience_summary?: Json
          file_size?: number
          filename?: string | null
          id?: string
          manifest_hash?: string | null
          manifest_json?: Json
          package_hash?: string | null
          package_version?: string | null
          release_id?: string
          storage_path?: string
          validated_at?: string | null
          validation_status?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "release_packages_release_id_fkey"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "releases"
            referencedColumns: ["id"]
          },
        ]
      }
      release_slugs: {
        Row: {
          artist_slug: string
          created_at: string | null
          is_canonical: boolean
          release_id: string
          slug: string
        }
        Insert: {
          artist_slug: string
          created_at?: string | null
          is_canonical?: boolean
          release_id: string
          slug: string
        }
        Update: {
          artist_slug?: string
          created_at?: string | null
          is_canonical?: boolean
          release_id?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "release_slugs_release_id_fkey"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "releases"
            referencedColumns: ["id"]
          },
        ]
      }
      releases: {
        Row: {
          acquired_count: number
          allow_public_download: boolean
          artist_id: string | null
          artist_name: string
          artist_slug: string | null
          audio_path: string | null
          catalogue_number: string | null
          compilation_artists: string[]
          compiler: string | null
          corrected_at: string | null
          cover_path: string | null
          created_at: string | null
          curator: string | null
          currency: string
          description: string | null
          disc_count: number
          drop_description: string | null
          edition_declaration_hash: string | null
          edition_name: string | null
          edition_signature: string | null
          edition_size: number | null
          edition_type: string
          event_name: string | null
          experience_entry: string
          explicit: boolean
          featured_artists: string[]
          genre: string | null
          genres: string[]
          id: string
          issuance_open: boolean
          issuer_public_key: string | null
          label: string | null
          location: string | null
          nz_path: string | null
          offers_enabled: boolean
          package_id: string | null
          package_size: number
          price: number
          published_at: string | null
          recording_date: string | null
          release_date: string | null
          release_metadata: Json
          release_type: string
          resale_artist_bps: number
          resale_enabled: boolean
          rights_summary: string | null
          slug: string | null
          status: string
          territory: string | null
          title: string
          total_duration_ms: number
          track_count: number
          transferable: boolean
          upc: string | null
          updated_at: string | null
          venue: string | null
          visibility: string
          votes: number
          withdrawn_at: string | null
          year: string | null
        }
        Insert: {
          acquired_count?: number
          allow_public_download?: boolean
          artist_id?: string | null
          artist_name: string
          artist_slug?: string | null
          audio_path?: string | null
          catalogue_number?: string | null
          compilation_artists?: string[]
          compiler?: string | null
          corrected_at?: string | null
          cover_path?: string | null
          created_at?: string | null
          curator?: string | null
          currency?: string
          description?: string | null
          disc_count?: number
          drop_description?: string | null
          edition_declaration_hash?: string | null
          edition_name?: string | null
          edition_signature?: string | null
          edition_size?: number | null
          edition_type?: string
          event_name?: string | null
          experience_entry?: string
          explicit?: boolean
          featured_artists?: string[]
          genre?: string | null
          genres?: string[]
          id?: string
          issuance_open?: boolean
          issuer_public_key?: string | null
          label?: string | null
          location?: string | null
          nz_path?: string | null
          offers_enabled?: boolean
          package_id?: string | null
          package_size?: number
          price?: number
          published_at?: string | null
          recording_date?: string | null
          release_date?: string | null
          release_metadata?: Json
          release_type?: string
          resale_artist_bps?: number
          resale_enabled?: boolean
          rights_summary?: string | null
          slug?: string | null
          status?: string
          territory?: string | null
          title: string
          total_duration_ms?: number
          track_count?: number
          transferable?: boolean
          upc?: string | null
          updated_at?: string | null
          venue?: string | null
          visibility?: string
          votes?: number
          withdrawn_at?: string | null
          year?: string | null
        }
        Update: {
          acquired_count?: number
          allow_public_download?: boolean
          artist_id?: string | null
          artist_name?: string
          artist_slug?: string | null
          audio_path?: string | null
          catalogue_number?: string | null
          compilation_artists?: string[]
          compiler?: string | null
          corrected_at?: string | null
          cover_path?: string | null
          created_at?: string | null
          curator?: string | null
          currency?: string
          description?: string | null
          disc_count?: number
          drop_description?: string | null
          edition_declaration_hash?: string | null
          edition_name?: string | null
          edition_signature?: string | null
          edition_size?: number | null
          edition_type?: string
          event_name?: string | null
          experience_entry?: string
          explicit?: boolean
          featured_artists?: string[]
          genre?: string | null
          genres?: string[]
          id?: string
          issuance_open?: boolean
          issuer_public_key?: string | null
          label?: string | null
          location?: string | null
          nz_path?: string | null
          offers_enabled?: boolean
          package_id?: string | null
          package_size?: number
          price?: number
          published_at?: string | null
          recording_date?: string | null
          release_date?: string | null
          release_metadata?: Json
          release_type?: string
          resale_artist_bps?: number
          resale_enabled?: boolean
          rights_summary?: string | null
          slug?: string | null
          status?: string
          territory?: string | null
          title?: string
          total_duration_ms?: number
          track_count?: number
          transferable?: boolean
          upc?: string | null
          updated_at?: string | null
          venue?: string | null
          visibility?: string
          votes?: number
          withdrawn_at?: string | null
          year?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "releases_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      schema_migrations: {
        Row: {
          applied_at: string
          filename: string
        }
        Insert: {
          applied_at?: string
          filename: string
        }
        Update: {
          applied_at?: string
          filename?: string
        }
        Relationships: []
      }
      tracks: {
        Row: {
          appears_in_archive: boolean
          appears_in_journey: boolean
          artwork_ref: string | null
          bonus: boolean
          created_at: string
          credits: Json
          credits_ref: string | null
          description: string | null
          disc_number: number
          explicit: boolean
          featured_artists: string[]
          hidden: boolean
          id: string
          inherit_release_artist: boolean
          inherit_release_credits: boolean
          inherit_release_rights: boolean
          isrc: string | null
          lyrics: Json
          lyrics_ref: string | null
          position: number
          primary_artist: string
          primary_audio_asset_id: string | null
          primary_version_id: string | null
          producers: string[]
          recording_date: string | null
          recording_location: string | null
          release_date: string | null
          release_id: string
          rights: Json
          rights_ref: string | null
          source_release: string | null
          subtitle: string | null
          title: string
          track_metadata: Json
          track_number: number
          updated_at: string
          writers: string[]
        }
        Insert: {
          appears_in_archive?: boolean
          appears_in_journey?: boolean
          artwork_ref?: string | null
          bonus?: boolean
          created_at?: string
          credits?: Json
          credits_ref?: string | null
          description?: string | null
          disc_number?: number
          explicit?: boolean
          featured_artists?: string[]
          hidden?: boolean
          id?: string
          inherit_release_artist?: boolean
          inherit_release_credits?: boolean
          inherit_release_rights?: boolean
          isrc?: string | null
          lyrics?: Json
          lyrics_ref?: string | null
          position?: number
          primary_artist?: string
          primary_audio_asset_id?: string | null
          primary_version_id?: string | null
          producers?: string[]
          recording_date?: string | null
          recording_location?: string | null
          release_date?: string | null
          release_id: string
          rights?: Json
          rights_ref?: string | null
          source_release?: string | null
          subtitle?: string | null
          title?: string
          track_metadata?: Json
          track_number?: number
          updated_at?: string
          writers?: string[]
        }
        Update: {
          appears_in_archive?: boolean
          appears_in_journey?: boolean
          artwork_ref?: string | null
          bonus?: boolean
          created_at?: string
          credits?: Json
          credits_ref?: string | null
          description?: string | null
          disc_number?: number
          explicit?: boolean
          featured_artists?: string[]
          hidden?: boolean
          id?: string
          inherit_release_artist?: boolean
          inherit_release_credits?: boolean
          inherit_release_rights?: boolean
          isrc?: string | null
          lyrics?: Json
          lyrics_ref?: string | null
          position?: number
          primary_artist?: string
          primary_audio_asset_id?: string | null
          primary_version_id?: string | null
          producers?: string[]
          recording_date?: string | null
          recording_location?: string | null
          release_date?: string | null
          release_id?: string
          rights?: Json
          rights_ref?: string | null
          source_release?: string | null
          subtitle?: string | null
          title?: string
          track_metadata?: Json
          track_number?: number
          updated_at?: string
          writers?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "tracks_release_id_fkey"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "releases"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist: {
        Row: {
          created_at: string | null
          email: string
          id: string
          role: string | null
          source: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          role?: string | null
          source?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          role?: string | null
          source?: string | null
        }
        Relationships: []
      }
      waitlist_entries: {
        Row: {
          created_at: string
          email: string
          id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_copy_offer: {
        Args: { p_offer_id: string; p_seller_id: string }
        Returns: {
          acquisition_id: string
          amount: number
          created_at: string | null
          currency: string
          id: string
          offerer_id: string
          release_id: string
          status: string
          updated_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "offers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      bu_countersign_deal: {
        Args: { p_producer_name: string; p_token: string }
        Returns: Json
      }
      bu_create_deal: {
        Args: {
          p_artist_name: string
          p_beat_title: string
          p_beat_video_id: string
          p_deal_type: string
          p_master_split: number
          p_producer_name: string
          p_producer_url: string
          p_publishing_split: number
          p_upfront_fee: number
        }
        Returns: Json
      }
      bu_deal_to_json: {
        Args: { d: Database["public"]["Tables"]["beat_deals"]["Row"] }
        Returns: Json
      }
      bu_decline_deal: {
        Args: { p_reason?: string; p_token: string }
        Returns: Json
      }
      bu_get_deal: { Args: { p_token: string }; Returns: Json }
      bump_drop_analytics: {
        Args: { p_event: string; p_release_id: string }
        Returns: undefined
      }
      exchange_appreciation_counts: {
        Args: { p_release_ids: string[] }
        Returns: {
          appreciation_count: number
          release_id: string
        }[]
      }
      exchange_recent_impression_counts: {
        Args: { p_before: string; p_since: string }
        Returns: {
          impression_count: number
          release_id: string
        }[]
      }
      record_exchange_analytics: { Args: { p_events: Json }; Returns: number }
      record_exchange_impressions: {
        Args: {
          p_release_ids: string[]
          p_visitor_hash: string
          p_window_id: string
        }
        Returns: number
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
