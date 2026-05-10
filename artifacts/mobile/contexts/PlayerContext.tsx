import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { Audio } from 'expo-av';
import type { Track, SearchResult, EQSettings } from '@/constants/types';
import { getStreamUrl } from '@/constants/api';

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

  const soundRef = useRef<Audio.Sound | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const queueRef = useRef(queue);
  const queueIndexRef = useRef(queueIndex);
  const repeatModeRef = useRef(repeatMode);

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

  const handleTrackEnd = useCallback(async () => {
    const mode = repeatModeRef.current;
    const q = queueRef.current;
    const idx = queueIndexRef.current;

    if (mode === 'one') {
      await soundRef.current?.replayAsync().catch(() => {});
      return;
    }
    const nextIdx = idx + 1;
    if (nextIdx < q.length) {
      setQueueIndex(nextIdx);
      await loadAndPlayTrack(q[nextIdx]);
    } else if (mode === 'all' && q.length > 0) {
      setQueueIndex(0);
      await loadAndPlayTrack(q[0]);
    } else {
      setIsPlaying(false);
    }
  }, []);

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
    const q = newQueue ?? [track];
    const idx = Math.max(0, q.findIndex(t => t.id === track.id));
    setQueue(q);
    setQueueIndex(idx);
    await loadAndPlayTrack(track);
  }, []);

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
    if (nextIdx < q.length) {
      setQueueIndex(nextIdx);
      await loadAndPlayTrack(q[nextIdx]);
    } else if (repeatModeRef.current === 'all' && q.length > 0) {
      setQueueIndex(0);
      await loadAndPlayTrack(q[0]);
    }
  }, []);

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
    setQueue(prev => [...prev, track]);
  }, []);

  const removeFromQueue = useCallback((index: number) => {
    setQueue(prev => prev.filter((_, i) => i !== index));
  }, []);

  const clearQueue = useCallback(() => {
    setQueue([]);
    setQueueIndex(-1);
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
      shuffle, repeatMode, isLoading, eqSettings,
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
