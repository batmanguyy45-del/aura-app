import { Router } from "express";
import { spawn } from "child_process";
import { Readable } from "stream";
import rateLimit from "express-rate-limit";
import type { Request, Response } from "express";

const router = Router();

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(limiter);

const ytdlp = process.env.YT_DLP_PATH ?? "yt-dlp";

// Simple in-memory TTL cache
const cache = new Map<string, { data: unknown; exp: number }>();
function getCache<T>(key: string): T | undefined {
  const entry = cache.get(key);
  if (!entry || entry.exp < Date.now()) {
    cache.delete(key);
    return undefined;
  }
  return entry.data as T;
}
function setCache(key: string, data: unknown, ttlMs = 5 * 60 * 1000) {
  cache.set(key, { data, exp: Date.now() + ttlMs });
}

// Run yt-dlp, return stdout as string
function ytdlpRun(args: string[], timeoutMs = 30_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ytdlp, args, { timeout: timeoutMs });
    let out = "";
    let err = "";
    proc.stdout.on("data", (d: Buffer) => { out += d.toString(); });
    proc.stderr.on("data", (d: Buffer) => { err += d.toString(); });
    proc.on("close", (code) => {
      if (code === 0) resolve(out);
      else reject(new Error(err.split("\n").slice(-3).join(" ") || `exit ${code}`));
    });
    proc.on("error", reject);
  });
}

