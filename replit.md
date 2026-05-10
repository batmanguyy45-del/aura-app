# AURA

A full-featured music streaming and downloading mobile app with an Express backend. Users can discover trending tracks, search any music on YouTube, stream audio with an EQ panel, manage a queue and local library, and switch between 6 visual skin presets.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, proxied at `/api`)
- `pnpm --filter @workspace/mobile run dev` — run the Expo app
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 + pino logging + express-rate-limit
- Mobile: Expo SDK 54, expo-router 6, expo-av
- Audio backend: yt-dlp (stream/download any site)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/mobile/` — Expo React Native app
  - `app/(tabs)/` — 5 tab screens: index (Home), search, player, library, skin
  - `contexts/` — PlayerContext (expo-av), LibraryContext (AsyncStorage), SkinContext (6 presets)
  - `components/` — MiniPlayer, TrackCard, TrackRow
  - `constants/` — types.ts, api.ts (getApiBase), colors.ts (VOID dark theme)
- `artifacts/api-server/src/routes/aura.ts` — all AURA backend routes
- `artifacts/api-server/src/routes/index.ts` — registers /api/aura routes

## Architecture decisions

- **yt-dlp as primary data source**: Piped API instances are unreachable from Replit's network. All search, trending, and streaming goes through yt-dlp with in-memory TTL caching.
- **Stream proxying**: `/api/stream/:videoId` uses yt-dlp to resolve the audio URL then proxies bytes with Range header support for native seeking.
- **Skin system**: 6 presets (VOID/CHROME/EMBER/ARCTIC/MATRIX/COTTON) stored in AsyncStorage via SkinContext. Every color in the player screen derives from `skin.*` tokens.
- **5-tab layout**: Uses ClassicTabs with BlurView background (falls back to Liquid Glass on iOS 26+). MiniPlayer is injected above the tab bar via custom `tabBar` prop.
- **In-memory cache**: trending TTL 10 min, search TTL 5 min, related TTL 10 min — reduces yt-dlp invocations dramatically.

## Product

- **Home**: Trending tracks (via yt-dlp), mood filter chips, recently played, "You Might Like" section
- **Search**: Search any music + filter by Music/Videos/Artists, paste any URL to download
- **Now Playing**: Album art with float animation, progress scrubber, EQ panel (7-band), lyrics panel, queue panel, shuffle/repeat
- **Library**: Downloads tab, Playlists tab, Stats tab (tracked via AsyncStorage)
- **Skin Editor**: Live preview + 4 editor tabs (Presets, Colors, Art, Effects), save custom skins

## User preferences

- VOID skin is the default dark theme: background #080810, primary #B347FF, accent #FF3CAC

## Gotchas

- yt-dlp path: `process.env.YT_DLP_PATH ?? "yt-dlp"` — auto-updates on server start
- Piped API (pipedapi.kavin.rocks) is blocked from Replit's network — use yt-dlp instead
- `Easing.sine` does not exist in react-native-reanimated on web — use `Easing.ease`
- Rate limiter needs `trust proxy` set to avoid X-Forwarded-For validation errors

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
