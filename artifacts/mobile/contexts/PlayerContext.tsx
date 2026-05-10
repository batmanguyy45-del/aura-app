import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { Audio } from 'expo-av';
import { Platform } from 'react-native';
import type { Track, SearchResult, EQSettings } from '@/constants/types';
import { getStreamUrl, getApiBase } from '@/constants/api';

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

const RADIO_SEEDS = [
  'top hits 2026',
  'chill vibes mix',
  'popular songs right now',
  'indie music 2026',
  'best pop songs 2026',
  'viral music hits',
  'alternative hits',
  'r&b soul mix',
  'electronic dance music',
  'acoustic covers popular',
];

function pickSeed(exclude: string[]): string {
  const available = RADIO_SEEDS.filter(s => !exclude.includes(s));
  const pool = available.length > 0 ? available : RADIO_SEEDS;
  return pool[Math.floor(Math.random() * pool.length)];
}

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
        ? [
            { src: track.thumbnail, sizes: '512x512', type: 'image/jpeg' },
            { src: track.thumbnail, sizes: '256x256', type: 'image/jpeg' },
          ]
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
  const loadGenRef = useRef(0);          // ← double-play guard
  const queueRef = useRef(queue);
  const queueIndexRef = useRef(queueIndex);
  const repeatModeRef = useRef(repeatMode);
  const usedSeedsRef = useRef<string[]>([]);
  const isFetchingMoreRef = useRef(false);
  const seenIdsRef = useRef<Set<string>>(new Set());

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

  // ── Media Session action handlers (registered once) ─────────────────────
  const pauseRef = useRef<() => Promise<void>>();
  const resumeRef = useRef<() => Promise<void>>();
  const nextRef = useRef<() => Promise<void>>();
  const prevRef = useRef<() => Promise<void>>();

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
      try {
        (['play', 'pause', 'nexttrack', 'previoustrack', 'stop'] as MediaSessionAction[])
          .forEach(a => { try { navigator.mediaSession.setActionHandler(a, null); } catch {} });
      } catch {}
    };
  }, []);

  // ── Sync MediaSession metadata & playback state ─────────────────────────
  useEffect(() => {
    if (currentTrack) updateMediaSessionMetadata(currentTrack);
  }, [currentTrack]);

  useEffect(() => {
    setMediaSessionState(isPlaying);
  }, [isPlaying]);

  // ── Helpers ─────────────────────────────────────────────────────────────
  const clearInterval_ = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const fetchMoreTracks = useCallback(async (seedQuery?: string) => {
    if (isFetchingMoreRef.current) return;
    isFetchingMoreRef.current = true;
    try {
      const seed = seedQuery ?? pickSeed(usedSeedsRef.current);
      usedSeedsRef.current.push(seed);
      if (usedSeedsRef.current.length > 8) usedSeedsRef.current.shift();

      const resp = await fetch(
        `${getApiBase()}/search?q=${encodeURIComponent(seed)}&filter=music`
      );
      if (!resp.ok) return;
      const data = (await resp.json()) as QueueTrack[];
      if (!Array.isArray(data)) return;

      const fresh = data.filter(t => !seenIdsRef.current.has(t.id));
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

  const handleTrackEnd = useCallback(async () => {
    const mode = repeatModeRef.current;
    const q = queueRef.current;
    const idx = queueIndexRef.current;

    if (mode === 'one') {
      await soundRef.current?.replayAsync().catch(() => {});
      return;
    }
    const nextIdx = idx + 1;
    if (nextIdx >= q.length - 4) fetchMoreTracks();

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

  // ── Core load — generation-guarded to prevent double playback ───────────
  const loadAndPlayTrack = async (track: QueueTrack) => {
    const gen = ++loadGenRef.current;   // bump generation

    setIsLoading(true);
    clearInterval_();

    // Unload previous sound first
    const prevSound = soundRef.current;
    soundRef.current = null;
    if (prevSound) {
      await prevSound.unloadAsync().catch(() => {});
    }

    // If another load was kicked off while we were unloading, bail
    if (gen !== loadGenRef.current) return;

    setCurrentTrack(track);
    setPosition(0);
    setDuration(0);
    setIsPlaying(false);
    updateMediaSessionMetadata(track);

    try {
      const streamUrl = getStreamUrl(track.id);
      const { sound } = await Audio.Sound.createAsync(
        { uri: streamUrl },
        { shouldPlay: true, rate: eqSettings.tempo, volume: 1.0 }
      );

      // Stale check again after the async create
      if (gen !== loadGenRef.current) {
        sound.unloadAsync().catch(() => {});
        return;
      }

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
          if (status.didJustFinish) {
            clearInterval_();
            handleTrackEnd();
          }
        } catch {}
      }, 500);
    } catch {
      if (gen === loadGenRef.current) {
        setIsLoading(false);
      }
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

    await loadAndPlayTrack(track);

    // Background enrich: use explicit artist seed, track artist, or random radio seed
    const seed = artistSeed ??
      (track.artist ? `${track.artist} music similar songs` : pickSeed([]));
    fetchMoreTracks(seed);
  }, [fetchMoreTracks]);

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
    if (nextIdx >= q.length - 4) fetchMoreTracks();
    if (nextIdx < q.length) {
      setQueueIndex(nextIdx);
      await loadAndPlayTrack(q[nextIdx]);
    } else if (repeatModeRef.current === 'all' && q.length > 0) {
      setQueueIndex(0);
      await loadAndPlayTrack(q[0]);
    }
  }, [fetchMoreTracks]);
  nextRef.current = next;

  const prev = useCallback(async () => {
    if (position > 3) { await seek(0); return; }
    const q = queueRef.current;
    const idx = queueIndexRef.current;
    const prevIdx = idx - 1;
    if (prevIdx >= 0) {
      setQueueIndex(prevIdx);
      await loadAndPlayTrack(q[prevIdx]);
    }
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
  }, []);

  const clearQueue = useCallback(() => {
    setQueue([]); setQueueIndex(-1);
    seenIdsRef.current.clear(); usedSeedsRef.current = [];
    setAutoQueueActive(false);
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
      play, pause, resume, seek, next, prev,
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
