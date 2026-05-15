import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { Audio } from 'expo-av';
import { Platform } from 'react-native';
import type { Track, SearchResult, EQSettings } from '@/constants/types';
import { getStreamUrl, getApiBase, resolveStreamUrl } from "@/constants/api";

export type QueueTrack = Track | SearchResult;

export interface PlayerContextType {
  currentTrack: QueueTrack | null;
  isPlaying: boolean;
  position: number;
  duration: number;
  queue: QueueTrack[];
  queueIndex: number;
  shuffle: boolean;
  repeatMode: 'off' | 'all' | 'one';
  isLoading: boolean;
  eqSettings: EQSettings;
  autoQueueActive: boolean;
  play: (track: QueueTrack, newQueue?: QueueTrack[], artistSeed?: string) => Promise<void>;
  playAtIndex: (index: number) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  seek: (positionSeconds: number) => Promise<void>;
  next: () => Promise<void>;
  prev: () => Promise<void>;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  addToQueue: (track: QueueTrack) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  reorderQueue: (from: number, to: number) => void;
  updateEQ: (settings: Partial<EQSettings>) => void;
}

const DEFAULT_EQ: EQSettings = {
  preampGain: 0,
  bands: [
    { frequency: 32, gain: 0 },
    { frequency: 64, gain: 0 },
    { frequency: 125, gain: 0 },
    { frequency: 250, gain: 0 },
    { frequency: 500, gain: 0 },
    { frequency: 1000, gain: 0 },
    { frequency: 2000, gain: 0 },
    { frequency: 4000, gain: 0 },
    { frequency: 8000, gain: 0 },
    { frequency: 16000, gain: 0 },
  ],
  bassBoost: false,
  trebleBoost: false,
  stereoExpansion: 0,
  reverbEnabled: false,
  reverbSize: 0.3,
  pitch: 0,
  tempo: 1.0,
  monoMix: false,
  balance: 0,
};

// ── Diverse seed pools — 80+ seeds across 9 categories ───────────────────────
const SEED_POOLS: Record<string, string[]> = {
  charts: [
    'Billboard Hot 100 2026 playlist',
    'Spotify Global Top 50 2026',
    'YouTube Music trending hits 2026',
    'Apple Music top songs 2026',
    'most streamed songs worldwide 2026',
    'viral hits 2026 playlist',
  ],
  hiphop: [
    'hip hop rap 2026 mix playlist',
    'trap music 2026 playlist',
    'drill music 2026 mix',
    'underground hip hop playlist',
    'old school hip hop classics',
    'boom bap rap mix',
    'conscious rap music playlist',
  ],
  rnb: [
    'r&b soul music playlist 2026',
    'neo soul music mix',
    'contemporary r&b hits 2026',
    'smooth r&b vibes playlist',
    'alternative r&b music',
  ],
  pop: [
    'pop hits 2026 music playlist',
    'indie pop music 2026 mix',
    'electropop dance hits',
    'bedroom pop chill music',
    'art pop music mix',
    'synth pop playlist',
  ],
  electronic: [
    'electronic dance music mix 2026',
    'deep house music playlist',
    'lo-fi hip hop study beats',
    'synthwave retrowave music mix',
    'ambient electronic music',
    'progressive house hits',
    'chillstep music playlist',
    'future bass music mix',
  ],
  global: [
    'afrobeats hits 2026 mix',
    'k-pop hits 2026 playlist',
    'latin reggaeton hits 2026',
    'dancehall riddim mix 2026',
    'amapiano 2026 playlist',
    'afropop music mix',
    'bossa nova jazz music',
    'cumbia music playlist',
    'soca music mix',
  ],
  moods: [
    'late night driving chill music',
    'morning energy workout songs',
    'study focus concentration music',
    'rainy day cozy music playlist',
    'feel good happy songs mix',
    'road trip music playlist',
    'heartbreak songs playlist',
    'romantic love songs playlist',
    'party songs 2026 mix',
    'relaxing spa music',
  ],
  alternative: [
    'indie alternative music 2026',
    'post punk new wave playlist',
    'shoegaze dream pop music',
    'folk acoustic music playlist',
    'emo music playlist',
    'math rock music mix',
    'lo-fi indie music',
    'psychedelic rock playlist',
  ],
  decades: [
    '90s greatest hits playlist',
    '2000s throwback hits mix',
    '2010s pop hits playlist',
    '80s classic hits',
    '70s soul funk classics',
    '2000s r&b hits playlist',
    '90s hip hop classics',
  ],
};

