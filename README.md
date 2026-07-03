# APEX CHAOS

Production-ready Vite/React game build.

## Local development

```powershell
pnpm install
pnpm dev
```

Open `http://127.0.0.1:5173/`.

## Production build

```powershell
pnpm build
```

Deploy the generated `dist/` directory. For Netlify, use:

- Build command: `pnpm build`
- Publish directory: `dist`

## Online versus rooms

The Vite development server includes the room relay, so local rooms work through
`pnpm dev`. Production needs a persistent Node host with WebSocket upgrade support:

1. Deploy `server/manual-room-relay.js` (the `pnpm room-server` command starts it).
2. Set `VITE_MANUAL_ROOM_WS_URL` on the frontend deployment to the relay URL, including
   `/__manual-lab-room`, for example `wss://rooms.example.com/__manual-lab-room`.
3. Rebuild the frontend because Vite embeds `VITE_*` variables at build time.

The static frontend route is not the room relay. Leaving the variable empty makes the
client try the same-origin route, which is only available from the local Vite server.
When the production frontend opens, it also sends a non-blocking request to the relay's
`/health` endpoint so a sleeping free instance can begin waking during game loading.

## Project structure

- `src/App.jsx`: React UI and game shell.
- `src/styles.css`: responsive UI styling.
- `public/apexEngine.js`: canonical gameplay runtime.
- `public/assets/`: canonical production assets; all raster images use WebP.
- `tools/generatePublicAssetManifest.cjs`: build-time asset manifest generator.
- `tools/convertAssetsToWebp.py`: verified bulk PNG-to-WebP migration utility.
