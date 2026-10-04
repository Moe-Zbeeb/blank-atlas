# Blank Atlas

Play it: https://moe-zbeeb.github.io/blank-atlas/

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

## Deploy

`dist/` is plain static files, so any static host works.

Netlify: drag the `dist` folder onto https://app.netlify.com/drop, or

```bash
npx netlify-cli deploy --dir dist --prod
```

Vercel:

```bash
npx vercel deploy dist --prod
```

Cloudflare Pages:

```bash
npx wrangler pages deploy dist
```

GitHub Pages (how the live site is published): push the contents of `dist/` to the `gh-pages` branch.

```bash
npm run build
cd dist && git init -q -b gh-pages && git add -A && git commit -qm "Deploy" && git push -f https://github.com/Moe-Zbeeb/blank-atlas.git gh-pages
```

The site works from a sub-path (all asset URLs are relative). Serve it over HTTPS so the offline cache and "Add to Home Screen" work.