const CATEGORY_KEYS = Object.keys(SEED_POOLS);

// ── Media Session helpers ────────────────────────────────────────────────────

function isMediaSessionAvailable(): boolean {
  return Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    'mediaSession' in navigator;
}

function updateMediaSessionMetadata(track: QueueTrack) {
  if (!isMediaSessionAvailable()) return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist,
      album: 'AURA',
      artwork: track.thumbnail
        ? [{ src: track.thumbnail, sizes: '512x512', type: 'image/jpeg' }]
        : [],
    });
  } catch {}
}

function setMediaSessionState(playing: boolean) {
  if (!isMediaSessionAvailable()) return;
  try {
    navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
  } catch {}
}

// ── Context ──────────────────────────────────────────────────────────────────

const PlayerContext = createContext<PlayerContextType | null>(null);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [currentTrack, setCurrentTrack] = useState<QueueTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [queue, setQueue] = useState<QueueTrack[]>([]);
  const [queueIndex, setQueueIndex] = useState(-1);
  const [shuffle, setShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('off');
  const [isLoading, setIsLoading] = useState(false);
  const [eqSettings, setEQSettings] = useState<EQSettings>(DEFAULT_EQ);
  const [autoQueueActive, setAutoQueueActive] = useState(false);

  const soundRef = useRef<Audio.Sound | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const loadGenRef = useRef(0);
  const queueRef = useRef(queue);
  const queueIndexRef = useRef(queueIndex);
  const repeatModeRef = useRef(repeatMode);
  const isFetchingMoreRef = useRef(false);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const usedSeedsRef = useRef<string[]>([]);
  const catCursorRef = useRef(0);

  const pauseRef = useRef<() => Promise<void>>();
  const resumeRef = useRef<() => Promise<void>>();
  const nextRef = useRef<() => Promise<void>>();
  const prevRef = useRef<() => Promise<void>>();

  queueRef.current = queue;
  queueIndexRef.current = queueIndex;
  repeatModeRef.current = repeatMode;

  // ── Audio mode ──────────────────────────────────────────────────────────
  useEffect(() => {
    Audio.setAudioModeAsync({
      staysActiveInBackground: true,
      playsInSilentModeIOS: true,
    }).catch(() => {});
    return () => {
      soundRef.current?.unloadAsync().catch(() => {});
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // ── MediaSession handlers (once) ─────────────────────────────────────────
  useEffect(() => {
    if (!isMediaSessionAvailable()) return;
    try {
      navigator.mediaSession.setActionHandler('play', () => resumeRef.current?.());
      navigator.mediaSession.setActionHandler('pause', () => pauseRef.current?.());
      navigator.mediaSession.setActionHandler('nexttrack', () => nextRef.current?.());
      navigator.mediaSession.setActionHandler('previoustrack', () => prevRef.current?.());
      navigator.mediaSession.setActionHandler('stop', () => pauseRef.current?.());
    } catch {}
    return () => {
      if (!isMediaSessionAvailable()) return;
      (['play', 'pause', 'nexttrack', 'previoustrack', 'stop'] as MediaSessionAction[])
        .forEach(a => { try { navigator.mediaSession.setActionHandler(a, null); } catch {} });
    };
  }, []);

  useEffect(() => { if (currentTrack) updateMediaSessionMetadata(currentTrack); }, [currentTrack]);
  useEffect(() => { setMediaSessionState(isPlaying); }, [isPlaying]);

  // ── Helpers ──────────────────────────────────────────────────────────────
  const clearInterval_ = () => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  };

  // ── Diverse queue fetcher ────────────────────────────────────────────────
  const fetchMoreTracks = useCallback(async (seedQuery?: string) => {
    if (isFetchingMoreRef.current) return;
    isFetchingMoreRef.current = true;
    try {
      let seed1: string;
      let seed2: string;

      if (seedQuery) {
        seed1 = seedQuery;
        // Pick a random category for the second parallel fetch
        const cat = CATEGORY_KEYS[Math.floor(Math.random() * CATEGORY_KEYS.length)];
        const pool = SEED_POOLS[cat];
        seed2 = pool[Math.floor(Math.random() * pool.length)];
      } else {
        // Rotate through categories for maximum diversity
        const cat1 = CATEGORY_KEYS[catCursorRef.current % CATEGORY_KEYS.length];
        catCursorRef.current++;
        const cat2 = CATEGORY_KEYS[catCursorRef.current % CATEGORY_KEYS.length];
        catCursorRef.current++;

        const pool1 = SEED_POOLS[cat1];
        const pool2 = SEED_POOLS[cat2];

        const avail1 = pool1.filter(s => !usedSeedsRef.current.includes(s));
        const avail2 = pool2.filter(s => !usedSeedsRef.current.includes(s));

        seed1 = avail1.length > 0 ? avail1[Math.floor(Math.random() * avail1.length)] : pool1[Math.floor(Math.random() * pool1.length)];
        seed2 = avail2.length > 0 ? avail2[Math.floor(Math.random() * avail2.length)] : pool2[Math.floor(Math.random() * pool2.length)];
      }

      usedSeedsRef.current.push(seed1, seed2);
      if (usedSeedsRef.current.length > 60) usedSeedsRef.current = usedSeedsRef.current.slice(-30);

      // Parallel fetch for speed + diversity
      const [r1, r2] = await Promise.all([
        fetch(`${getApiBase()}/search?q=${encodeURIComponent(seed1)}&filter=music`).catch(() => null),
        fetch(`${getApiBase()}/search?q=${encodeURIComponent(seed2)}&filter=music`).catch(() => null),
      ]);

      const d1: QueueTrack[] = r1?.ok ? await r1.json().catch(() => []) : [];
      const d2: QueueTrack[] = r2?.ok ? await r2.json().catch(() => []) : [];

      // Interleave results for natural diversity: 1 from d1, 1 from d2, etc.
      const interleaved: QueueTrack[] = [];
      const len = Math.max(d1.length, d2.length);
      for (let i = 0; i < len; i++) {
        if (i < d1.length) interleaved.push(d1[i]);
        if (i < d2.length) interleaved.push(d2[i]);
      }

      const fresh = interleaved.filter(t => !seenIdsRef.current.has(t.id));
      fresh.forEach(t => seenIdsRef.current.add(t.id));

      if (fresh.length > 0) {
        setAutoQueueActive(true);
        setQueue(prev => [...prev, ...fresh]);
      }
    } catch {
    } finally {
      isFetchingMoreRef.current = false;
    }
  }, []);

  // ── Track end handler ────────────────────────────────────────────────────
  const handleTrackEnd = useCallback(async () => {
    const mode = repeatModeRef.current;
    const q = queueRef.current;
    const idx = queueIndexRef.current;

    if (mode === 'one') { await soundRef.current?.replayAsync().catch(() => {}); return; }

    const nextIdx = idx + 1;
    if (nextIdx >= q.length - 20) fetchMoreTracks();

    if (nextIdx < q.length) {
      setQueueIndex(nextIdx);
      await loadAndPlayTrack(q[nextIdx]);
    } else if (mode === 'all' && q.length > 0) {
      setQueueIndex(0);
      await loadAndPlayTrack(q[0]);
    } else {
      setIsPlaying(false);
      setMediaSessionState(false);
    }
  }, [fetchMoreTracks]);

  // ── Core load — generation guarded ──────────────────────────────────────
  const loadAndPlayTrack = async (track: QueueTrack) => {
    const gen = ++loadGenRef.current;

    setIsLoading(true);
    clearInterval_();

    const prevSound = soundRef.current;
    soundRef.current = null;
    if (prevSound) await prevSound.unloadAsync().catch(() => {});

    if (gen !== loadGenRef.current) return;

    setCurrentTrack(track);
    setPosition(0);
    setDuration(0);
    setIsPlaying(false);
    updateMediaSessionMetadata(track);

    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: await resolveStreamUrl(track.id) },
        { shouldPlay: true, rate: eqSettings.tempo, volume: 1.0 }
      );

      if (gen !== loadGenRef.current) { sound.unloadAsync().catch(() => {}); return; }

      soundRef.current = sound;
      setIsPlaying(true);
      setIsLoading(false);
      setMediaSessionState(true);

      intervalRef.current = setInterval(async () => {
        if (!soundRef.current) return;
        try {
          const status = await soundRef.current.getStatusAsync();
          if (!status.isLoaded) return;
          setPosition(status.positionMillis / 1000);
          setDuration((status.durationMillis ?? 0) / 1000);
          setIsPlaying(status.isPlaying);
          if (status.didJustFinish) { clearInterval_(); handleTrackEnd(); }
        } catch {}
      }, 500);
    } catch {
      if (gen === loadGenRef.current) setIsLoading(false);
    }
  };

  // ── Public API ───────────────────────────────────────────────────────────
  const play = useCallback(async (
    track: QueueTrack,
    newQueue?: QueueTrack[],
    artistSeed?: string,
  ) => {
    const seen = new Set<string>();
    const baseQueue: QueueTrack[] = [];
    for (const t of (newQueue ?? [track])) {
      if (!seen.has(t.id)) { seen.add(t.id); baseQueue.push(t); seenIdsRef.current.add(t.id); }
    }
    const idx = Math.max(0, baseQueue.findIndex(t => t.id === track.id));
    setQueue(baseQueue);
    setQueueIndex(idx);
    setAutoQueueActive(false);
    usedSeedsRef.current = [];
    catCursorRef.current = 0;
    await loadAndPlayTrack(track);

    // Pre-fetch diverse tracks immediately
    const seed = artistSeed ?? (track.artist ? `${track.artist} similar music mix` : undefined);
    fetchMoreTracks(seed);
    // Kick off a second fetch from a different category for instant depth
    setTimeout(() => fetchMoreTracks(), 3000);
  }, [fetchMoreTracks]);

  const playAtIndex = useCallback(async (index: number) => {
    const q = queueRef.current;
    if (index < 0 || index >= q.length) return;
    setQueueIndex(index);
    await loadAndPlayTrack(q[index]);
  }, []);

  const pause = useCallback(async () => {
    if (soundRef.current) {
      await soundRef.current.pauseAsync().catch(() => {});
      setIsPlaying(false);
      setMediaSessionState(false);
    }
  }, []);
  pauseRef.current = pause;

  const resume = useCallback(async () => {
    if (soundRef.current) {
      await soundRef.current.playAsync().catch(() => {});
      setIsPlaying(true);
      setMediaSessionState(true);
    }
  }, []);
  resumeRef.current = resume;

  const seek = useCallback(async (positionSeconds: number) => {
    if (soundRef.current) {
      await soundRef.current.setPositionAsync(positionSeconds * 1000).catch(() => {});
      setPosition(positionSeconds);
    }
  }, []);

  const next = useCallback(async () => {
    const q = queueRef.current;
    const idx = queueIndexRef.current;
    const nextIdx = idx + 1;
    if (nextIdx >= q.length - 20) fetchMoreTracks();
    if (nextIdx < q.length) { setQueueIndex(nextIdx); await loadAndPlayTrack(q[nextIdx]); }
    else if (repeatModeRef.current === 'all' && q.length > 0) { setQueueIndex(0); await loadAndPlayTrack(q[0]); }
  }, [fetchMoreTracks]);
  nextRef.current = next;

  const prev = useCallback(async () => {
    if (position > 3) { await seek(0); return; }
    const q = queueRef.current;
    const idx = queueIndexRef.current;
    const prevIdx = idx - 1;
    if (prevIdx >= 0) { setQueueIndex(prevIdx); await loadAndPlayTrack(q[prevIdx]); }
  }, [position, seek]);
  prevRef.current = prev;

  const toggleShuffle = useCallback(() => setShuffle(p => !p), []);

  const toggleRepeat = useCallback(() => {
    setRepeatMode(prev => {
      const next = prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off';
      repeatModeRef.current = next;
      return next;
    });
  }, []);

  const addToQueue = useCallback((track: QueueTrack) => {
    seenIdsRef.current.add(track.id);
    setQueue(prev => [...prev, track]);
  }, []);

  const removeFromQueue = useCallback((index: number) => {
    setQueue(prev => prev.filter((_, i) => i !== index));
    setQueueIndex(prev => index < prev ? prev - 1 : prev);
  }, []);

  const clearQueue = useCallback(() => {
    setQueue([]); setQueueIndex(-1);
    seenIdsRef.current.clear(); usedSeedsRef.current = [];
    catCursorRef.current = 0; setAutoQueueActive(false);
  }, []);

  const reorderQueue = useCallback((from: number, to: number) => {
    setQueue(prev => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }, []);

  const updateEQ = useCallback((settings: Partial<EQSettings>) => {
    setEQSettings(prev => ({ ...prev, ...settings }));
    if (soundRef.current && settings.tempo !== undefined) {
      soundRef.current.setRateAsync(settings.tempo, true).catch(() => {});
    }
  }, []);

  return (
    <PlayerContext.Provider value={{
      currentTrack, isPlaying, position, duration, queue, queueIndex,
      shuffle, repeatMode, isLoading, eqSettings, autoQueueActive,
      play, playAtIndex, pause, resume, seek, next, prev,
      toggleShuffle, toggleRepeat, addToQueue, removeFromQueue,
      clearQueue, reorderQueue, updateEQ,
    }}>
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used within PlayerProvider');
  return ctx;
}
