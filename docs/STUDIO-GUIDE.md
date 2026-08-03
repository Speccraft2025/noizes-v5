# Making a Noizes Package

### A step-by-step guide to Noizes Studio

---

## What you are actually making

A `.nz` is not an upload. It is a **finished object**: one file that contains the
music, the artwork, the words, the credits, the rights record and the experience
that plays it — with a cryptographic fingerprint of every piece inside it.

When a collector opens it, nothing is fetched. No server, no account, no
connection. The object plays because everything it needs is already in it.

That is why Studio asks for more than a file and a title. Every field you fill in
becomes part of a record that outlives the platform.

> **Before you start, have these ready:** your master audio, your cover image at
> 3000 × 3000 or larger, your lyrics as plain text, and the real names and roles
> of everyone who worked on it.

---

## The shape of the work

Studio has **eight steps**. You can move backwards and forwards freely — nothing
is locked until you publish.

| # | Step | What it settles |
|---|------|-----------------|
| 1 | **Identity** | What this release is and who made it |
| 2 | **Tracklist** | The works, in order, with their own credits |
| 3 | **Assets** | The actual audio and images |
| 4 | **Lyrics** | The words, timed if you want them to move |
| 5 | **Extras** | Statement, links, interactive additions |
| 6 | **Experience** | How the object behaves when opened |
| 7 | **Edition** | How many exist and what they cost |
| 8 | **Publish** | Compile, verify, release |

**Your work saves itself.** Studio keeps a draft as you go and shows a **Saved**
marker. Close the tab and come back; you will land on the same step with your
files still attached. Drafts belong to your signed-in account, so sign in first.

---

## Step 1 · Identity

This is the object's birth certificate. Three fields carry an asterisk because
nothing compiles without them.

**Required**

- **Release type** — single, EP, album, mix, compilation, live
- **Release title**
- **Primary artist** — the band or artist name as it should be remembered
- **Year**

**Worth filling in**

- Featured artists, label, release date, genres
- For compilations: curator and compiler
- For live recordings: event name, venue, recording date

> **Get the artist name right now.** It threads through the manifest, the credits
> and the provenance record. Changing it later means recompiling.

---

## Step 2 · Tracklist

Add one entry per musical work, in playing order.

For each track you can set a title, a subtitle for a movement or mix, performer
and writer lists, a description for recording context, and credits for
performance, arrangement, engineering and mastering.

**If this is a single, you still make a tracklist — one track.** The structure is
the same either way, which is why an album is no harder than a single.

> Track order here is the order a collector hears. Set it deliberately.

---

## Step 3 · Assets

Where the actual files go. This step has two halves.

### Release-level

- **Main cover** — *required*. Any image format. This is the face of the object;
  supply the largest version you have.
- **Continuous master** — optional. One unbroken mix or concert recording that
  plays across the whole release.
- Additional artwork and images.

### Track-level

For every track in your tracklist:

- **Primary master** — *required*. WAV, FLAC, MP3 or M4A. **Upload the best
  quality you have.** A `.nz` is meant to be the definitive copy, not a preview.
- Track artwork, alternate versions, and supporting documents.

> **Watch the size counter.** Studio estimates the finished package as you add
> files. Lossless masters across a long album produce a large object. That is a
> legitimate choice — just make it knowingly.

---

## Step 4 · Lyrics

Paste lyrics one line per line. Studio can also transcribe audio for you.

You can add **translations** in any number of languages and **transliterations**
for scripts a reader may not know — give each a language code such as `sw` or
`en`.

**Timed lyrics** let the words move with the music. Untimed lyrics still ship and
still display; they simply sit still.

> Lyrics are stored as real text, not pictures of text. Screen readers get the
> poem. Search finds it. It survives.

---

## Step 5 · Extras

What surrounds the music.

- **Artist statement** — what lives behind this work
- **Links** — merch, tickets, your site
- **Notes** — a wall collectors can leave marks on
- **Play** — optional interactive additions

Everything here is optional. A release with none of it is still complete.

---

## Step 6 · Experience

How the object behaves when someone opens it.

Today this is the **guided journey**: the order a collector moves through arrival,
the object itself, listening, lyrics, your statement, notes and the collector
record. You can reorder those, rename them, or let collectors explore freely
instead.

The default order is built from what your package actually contains — if you
added no lyrics, no lyrics step appears.

---

## Step 7 · Edition

What makes a `.nz` collectible rather than merely downloadable.

**All three are required.**

- **Edition name** — for example *Inaugural Pressing*
- **Fixed supply** — a positive whole number. This is the promise. It is recorded
  in the object and cannot quietly change afterwards.
- **Price** and currency

Optionally describe what makes this pressing meaningful.

> **Supply is a commitment, not a setting.** Choose a number you are willing to
> honour permanently.

---

## Step 8 · Publish

Three things happen here, in order.

### 1. Verification

Studio checks the release before it will compile anything. **Export stays
disabled until every error clears.** Common blockers:

| Message | Fix |
|---|---|
| Edition name is required | Step 7 |
| Price must be greater than zero | Step 7 |
| Fixed supply must be a positive whole number | Step 7 |
| Track artwork must reference an asset owned by the same track | Step 3 |
| Track IDs must be unique | Step 2 |
| An edition must apply to the complete release | Step 7 |

Warnings are advice, not blockers. Read them anyway.

### 2. Preview

Compile without publishing and open the object exactly as a collector will.

**Do this every time.** It is the only place you see the finished experience
rather than the form you filled in. Check that the cover looks right, that the
first track plays, that lyrics land where you expect, and that your statement
reads well.

### 3. Compile and release

Studio builds the package in your browser: hashes every component, writes the
manifest, credits, rights, provenance and authenticity records, and zips it.

If a compile fails, **your draft is untouched.** Fix the reported item and
compile again.

Publishing then uploads the finished object directly to storage. Large files
never pass through the Noizes server, so a long album is no more fragile than a
single.

---

## Before you publish — a last pass

- [ ] Artist name spelled exactly as it should be remembered
- [ ] Every track has a primary master at your best quality
- [ ] Cover is the largest version you have
- [ ] Everyone who worked on it is credited by real name and role
- [ ] Edition size is a number you will honour permanently
- [ ] You have **previewed** the object and played it
- [ ] Rights are yours to grant

---

## Things worth knowing

**Credits stay private where they should be.** Collaborator names and roles go
into the public record. Their email addresses and invitation status never leave
your private draft.

**The object is self-contained.** Once compiled, a `.nz` needs nothing from
Noizes. If this company disappeared tomorrow, every object already pressed would
still open and still play. That is the point.

**Nothing is destructive until you publish.** Failed compiles, failed previews
and abandoned sessions all leave your draft exactly as it was.

---

## If something goes wrong

| Problem | What to do |
|---|---|
| Export button is greyed out | Read the error list above it — one item is unresolved |
| Compile fails partway | Note the reported asset, replace it, compile again |
| Draft did not restore | Confirm you are signed in to the same account |
| Package is very large | Expected with lossless masters; check the size estimate in Assets |
| Preview looks wrong | Fix it now — preview is the truth, the form is not |

---

*Noizes Studio · this guide reflects the Studio as it currently ships.*
