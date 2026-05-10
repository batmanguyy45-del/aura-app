import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, FlatList, TouchableOpacity,
  StyleSheet, RefreshControl, ActivityIndicator, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { usePlayer } from '@/contexts/PlayerContext';
import { useLibrary } from '@/contexts/LibraryContext';
import { TrackCard } from '@/components/TrackCard';
import { TrackRow } from '@/components/TrackRow';
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
  const { history } = useLibrary();

  const [trending, setTrending] = useState<SearchResult[]>([]);
  const [related, setRelated] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [moodResults, setMoodResults] = useState<SearchResult[]>([]);
  const [moodLoading, setMoodLoading] = useState(false);

  const topPad = Platform.OS === 'web' ? 67 : insets.top + 8;

  const loadData = useCallback(async () => {
    try {
      const resp = await fetch(`${getApiBase()}/trending`);
      const data = await resp.json() as SearchResult[];
      setTrending(data);
      if (data.length > 0) {
        fetch(`${getApiBase()}/related/${data[0].id}`)
          .then(r => r.json())
          .then(setRelated)
          .catch(() => {});
      }
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleMood = async (mood: string) => {
    if (selectedMood === mood) {
      setSelectedMood(null);
      setMoodResults([]);
      return;
    }
    setSelectedMood(mood);
    setMoodLoading(true);
    try {
      const resp = await fetch(`${getApiBase()}/search?q=${encodeURIComponent(mood)}&filter=music`);
      const data = await resp.json() as SearchResult[];
      setMoodResults(data);
    } catch {}
    setMoodLoading(false);
  };

  const recentlyPlayed: SearchResult[] = history
    .filter((v, i, a) => a.findIndex(h => h.trackId === v.trackId) === i)
    .slice(0, 20)
    .map(h => ({ id: h.trackId, title: h.title, artist: h.artist, thumbnail: h.thumbnail, duration: h.duration }));

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
        <View style={styles.header}>
          <View>
            <Text style={[styles.greeting, { color: colors.mutedForeground }]}>{getGreeting()}</Text>
            <Text style={[styles.wordmark, { color: colors.foreground }]}>AURA</Text>
          </View>
        </View>

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
              <Text style={[styles.chipText, { color: selectedMood === mood ? colors.primaryForeground : colors.mutedForeground }]}>
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
            {selectedMood && (
              <Section title={`${selectedMood} Vibes`} colors={colors}>
                {moodLoading ? (
                  <ActivityIndicator color={colors.primary} style={{ padding: 24 }} />
                ) : (
                  <FlatList
                    horizontal
                    data={moodResults.slice(0, 12)}
                    keyExtractor={i => i.id}
                    renderItem={({ item }) => <TrackCard track={item} onPress={() => play(item, moodResults)} />}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 16 }}
                    scrollEnabled={moodResults.length > 0}
                  />
                )}
              </Section>
            )}

            {trending.length > 0 && (
              <Section title="Trending Now" colors={colors}>
                <FlatList
                  horizontal
                  data={trending.slice(0, 15)}
                  keyExtractor={i => i.id}
                  renderItem={({ item }) => <TrackCard track={item} onPress={() => play(item, trending)} />}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: 16 }}
                  scrollEnabled={!!trending.length}
                />
              </Section>
            )}

            {recentlyPlayed.length > 0 && (
              <Section title="Recently Played" colors={colors}>
                <FlatList
                  horizontal
                  data={recentlyPlayed}
                  keyExtractor={i => i.id}
                  renderItem={({ item }) => <TrackCard track={item} onPress={() => play(item, recentlyPlayed)} />}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: 16 }}
                  scrollEnabled={!!recentlyPlayed.length}
                />
              </Section>
            )}

            {related.length > 0 && (
              <Section title="You Might Like" colors={colors}>
                <FlatList
                  horizontal
                  data={related.slice(0, 10)}
                  keyExtractor={i => i.id}
                  renderItem={({ item }) => <TrackCard track={item} onPress={() => play(item, related)} />}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: 16 }}
                  scrollEnabled={!!related.length}
                />
              </Section>
            )}

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

function Section({
  title, children, colors,
}: {
  title: string;
  children: React.ReactNode;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    marginBottom: 18,
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.3,
    paddingHorizontal: 20,
    marginBottom: 14,
  },
});
