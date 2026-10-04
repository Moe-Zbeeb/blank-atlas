# Blank Atlas

Current site: https://moe-zbeeb.github.io/blank-atlas/ (Cloudflare migration pending).

Learn every country on the world map by clicking it. Static web app: no server, no sign-in, progress lives in the browser.

## Build

```bash
npm install
npm run build
```

`npm run build` writes:

- `dist/` — the deployable site: `index.html`, `vendor/` (d3, topojson-client), `sw.js` (offline cache), `manifest.webmanifest`, `icon.svg`
- `index.html` — the single-file version published as the Claude artifact

`npm run data` regenerates `data.json` (country shapes and facts) from Natural Earth via `world-atlas` and `world-countries`. Only needed when changing the country list or regions.

## Preview

```bash
npm run preview
```

Opens the built site at http://localhost:4173.

## Deploy to Cloudflare Pages

The game uses only static assets. Cloudflare Pages serves these for free with unlimited requests and provides an HTTPS `pages.dev` address. No database or paid Workers plan is required for independent players.

Authenticate once and check for an existing project:

```bash
npx wrangler login --scopes account:read user:read pages:write
npx wrangler pages project list
```

If `blank-atlas` does not exist in the selected account, create it:

```bash
npx wrangler pages project create blank-atlas --production-branch main
```

Publish the latest build:

```bash
npm run deploy:cloudflare
```

`wrangler.json` selects the `blank-atlas` project and `dist/` output. The deployment command targets the production branch, `main`, and prints the live URL. Set `CLOUDFLARE_ACCOUNT_ID` when deploying from an account with multiple memberships. Keep credentials outside Git.

This setup uses Direct Upload. Pushing Git commits does not publish the site; run the deployment command after changes. Cloudflare also supports Git-integrated Pages projects, which must be selected when creating the project.

Multiple visitors can play simultaneously and independently. Progress and scores are stored separately in each browser. Team mode is for two teams sharing one device; online matches and synchronized progress need a backend.

Progress from the old GitHub Pages address stays in that browser's storage for that address and does not automatically transfer to Cloudflare.

Keep the old site available until the new deployment has been verified. The site works from a sub-path (all asset URLs are relative). Serve it over HTTPS so the offline cache and "Add to Home Screen" work.
