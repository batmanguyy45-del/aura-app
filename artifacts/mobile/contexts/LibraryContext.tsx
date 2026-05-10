import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Track, Playlist, HistoryEntry } from '@/constants/types';

export interface Stats {
  totalListeningMinutes: number;
  topTracks: { id: string; title: string; artist: string; thumbnail: string; playCount: number }[];
  topArtists: { name: string; playCount: number }[];
  dailyActivity: Record<string, number>;
  longestStreak: number;
  firstPlayDate?: number;
}

interface LibraryContextType {
  tracks: Track[];
  playlists: Playlist[];
  history: HistoryEntry[];
  stats: Stats;
  likedIds: Set<string>;
  favoriteArtists: Set<string>;
  addTrack: (track: Track) => void;
  removeTrack: (id: string) => void;
  updateTrack: (id: string, updates: Partial<Track>) => void;
  toggleLike: (trackId: string, title: string, artist: string, thumbnail: string, duration?: number) => void;
  toggleFavoriteArtist: (artistName: string) => void;
  addToHistory: (entry: Omit<HistoryEntry, 'id'>) => void;
  createPlaylist: (name: string) => void;
  deletePlaylist: (id: string) => void;
  addToPlaylist: (playlistId: string, trackId: string) => void;
  removeFromPlaylist: (playlistId: string, trackId: string) => void;
  incrementPlayCount: (trackId: string) => void;
}

const LibraryContext = createContext<LibraryContextType | null>(null);

const KEYS = {
  TRACKS: '@aura:tracks',
  PLAYLISTS: '@aura:playlists',
  HISTORY: '@aura:history',
  LIKED: '@aura:liked',
  STATS: '@aura:stats',
  FAVORITE_ARTISTS: '@aura:favorite_artists',
};

const DEFAULT_STATS: Stats = {
  totalListeningMinutes: 0,
  topTracks: [],
  topArtists: [],
  dailyActivity: {},
  longestStreak: 0,
};

