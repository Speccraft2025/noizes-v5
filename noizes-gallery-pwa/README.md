# Noizes Gallery TV — PWA

An offline viewer for `.nz` objects, built for televisions and large screens.
The browser counterpart to `noizes-gallery-android/`.

A collector adds a `.nz` once; from then on it plays with no network. The
package is unzipped in the browser, its manifest read, and its contents served
to the experience through a service worker — so `experience.html` resolves its
own audio, artwork and lyrics by relative path exactly as it would from disk.

## Stack

Deliberately different from the rest of this repository, which runs SvelteKit
on Netlify against Supabase:

- **Next.js + [vinext](https://github.com/cloudflare/vinext)** on Vite
- **Cloudflare Workers** for hosting, with **D1 + Drizzle** available
- **Service worker** (`public/sw.js`) serving unpacked package contents

## Layout

| Path | What it is |
|---|---|
| `app/page.tsx` | The gallery: unzip, validate, store and open objects |
| `app/chatgpt-auth.ts` | Sign-in helpers for the hosting platform |
| `public/sw.js` | Serves files out of an opened package |
| `public/manifest.webmanifest` | Installability |
| `worker/index.ts` | Cloudflare Worker entry |
| `db/`, `drizzle/` | Schema and migrations (D1) |
| `build/sites-vite-plugin.ts` | Build plugin — **source, not output** |
| `tests/rendered-html.test.mjs` | Rendered-output smoke test |

## Commands

```bash
npm install
npm run dev          # local development
npm run build        # verify the vinext build output
npm test             # build, then check the rendered skeleton
npm run db:generate  # regenerate Drizzle migrations after schema changes
```

Requires Node `>=22.13.0`.

## Notes

`node_modules/`, `dist/`, `.vinext/` and `.wrangler/` are ignored at the
repository root — `node_modules` alone is around 759 MB. Rebuild rather than
commit them. `build/` is **not** ignored: it holds `sites-vite-plugin.ts`,
which the Vite config imports.

`safePath()` in `app/page.tsx` rejects absolute paths and `..` segments before
anything is served out of a package. A `.nz` is an archive from an untrusted
source, so no entry is resolved without that check.

`.openai/hosting.json` declares the hosting project and its optional D1/R2
bindings; `vite.config.ts` simulates those bindings locally. Sign-in helpers in
`app/chatgpt-auth.ts` (`getChatGPTUser`, `requireChatGPTUser`) read
per-request identity headers, so any page using them needs
`export const dynamic = "force-dynamic"`.