// Parse flat-playlist JSON lines into track array
function parseFlatLines(jsonLines: string) {
  return jsonLines
    .split("\n")
    .filter(Boolean)
    .map(line => {
      try {
        const d = JSON.parse(line) as Record<string, unknown>;
        const thumb = (Array.isArray(d.thumbnails) && d.thumbnails.length > 0)
          ? String((d.thumbnails as Record<string, unknown>[])[0].url ?? "")
          : `https://i.ytimg.com/vi/${d.id}/hqdefault.jpg`;
        return {
          id: String(d.id ?? ""),
          title: String(d.title ?? ""),
          artist: String(d.uploader ?? d.channel ?? ""),
          duration: Number(d.duration ?? 0),
          thumbnail: thumb,
          views: Number(d.view_count ?? 0),
          type: "track",
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

// Auto-update yt-dlp on startup (non-blocking)
try { spawn(ytdlp, ["-U"], { stdio: "ignore" }); } catch {}

// ── Routes ──────────────────────────────────────────────────────────────────

// GET /trending
router.get("/trending", async (req: Request, res: Response) => {
  const cached = getCache<unknown[]>("trending");
  if (cached) return void res.json(cached);
  try {
    const out = await ytdlpRun([
      "ytsearch20:trending music 2026",
      "--dump-json",
      "--flat-playlist",
      "--no-playlist",
      "--no-warnings",
    ], 40_000);
    const tracks = parseFlatLines(out);
    setCache("trending", tracks, 10 * 60 * 1000);
    res.json(tracks);
  } catch (err) {
    req.log.error({ err }, "trending error");
    res.status(500).json({ error: "Failed to fetch trending" });
  }
});

// GET /search?q=&filter=
router.get("/search", async (req: Request, res: Response) => {
  const { q, filter = "all" } = req.query;
  if (!q) return void res.status(400).json({ error: "q is required" });
  const key = `search:${q}:${filter}`;
  const cached = getCache<unknown[]>(key);
  if (cached) return void res.json(cached);
  try {
    const filterSuffix =
      filter === "music" ? " music" : filter === "videos" ? "" : " music";
    const searchQuery = `ytsearch20:${String(q)}${filterSuffix}`;
    const out = await ytdlpRun([
      searchQuery,
      "--dump-json",
      "--flat-playlist",
      "--no-playlist",
      "--no-warnings",
    ], 40_000);
    const tracks = parseFlatLines(out);
    setCache(key, tracks, 5 * 60 * 1000);
    res.json(tracks);
  } catch (err) {
    req.log.error({ err }, "search error");
    res.status(500).json({ error: "Search failed" });
  }
});

// GET /stream/:videoId — redirect client directly to audio URL
router.get("/stream/:videoId", async (req: Request, res: Response) => {
  const { videoId } = req.params;
  const PIPED_INSTANCES = [
    process.env.PIPED_API,
    "https://pipedapi.kavin.rocks",
    "https://piped-api.privacy.com.de",
    "https://api.piped.yt",
    "https://pipedapi.tokhmi.xyz",
  ].filter(Boolean) as string[];

  for (const instance of PIPED_INSTANCES) {
    try {
      const resp = await fetch(`${instance}/streams/${videoId}`, {
        signal: AbortSignal.timeout(8_000),
        headers: { "User-Agent": "Mozilla/5.0" },
      });
      if (resp.ok) {
        const data = await resp.json() as {
          audioStreams: Array<{ url: string; mimeType: string; bitrate: number }>;
        };
        const best = (data.audioStreams ?? []).sort((a, b) => b.bitrate - a.bitrate)[0];
        if (best?.url) {
          res.setHeader("Access-Control-Allow-Origin", "*");
          return res.redirect(302, best.url);
        }
      }
    } catch {}
  }

  try {
    const urlOut = await ytdlpRun([
      "-g", "-f", "bestaudio/best",
      "--extractor-args", "youtube:player_client=android,web",
      "--no-playlist", "--no-warnings",
      `https://www.youtube.com/watch?v=${videoId}`,
    ], 20_000);
    const url = urlOut.trim().split("\n")[0];
    if (url) {
      res.setHeader("Access-Control-Allow-Origin", "*");
      return res.redirect(302, url);
    }
  } catch {}

  res.status(500).json({ error: "Stream failed" });
});


// Diverse genre seeds so related always mixes things up
const GENRE_SEEDS = [
  "indie pop hits",
  "r&b soul vibes",
  "electronic chill",
  "hip hop bangers",
  "acoustic singer songwriter",
  "alternative rock anthems",
  "latin pop hits",
  "k-pop viral",
  "jazz lofi beats",
  "dance pop 2026",
];

// GET /related/:videoId  — diverse radio-style suggestions
router.get("/related/:videoId", async (req: Request, res: Response) => {
  const { videoId } = req.params;
  const key = `related:${videoId}`;
  const cached = getCache<unknown[]>(key);
  if (cached) return void res.json(cached);
  try {
    // Get track info for context
    const infoOut = await ytdlpRun([
      "--dump-json",
      "--no-playlist",
      "--no-warnings",
      `https://www.youtube.com/watch?v=${videoId}`,
    ], 20_000);
    const info = JSON.parse(infoOut.trim().split("\n")[0]) as Record<string, unknown>;
    const artist = String(info.uploader ?? info.channel ?? "");

    // Pick two diverse genre seeds (rotated by videoId hash so it's deterministic but varied)
    const hash = videoId.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    const seed1 = GENRE_SEEDS[hash % GENRE_SEEDS.length];
    const seed2 = GENRE_SEEDS[(hash + 3) % GENRE_SEEDS.length];

    // Run two searches in parallel: artist-adjacent + genre-diverse
    const [artistOut, genreOut] = await Promise.all([
      ytdlpRun([
        `ytsearch8:${artist || "popular music"} similar artists`,
        "--dump-json", "--flat-playlist", "--no-playlist", "--no-warnings",
      ], 25_000),
      ytdlpRun([
        `ytsearch10:${seed1} ${seed2}`,
        "--dump-json", "--flat-playlist", "--no-playlist", "--no-warnings",
      ], 25_000),
    ]);

    const artistTracks = parseFlatLines(artistOut);
    const genreTracks = parseFlatLines(genreOut);

    // Interleave: 1 artist-adjacent, 2 genre-diverse, etc. — prevents clumping
    const combined: typeof artistTracks = [];
    const seen = new Set<string>();
    seen.add(videoId); // never return the source track

    let ai = 0, gi = 0;
    while (combined.length < 20 && (ai < artistTracks.length || gi < genreTracks.length)) {
      if (ai < artistTracks.length) {
        const t = artistTracks[ai++];
        if (t && !seen.has(t.id as string)) { seen.add(t.id as string); combined.push(t); }
      }
      for (let k = 0; k < 2 && gi < genreTracks.length; k++) {
        const t = genreTracks[gi++];
        if (t && !seen.has(t.id as string)) { seen.add(t.id as string); combined.push(t); }
      }
    }

    setCache(key, combined, 10 * 60 * 1000);
    res.json(combined);
  } catch (err) {
    req.log.error({ err }, "related error");
    res.status(500).json({ error: "Failed to fetch related" });
  }
});

// GET /lyrics?title=&artist=
router.get("/lyrics", async (req: Request, res: Response) => {
  const { title, artist = "unknown" } = req.query;
  if (!title) return void res.status(400).json({ error: "title required" });
  try {
    const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(
      String(artist)
    )}/${encodeURIComponent(String(title))}`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    if (!resp.ok) throw new Error("not found");
    const data = (await resp.json()) as { lyrics?: string };
    res.json({ lyrics: data.lyrics ?? "" });
  } catch {
    res.json({ lyrics: "" });
  }
});

// GET /info?url=  — yt-dlp metadata for any URL
router.get("/info", async (req: Request, res: Response) => {
  const { url } = req.query;
  if (!url) return void res.status(400).json({ error: "url required" });
  try {
    const out = await ytdlpRun([
      "--dump-json",
      "--no-playlist",
      "--no-warnings",
      String(url),
    ], 30_000);
    const p = JSON.parse(out.trim().split("\n")[0]) as Record<string, unknown>;
    res.json({
      title: String(p.title ?? ""),
      uploader: String(p.uploader ?? p.channel ?? ""),
      duration: Number(p.duration ?? 0),
      thumbnail: String(p.thumbnail ?? ""),
      formats: (
        (p.formats as Record<string, unknown>[] | undefined) ?? []
      ).map((f) => ({
        format_id: f.format_id,
        height: f.height,
        ext: f.ext,
        tbr: f.tbr,
        acodec: f.acodec,
      })),
      site_name: String(p.extractor_key ?? p.extractor ?? "Unknown"),
      subtitles: (p.subtitles as Record<string, unknown> | undefined) ?? {},
    });
  } catch (err) {
    req.log.error({ err }, "info error");
    res.status(500).json({ error: "Failed to fetch URL info" });
  }
});

// POST /download  — stream download via yt-dlp stdout
router.post("/download", (req: Request, res: Response) => {
  const {
    url,
    format = "mp3",
    quality = "audio-only",
  } = req.body as { url?: string; format?: string; quality?: string };
  if (!url) return void res.status(400).json({ error: "url required" });

  const args: string[] = ["--no-playlist", "--max-filesize", "800m", "--no-warnings"];

  if (quality === "audio-only" || format === "mp3" || format === "m4a") {
    args.push(
      "-x",
      "--audio-format", format === "m4a" ? "m4a" : "mp3",
      "--audio-quality", "0"
    );
  } else {
    const heights: Record<string, string> = {
      "360p": "360", "480p": "480", "720p": "720",
      "1080p": "1080", "1440p": "1440", "2160p": "2160",
    };
    const h = heights[quality] ?? "720";
    args.push(
      "-f", `bestvideo[height<=${h}]+bestaudio/best[height<=${h}]`,
      "--merge-output-format", format === "mp4" ? "mp4" : "webm"
    );
  }

  const ext =
    quality === "audio-only"
      ? format === "m4a" ? "m4a" : "mp3"
      : format === "mp4" ? "mp4" : "webm";

  res.setHeader("Content-Disposition", `attachment; filename="download.${ext}"`);
  res.setHeader(
    "Content-Type",
    ext === "mp3" ? "audio/mpeg" : ext === "m4a" ? "audio/mp4" : "video/mp4"
  );

  args.push("-o", "-", url);
  const proc = spawn(ytdlp, args);
  proc.stdout.pipe(res);
  proc.on("error", (err) => {
    req.log.error({ err }, "download error");
    if (!res.headersSent) res.status(500).json({ error: "Download failed" });
  });
  req.on("close", () => proc.kill());
});

// GET /suggest?q=  — simple YouTube search-based suggestions
router.get("/suggest", async (req: Request, res: Response) => {
  const { q } = req.query;
  if (!q) return void res.json([]);
  const key = `suggest:${q}`;
  const cached = getCache<string[]>(key);
  if (cached) return void res.json(cached);
  // Generate simple suffix-based suggestions
  const base = String(q);
  const suggestions = [
    base,
    `${base} remix`,
    `${base} acoustic`,
    `${base} live`,
    `${base} official`,
    `${base} lyrics`,
  ].slice(0, 6);
  setCache(key, suggestions, 5 * 60 * 1000);
  res.json(suggestions);
});

// GET /artist?id=  — search by channel/artist name
router.get("/artist", async (req: Request, res: Response) => {
  const { id } = req.query;
  if (!id) return void res.status(400).json({ error: "id required" });
  const key = `artist:${id}`;
  const cached = getCache<unknown>(key);
  if (cached) return void res.json(cached);
  try {
    const out = await ytdlpRun([
      `ytsearch20:${String(id)} official music`,
      "--dump-json",
      "--flat-playlist",
      "--no-playlist",
      "--no-warnings",
    ], 30_000);
    const tracks = parseFlatLines(out);
    const result = {
      name: String(id),
      avatar: "",
      subscribers: 0,
      description: "",
      topTracks: tracks,
    };
    setCache(key, result, 10 * 60 * 1000);
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "artist error");
    res.status(500).json({ error: "Failed to fetch artist" });
  }
});

// ── Popular artists list ────────────────────────────────────────────────────

const POPULAR_ARTISTS = [
  { id: 'taylor-swift',      name: 'Taylor Swift',      genre: 'Pop' },
  { id: 'drake',             name: 'Drake',             genre: 'Hip-Hop' },
  { id: 'the-weeknd',        name: 'The Weeknd',        genre: 'R&B' },
  { id: 'bad-bunny',         name: 'Bad Bunny',         genre: 'Latin' },
  { id: 'billie-eilish',     name: 'Billie Eilish',     genre: 'Alt-Pop' },
  { id: 'kendrick-lamar',    name: 'Kendrick Lamar',    genre: 'Hip-Hop' },
  { id: 'dua-lipa',          name: 'Dua Lipa',          genre: 'Pop' },
  { id: 'post-malone',       name: 'Post Malone',       genre: 'Hip-Hop' },
  { id: 'ariana-grande',     name: 'Ariana Grande',     genre: 'Pop' },
  { id: 'ed-sheeran',        name: 'Ed Sheeran',        genre: 'Pop' },
  { id: 'sza',               name: 'SZA',               genre: 'R&B' },
  { id: 'travis-scott',      name: 'Travis Scott',      genre: 'Hip-Hop' },
  { id: 'olivia-rodrigo',    name: 'Olivia Rodrigo',    genre: 'Pop-Rock' },
  { id: 'sabrina-carpenter', name: 'Sabrina Carpenter', genre: 'Pop' },
  { id: 'tyler-creator',     name: 'Tyler, the Creator',genre: 'Hip-Hop' },
  { id: 'beyonce',           name: 'Beyoncé',            genre: 'R&B/Pop' },
  { id: 'coldplay',          name: 'Coldplay',           genre: 'Alternative' },
  { id: 'imagine-dragons',   name: 'Imagine Dragons',   genre: 'Alternative' },
  { id: 'frank-ocean',       name: 'Frank Ocean',       genre: 'R&B' },
  { id: 'harry-styles',      name: 'Harry Styles',      genre: 'Pop' },
  { id: 'j-cole',            name: 'J. Cole',           genre: 'Hip-Hop' },
  { id: 'adele',             name: 'Adele',             genre: 'Soul' },
  { id: 'doja-cat',          name: 'Doja Cat',          genre: 'Pop/Hip-Hop' },
  { id: 'sade',              name: 'Sade',              genre: 'Soul/Jazz' },
  { id: 'burna-boy',         name: 'Burna Boy',         genre: 'Afrobeats' },
  { id: 'wizkid',            name: 'Wizkid',            genre: 'Afrobeats' },
  { id: 'rihanna',           name: 'Rihanna',           genre: 'R&B/Pop' },
  { id: 'juice-wrld',        name: 'Juice WRLD',        genre: 'Emo-Rap' },
  { id: 'arctic-monkeys',    name: 'Arctic Monkeys',    genre: 'Indie Rock' },
  { id: 'mac-miller',        name: 'Mac Miller',        genre: 'Hip-Hop' },
];

// GET /artists/popular
router.get("/artists/popular", (_req: Request, res: Response) => {
  res.json(POPULAR_ARTISTS);
});

export default router;