export function LibraryProvider({ children }: { children: React.ReactNode }) {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [stats, setStats] = useState<Stats>(DEFAULT_STATS);
  const [favoriteArtists, setFavoriteArtists] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      try {
        const [t, p, h, l, s, fa] = await Promise.all([
          AsyncStorage.getItem(KEYS.TRACKS),
          AsyncStorage.getItem(KEYS.PLAYLISTS),
          AsyncStorage.getItem(KEYS.HISTORY),
          AsyncStorage.getItem(KEYS.LIKED),
          AsyncStorage.getItem(KEYS.STATS),
          AsyncStorage.getItem(KEYS.FAVORITE_ARTISTS),
        ]);
        if (t) setTracks(JSON.parse(t));
        if (p) setPlaylists(JSON.parse(p));
        if (h) setHistory(JSON.parse(h));
        if (l) setLikedIds(new Set(JSON.parse(l)));
        if (s) setStats(JSON.parse(s));
        if (fa) setFavoriteArtists(new Set(JSON.parse(fa)));
      } catch {}
    })();
  }, []);

  const persist = async (key: string, data: unknown) => {
    try { await AsyncStorage.setItem(key, JSON.stringify(data)); } catch {}
  };

  const addTrack = useCallback((track: Track) => {
    setTracks(prev => {
      if (prev.some(t => t.id === track.id)) return prev;
      const updated = [...prev, track];
      persist(KEYS.TRACKS, updated);
      return updated;
    });
  }, []);

  const removeTrack = useCallback((id: string) => {
    setTracks(prev => {
      const updated = prev.filter(t => t.id !== id);
      persist(KEYS.TRACKS, updated);
      return updated;
    });
  }, []);

  const updateTrack = useCallback((id: string, updates: Partial<Track>) => {
    setTracks(prev => {
      const updated = prev.map(t => t.id === id ? { ...t, ...updates } : t);
      persist(KEYS.TRACKS, updated);
      return updated;
    });
  }, []);

  const toggleLike = useCallback((
    trackId: string, title: string, artist: string, thumbnail: string, duration = 0
  ) => {
    setLikedIds(prev => {
      const next = new Set(prev);
      if (next.has(trackId)) { next.delete(trackId); } else { next.add(trackId); }
      persist(KEYS.LIKED, [...next]);
      return next;
    });
    setTracks(prev => {
      if (prev.some(t => t.id === trackId)) {
        const updated = prev.map(t => t.id === trackId ? { ...t, liked: !t.liked } : t);
        persist(KEYS.TRACKS, updated);
        return updated;
      }
      const newTrack: Track = {
        id: trackId, title, artist, duration, thumbnail,
        playCount: 0, liked: true,
      };
      const updated = [...prev, newTrack];
      persist(KEYS.TRACKS, updated);
      return updated;
    });
  }, []);

  const toggleFavoriteArtist = useCallback((artistName: string) => {
    setFavoriteArtists(prev => {
      const next = new Set(prev);
      if (next.has(artistName)) { next.delete(artistName); } else { next.add(artistName); }
      persist(KEYS.FAVORITE_ARTISTS, [...next]);
      return next;
    });
  }, []);

  const addToHistory = useCallback((entry: Omit<HistoryEntry, 'id'>) => {
    const newEntry: HistoryEntry = {
      ...entry,
      id: Date.now().toString() + Math.random().toString(36).substring(2, 7),
    };
    setHistory(prev => {
      const updated = [newEntry, ...prev].slice(0, 200);
      persist(KEYS.HISTORY, updated);
      return updated;
    });
    setStats(prev => {
      const today = new Date().toISOString().split('T')[0];
      const newStats: Stats = {
        ...prev,
        totalListeningMinutes: prev.totalListeningMinutes + (entry.duration / 60),
        dailyActivity: {
          ...prev.dailyActivity,
          [today]: (prev.dailyActivity[today] || 0) + (entry.duration / 60),
        },
      };
      persist(KEYS.STATS, newStats);
      return newStats;
    });
  }, []);

  const createPlaylist = useCallback((name: string) => {
    const playlist: Playlist = {
      id: Date.now().toString() + Math.random().toString(36).substring(2, 7),
      name,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      trackIds: [],
    };
    setPlaylists(prev => {
      const updated = [...prev, playlist];
      persist(KEYS.PLAYLISTS, updated);
      return updated;
    });
  }, []);

  const deletePlaylist = useCallback((id: string) => {
    setPlaylists(prev => {
      const updated = prev.filter(p => p.id !== id);
      persist(KEYS.PLAYLISTS, updated);
      return updated;
    });
  }, []);

  const addToPlaylist = useCallback((playlistId: string, trackId: string) => {
    setPlaylists(prev => {
      const updated = prev.map(p =>
        p.id === playlistId && !p.trackIds.includes(trackId)
          ? { ...p, trackIds: [...p.trackIds, trackId], updatedAt: Date.now() }
          : p
      );
      persist(KEYS.PLAYLISTS, updated);
      return updated;
    });
  }, []);

  const removeFromPlaylist = useCallback((playlistId: string, trackId: string) => {
    setPlaylists(prev => {
      const updated = prev.map(p =>
        p.id === playlistId
          ? { ...p, trackIds: p.trackIds.filter(id => id !== trackId), updatedAt: Date.now() }
          : p
      );
      persist(KEYS.PLAYLISTS, updated);
      return updated;
    });
  }, []);

  const incrementPlayCount = useCallback((trackId: string) => {
    setTracks(prev => {
      const updated = prev.map(t =>
        t.id === trackId
          ? { ...t, playCount: t.playCount + 1, lastPlayed: Date.now() }
          : t
      );
      persist(KEYS.TRACKS, updated);
      return updated;
    });
  }, []);

  return (
    <LibraryContext.Provider value={{
      tracks, playlists, history, stats, likedIds, favoriteArtists,
      addTrack, removeTrack, updateTrack, toggleLike, toggleFavoriteArtist,
      addToHistory, createPlaylist, deletePlaylist, addToPlaylist,
      removeFromPlaylist, incrementPlayCount,
    }}>
      {children}
    </LibraryContext.Provider>
  );
}

export function useLibrary() {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error('useLibrary must be used within LibraryProvider');
  return ctx;
}
