import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, FlatList, TouchableOpacity,
  StyleSheet, RefreshControl, ActivityIndicator, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { usePlayer } from '@/contexts/PlayerContext';
import { useLibrary } from '@/contexts/LibraryContext';
import { TrackCard } from '@/components/TrackCard';
import { TrackRow } from '@/components/TrackRow';
import { ArtistCard, type ArtistItem } from '@/components/ArtistCard';
import { getApiBase } from '@/constants/api';
import type { SearchResult } from '@/constants/types';

const MOOD_CHIPS = ['Chill', 'Hype', 'Focus', 'Sad', 'Workout', 'Sleep', 'Party'];

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { play, addToQueue } = usePlayer();
  const { history, favoriteArtists, toggleFavoriteArtist } = useLibrary();

  const [trending, setTrending] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [moodResults, setMoodResults] = useState<SearchResult[]>([]);
  const [moodLoading, setMoodLoading] = useState(false);

  const [popularArtists, setPopularArtists] = useState<ArtistItem[]>([]);
  const [artistTracks, setArtistTracks] = useState<Record<string, SearchResult[]>>({});
  const [expandedArtist, setExpandedArtist] = useState<string | null>(null);
  const [artistLoading, setArtistLoading] = useState<string | null>(null);

  const topPad = Platform.OS === 'web' ? 67 : insets.top + 8;
  const hasFavorites = favoriteArtists.size > 0;

  // ── Load trending + popular artists ──────────────────────────────────────
  const loadData = useCallback(async () => {
    try {
      const [trendResp, artistsResp] = await Promise.all([
        fetch(`${getApiBase()}/trending`),
        fetch(`${getApiBase()}/artists/popular`),
      ]);
      if (trendResp.ok) setTrending(await trendResp.json());
      if (artistsResp.ok) setPopularArtists(await artistsResp.json());
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── When a favorite artist is tapped — expand to show their tracks ────────
  const handleArtistPress = useCallback(async (artist: ArtistItem) => {
    if (expandedArtist === artist.name) {
      setExpandedArtist(null);
      return;
    }
    setExpandedArtist(artist.name);
    if (artistTracks[artist.name]) return; // cached
    setArtistLoading(artist.name);
    try {
      const resp = await fetch(
        `${getApiBase()}/search?q=${encodeURIComponent(artist.name + ' official music')}&filter=music`
      );
      if (resp.ok) {
        const data = await resp.json() as SearchResult[];
        setArtistTracks(prev => ({ ...prev, [artist.name]: data }));
      }
    } catch {}
    setArtistLoading(null);
  }, [expandedArtist, artistTracks]);

  // ── Mood chips ────────────────────────────────────────────────────────────
  const handleMood = useCallback(async (mood: string) => {
    if (selectedMood === mood) { setSelectedMood(null); setMoodResults([]); return; }
    setSelectedMood(mood);
    setMoodLoading(true);
    try {
      const resp = await fetch(`${getApiBase()}/search?q=${encodeURIComponent(mood)}&filter=music`);
      if (resp.ok) setMoodResults(await resp.json() as SearchResult[]);
    } catch {}
    setMoodLoading(false);
  }, [selectedMood]);

  const recentlyPlayed: SearchResult[] = history
    .filter((v, i, a) => a.findIndex(h => h.trackId === v.trackId) === i)
    .slice(0, 20)
    .map(h => ({ id: h.trackId, title: h.title, artist: h.artist, thumbnail: h.thumbnail, duration: h.duration }));

  const favoriteArtistList = popularArtists.filter(a => favoriteArtists.has(a.name));

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{ paddingTop: topPad, paddingBottom: Platform.OS === 'web' ? 150 : 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadData(); }}
            tintColor={colors.primary}
          />
        }
      >
        {/* ── Header ────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.greeting, { color: colors.mutedForeground }]}>{getGreeting()}</Text>
            <Text style={[styles.wordmark, { color: colors.foreground }]}>AURA</Text>
          </View>
        </View>

        {/* ── Favorite artist chips row (when following artists) ─────────── */}
        {hasFavorites && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.artistChipsRow}
          >
            {[...favoriteArtists].map(name => (
              <TouchableOpacity
                key={name}
                onPress={() => {
                  const a = popularArtists.find(x => x.name === name);
                  if (a) handleArtistPress(a);
                }}
                style={[styles.artistChip, { backgroundColor: colors.card, borderColor: colors.primary }]}
              >
                <Ionicons name="musical-notes" size={12} color={colors.primary} />
                <Text style={[styles.artistChipText, { color: colors.primary }]}>{name}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              onPress={() => setExpandedArtist(null)}
              style={[styles.artistChip, { backgroundColor: 'transparent', borderColor: colors.border }]}
            >
              <Ionicons name="add" size={12} color={colors.mutedForeground} />
              <Text style={[styles.artistChipText, { color: colors.mutedForeground }]}>More</Text>
            </TouchableOpacity>
          </ScrollView>
        )}

        {/* ── Mood chips ─────────────────────────────────────────────────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.moodRow}
        >
          {MOOD_CHIPS.map(mood => (
            <TouchableOpacity
              key={mood}
              onPress={() => handleMood(mood)}
              style={[
                styles.chip,
                {
                  backgroundColor: selectedMood === mood ? colors.primary : colors.card,
                  borderColor: selectedMood === mood ? colors.primary : colors.border,
                },
              ]}
            >
              <Text style={[styles.chipText, {
                color: selectedMood === mood ? colors.primaryForeground : colors.mutedForeground,
              }]}>
                {mood}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {loading ? (
          <View style={styles.loader}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        ) : (
          <>
            {/* ── Mood results ────────────────────────────────────────────── */}
            {selectedMood && (
              <Section title={`${selectedMood} Vibes`} colors={colors}>
                {moodLoading ? (
                  <ActivityIndicator color={colors.primary} style={{ padding: 24 }} />
                ) : (
                  <FlatList
                    horizontal
                    data={moodResults.slice(0, 12)}
                    keyExtractor={i => i.id}
                    renderItem={({ item }) => (
                      <TrackCard track={item} onPress={() => play(item, moodResults, `${selectedMood} music`)} />
                    )}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 16 }}
                    scrollEnabled={moodResults.length > 0}
                  />
                )}
              </Section>
            )}

            {/* ── Expanded artist tracks ───────────────────────────────────── */}
            {expandedArtist && (
              <Section
                title={expandedArtist}
                colors={colors}
                action={
                  <TouchableOpacity onPress={() => setExpandedArtist(null)}>
                    <Ionicons name="close" size={18} color={colors.mutedForeground} />
                  </TouchableOpacity>
                }
              >
                {artistLoading === expandedArtist ? (
                  <ActivityIndicator color={colors.primary} style={{ padding: 24 }} />
                ) : (artistTracks[expandedArtist] ?? []).length > 0 ? (
                  <>
                    <FlatList
                      horizontal
                      data={(artistTracks[expandedArtist] ?? []).slice(0, 10)}
                      keyExtractor={i => i.id}
                      renderItem={({ item }) => (
                        <TrackCard
                          track={item}
                          onPress={() => play(item, artistTracks[expandedArtist] ?? [], expandedArtist + ' music')}
                        />
                      )}
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ paddingHorizontal: 16 }}
                    />
                    <TouchableOpacity
                      onPress={() => {
                        const tracks = artistTracks[expandedArtist] ?? [];
                        if (tracks.length > 0) play(tracks[0], tracks, expandedArtist + ' music');
                      }}
                      style={[styles.playAllBtn, { backgroundColor: colors.primary }]}
                    >
                      <Ionicons name="play" size={14} color="#fff" />
                      <Text style={styles.playAllText}>Play All</Text>
                    </TouchableOpacity>
                  </>
                ) : null}
              </Section>
            )}

            {/* ── For You section (when following artists) ─────────────────── */}
            {hasFavorites && favoriteArtistList.length > 0 && !expandedArtist && (
              <Section title="For You" colors={colors}>
                <Text style={[styles.sectionSub, { color: colors.mutedForeground }]}>
                  Based on artists you follow
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.artistRow}
                >
                  {favoriteArtistList.map(artist => (
                    <ArtistCard
                      key={artist.id}
                      artist={artist}
                      isFollowing
                      onToggleFollow={toggleFavoriteArtist}
                      onPress={handleArtistPress}
                      size="compact"
                    />
                  ))}
                </ScrollView>
              </Section>
            )}

            {/* ── Trending Now ──────────────────────────────────────────────── */}
            {trending.length > 0 && (
              <Section title="Trending Now" colors={colors}>
                <FlatList
                  horizontal
                  data={trending.slice(0, 15)}
                  keyExtractor={i => i.id}
                  renderItem={({ item }) => (
                    <TrackCard track={item} onPress={() => play(item, trending)} />
                  )}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: 16 }}
                  scrollEnabled={!!trending.length}
                />
              </Section>
            )}

            {/* ── Recently Played ───────────────────────────────────────────── */}
            {recentlyPlayed.length > 0 && (
              <Section title="Recently Played" colors={colors}>
                <FlatList
                  horizontal
                  data={recentlyPlayed}
                  keyExtractor={i => i.id}
                  renderItem={({ item }) => (
                    <TrackCard track={item} onPress={() => play(item, recentlyPlayed)} />
                  )}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: 16 }}
                  scrollEnabled={!!recentlyPlayed.length}
                />
              </Section>
            )}

            {/* ── Discover Artists ──────────────────────────────────────────── */}
            {popularArtists.length > 0 && (
              <Section
                title={hasFavorites ? 'Discover More Artists' : 'Discover Artists'}
                colors={colors}
                subtitle={hasFavorites ? undefined : 'Follow artists to personalize your feed'}
              >
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.artistRow}
                >
                  {popularArtists.map(artist => (
                    <ArtistCard
                      key={artist.id}
                      artist={artist}
                      isFollowing={favoriteArtists.has(artist.name)}
                      onToggleFollow={toggleFavoriteArtist}
                      onPress={handleArtistPress}
                    />
                  ))}
                </ScrollView>
                {!hasFavorites && (
                  <Text style={[styles.discoverHint, { color: colors.mutedForeground }]}>
                    Tap + to follow · Tap avatar to browse
                  </Text>
                )}
              </Section>
            )}

            {/* ── More Trending (list) ──────────────────────────────────────── */}
            {trending.length > 6 && (
              <Section title="More Trending" colors={colors}>
                {trending.slice(6, 20).map(track => (
                  <TrackRow
                    key={track.id}
                    track={track}
                    onPlay={() => play(track, trending)}
                    onAddToQueue={() => addToQueue(track)}
                    showDownload={false}
                  />
                ))}
              </Section>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ── Section wrapper ────────────────────────────────────────────────────────

function Section({
  title, subtitle, children, colors, action,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  colors: ReturnType<typeof useColors>;
  action?: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{title}</Text>
        {action}
      </View>
      {subtitle && (
        <Text style={[styles.sectionSub, { color: colors.mutedForeground }]}>{subtitle}</Text>
      )}
      {children}
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  greeting: {
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  wordmark: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: 8,
  },
  artistChipsRow: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    flexDirection: 'row',
    gap: 8,
  },
  artistChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    gap: 5,
  },
  artistChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  moodRow: {
    paddingHorizontal: 16,
    paddingBottom: 18,
    flexDirection: 'row',
  },
  chip: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  loader: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  section: {
    marginBottom: 28,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  sectionSub: {
    fontSize: 12,
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  artistRow: {
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  discoverHint: {
    fontSize: 11,
    paddingHorizontal: 20,
    marginTop: 10,
    textAlign: 'center',
  },
  playAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginLeft: 20,
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  playAllText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
});
