import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { Audio } from 'expo-av';
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
  play: (track: QueueTrack, newQueue?: QueueTrack[]) => Promise<void>;
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

// Diverse radio-seed queries rotated to keep the queue fresh
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
  const queueRef = useRef(queue);
  const queueIndexRef = useRef(queueIndex);
  const repeatModeRef = useRef(repeatMode);
  const usedSeedsRef = useRef<string[]>([]);
  const isFetchingMoreRef = useRef(false);
  const seenIdsRef = useRef<Set<string>>(new Set());

  queueRef.current = queue;
  queueIndexRef.current = queueIndex;
  repeatModeRef.current = repeatMode;

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

  const clearInterval_ = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  // Fetch diverse tracks and append to queue — never repeat IDs already seen
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
      // silently ignore
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

    // Auto-top-up: if we're 4 tracks from the end, fetch more
    if (nextIdx >= q.length - 4) {
      fetchMoreTracks();
    }

    if (nextIdx < q.length) {
      setQueueIndex(nextIdx);
      await loadAndPlayTrack(q[nextIdx]);
    } else if (mode === 'all' && q.length > 0) {
      setQueueIndex(0);
      await loadAndPlayTrack(q[0]);
    } else {
      setIsPlaying(false);
    }
  }, [fetchMoreTracks]);

  const loadAndPlayTrack = async (track: QueueTrack) => {
    setIsLoading(true);
    clearInterval_();

    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }

      setCurrentTrack(track);
      setPosition(0);
      setDuration(0);
      setIsPlaying(false);

      const streamUrl = getStreamUrl(track.id);
      const { sound } = await Audio.Sound.createAsync(
        { uri: streamUrl },
        { shouldPlay: true, rate: eqSettings.tempo, volume: 1.0 }
      );

      soundRef.current = sound;
      setIsPlaying(true);
      setIsLoading(false);

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
      setIsLoading(false);
    }
  };

  const play = useCallback(async (track: QueueTrack, newQueue?: QueueTrack[]) => {
    // Build initial queue: source list (deduped by id)
    const seen = new Set<string>();
    const baseQueue: QueueTrack[] = [];
    const source = newQueue ?? [track];
    for (const t of source) {
      if (!seen.has(t.id)) {
        seen.add(t.id);
        baseQueue.push(t);
        seenIdsRef.current.add(t.id);
      }
    }

    const idx = Math.max(0, baseQueue.findIndex(t => t.id === track.id));
    setQueue(baseQueue);
    setQueueIndex(idx);
    setAutoQueueActive(false);
    usedSeedsRef.current = [];
    await loadAndPlayTrack(track);

    // Background: enrich queue with related + diverse tracks
    // Use artist name from track as first related seed
    const artistSeed = track.artist
      ? `${track.artist} music similar songs`
      : pickSeed([]);

    fetchMoreTracks(artistSeed);
  }, [fetchMoreTracks]);

  const pause = useCallback(async () => {
    if (soundRef.current) {
      await soundRef.current.pauseAsync().catch(() => {});
      setIsPlaying(false);
    }
  }, []);

  const resume = useCallback(async () => {
    if (soundRef.current) {
      await soundRef.current.playAsync().catch(() => {});
      setIsPlaying(true);
    }
  }, []);

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

    // Top-up if running low
    if (nextIdx >= q.length - 4) fetchMoreTracks();

    if (nextIdx < q.length) {
      setQueueIndex(nextIdx);
      await loadAndPlayTrack(q[nextIdx]);
    } else if (repeatModeRef.current === 'all' && q.length > 0) {
      setQueueIndex(0);
      await loadAndPlayTrack(q[0]);
    }
  }, [fetchMoreTracks]);

  const prev = useCallback(async () => {
    if (position > 3) {
      await seek(0);
      return;
    }
    const q = queueRef.current;
    const idx = queueIndexRef.current;
    const prevIdx = idx - 1;
    if (prevIdx >= 0) {
      setQueueIndex(prevIdx);
      await loadAndPlayTrack(q[prevIdx]);
    }
  }, [position, seek]);

  const toggleShuffle = useCallback(() => setShuffle(prev => !prev), []);

  const toggleRepeat = useCallback(() => {
    setRepeatMode(prev => {
      const next = prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off';
      repeatModeRef.current = next;
      return next;
    });
  }, []);

  const addToQueue = useCallback((track: QueueTrack) => {
    if (!seenIdsRef.current.has(track.id)) {
      seenIdsRef.current.add(track.id);
    }
    setQueue(prev => [...prev, track]);
  }, []);

  const removeFromQueue = useCallback((index: number) => {
    setQueue(prev => prev.filter((_, i) => i !== index));
  }, []);

  const clearQueue = useCallback(() => {
    setQueue([]);
    setQueueIndex(-1);
    seenIdsRef.current.clear();
    usedSeedsRef.current = [];
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
