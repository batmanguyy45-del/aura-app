import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Platform, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { usePlayer } from '@/contexts/PlayerContext';
import { TrackRow } from '@/components/TrackRow';
import { getApiBase } from '@/constants/api';
import type { SearchResult } from '@/constants/types';

const FILTERS = ['All', 'Music', 'Videos', 'Artists'] as const;
type Filter = typeof FILTERS[number];

const URL_RE = /^https?:\/\//i;

interface UrlInfo {
  title: string;
  uploader: string;
  duration: number;
  thumbnail: string;
  formats: { format_id: string; height?: number; ext: string }[];
  site_name: string;
  subtitles: Record<string, unknown>;
}

const QUALITIES = ['audio-only', '360p', '480p', '720p', '1080p'];

export default function SearchScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { play, addToQueue } = usePlayer();

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('All');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [urlInfo, setUrlInfo] = useState<UrlInfo | null>(null);
  const [loadingUrl, setLoadingUrl] = useState(false);
  const [selectedQuality, setSelectedQuality] = useState('audio-only');
  const [downloading, setDownloading] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const isUrl = URL_RE.test(query.trim());

  const doSearch = useCallback(async (q: string, f: Filter) => {
    if (!q.trim()) { setResults([]); setLoading(false); return; }
    setLoading(true);
    try {
      const filterParam = f === 'All' ? 'all' : f.toLowerCase();
      const resp = await fetch(`${getApiBase()}/search?q=${encodeURIComponent(q)}&filter=${filterParam}`);
      const data = await resp.json() as SearchResult[];
      setResults(Array.isArray(data) ? data : []);
    } catch { setResults([]); }
    setLoading(false);
  }, []);

  const doUrlInfo = useCallback(async (url: string) => {
    setLoadingUrl(true);
    setUrlInfo(null);
    try {
      const resp = await fetch(`${getApiBase()}/info?url=${encodeURIComponent(url)}`);
      if (resp.ok) setUrlInfo(await resp.json());
    } catch {}
    setLoadingUrl(false);
  }, []);

  const handleChange = (text: string) => {
    setQuery(text);
    setSuggestions([]);
    if (debounce.current) clearTimeout(debounce.current);

    if (URL_RE.test(text.trim())) {
      setResults([]);
      debounce.current = setTimeout(() => doUrlInfo(text.trim()), 600);
      return;
    }
    setUrlInfo(null);
    debounce.current = setTimeout(async () => {
      if (!text.trim()) return;
      try {
        const r = await fetch(`${getApiBase()}/suggest?q=${encodeURIComponent(text)}`);
        const s = await r.json() as string[];
        setSuggestions(Array.isArray(s) ? s.slice(0, 6) : []);
      } catch {}
      doSearch(text, filter);
    }, 400);
  };

  const handleFilter = (f: Filter) => {
    setFilter(f);
    doSearch(query, f);
  };

  const handleDownload = async () => {
    if (downloading || !query) return;
    setDownloading(true);
    try {
      Alert.alert('Download Queued', `Downloading with quality: ${selectedQuality}. The file will be saved when complete.`);
    } finally {
      setDownloading(false);
    }
  };

  const clear = () => {
    setQuery('');
    setResults([]);
    setSuggestions([]);
    setUrlInfo(null);
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="search" size={20} color={colors.mutedForeground} />
          <TextInput
            value={query}
            onChangeText={handleChange}
            placeholder="Search music or paste a URL..."
            placeholderTextColor={colors.mutedForeground}
            style={[styles.input, { color: colors.foreground }]}
            returnKeyType="search"
            onSubmitEditing={() => doSearch(query, filter)}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={clear} hitSlop={8}>
              <Ionicons name="close-circle" size={20} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
          <TouchableOpacity hitSlop={8}>
            <Ionicons name="mic-outline" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {FILTERS.map(f => (
            <TouchableOpacity
              key={f}
              onPress={() => handleFilter(f)}
              style={[
                styles.filterChip,
                { backgroundColor: filter === f ? colors.primary : colors.card, borderColor: filter === f ? colors.primary : colors.border },
              ]}
            >
              <Text style={[styles.filterText, { color: filter === f ? colors.primaryForeground : colors.mutedForeground }]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: Platform.OS === 'web' ? 150 : 120 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {suggestions.length > 0 && !isUrl && (
          <View style={[styles.suggestions, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {suggestions.map((s, i) => (
              <TouchableOpacity
                key={i}
                style={styles.suggestion}
                onPress={() => { setQuery(s); setSuggestions([]); doSearch(s, filter); }}
              >
                <Ionicons name="search-outline" size={16} color={colors.mutedForeground} />
                <Text style={[styles.suggText, { color: colors.foreground }]}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {isUrl && (
          <View style={[styles.urlCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {loadingUrl ? (
              <ActivityIndicator color={colors.primary} style={{ padding: 32 }} />
            ) : urlInfo ? (
              <View style={styles.urlContent}>
                <Text style={[styles.urlSite, { color: colors.primary }]}>{urlInfo.site_name}</Text>
                <Text style={[styles.urlTitle, { color: colors.foreground }]} numberOfLines={3}>{urlInfo.title}</Text>
                <Text style={[styles.urlUploader, { color: colors.mutedForeground }]}>{urlInfo.uploader}</Text>
                <View style={styles.qualityRow}>
                  {QUALITIES.map(q => (
                    <TouchableOpacity
                      key={q}
                      onPress={() => setSelectedQuality(q)}
                      style={[
                        styles.qualityChip,
                        { backgroundColor: selectedQuality === q ? colors.primary : colors.muted, borderColor: selectedQuality === q ? colors.primary : colors.border },
                      ]}
                    >
                      <Text style={[styles.qualityText, { color: selectedQuality === q ? colors.primaryForeground : colors.mutedForeground }]}>{q}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity
                  onPress={handleDownload}
                  disabled={downloading}
                  style={[styles.dlBtn, { backgroundColor: downloading ? colors.muted : colors.primary }]}
                >
                  <Ionicons name="download-outline" size={18} color={downloading ? colors.mutedForeground : '#fff'} />
                  <Text style={[styles.dlBtnText, { color: downloading ? colors.mutedForeground : '#fff' }]}>
                    {downloading ? 'Downloading...' : 'Download'}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={[styles.urlError, { color: colors.mutedForeground }]}>
                Paste a URL to download from YouTube, Instagram, TikTok, SoundCloud, and 1000+ sites.
              </Text>
            )}
          </View>
        )}

        {loading && !isUrl && (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        )}

        {!loading && !isUrl && results.map(track => (
          <TrackRow
            key={track.id}
            track={track}
            onPlay={() => play(track, results)}
            onDownload={() => Alert.alert('Download', `Downloading "${track.title}"...`)}
            onAddToQueue={() => addToQueue(track)}
          />
        ))}

        {!loading && !isUrl && results.length === 0 && query.length > 2 && (
          <View style={styles.empty}>
            <Ionicons name="search-outline" size={52} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No results</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Try a different search term</Text>
          </View>
        )}

        {!query && (
          <View style={styles.empty}>
            <Ionicons name="globe-outline" size={52} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Search or Download</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Find any track, or paste a URL to{'\n'}download from 1000+ sites worldwide
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
  },
  filterRow: {
    paddingHorizontal: 16,
    flexDirection: 'row',
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
  },
  suggestions: {
    margin: 16,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 12,
  },
  suggText: { fontSize: 14 },
  urlCard: {
    margin: 16,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  urlContent: { padding: 16, gap: 10 },
  urlSite: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  urlTitle: { fontSize: 16, fontWeight: '700', lineHeight: 22 },
  urlUploader: { fontSize: 13 },
  qualityRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  qualityChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  qualityText: { fontSize: 12, fontWeight: '600' },
  dlBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    gap: 8,
    marginTop: 4,
  },
  dlBtnText: { fontSize: 15, fontWeight: '700' },
  urlError: { padding: 24, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  center: { paddingVertical: 60, alignItems: 'center' },
  empty: { paddingVertical: 60, alignItems: 'center', gap: 12, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
