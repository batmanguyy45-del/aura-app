import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Platform, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useSkin } from '@/contexts/SkinContext';
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
  const colors = useAppTheme();
  const { skin } = useSkin();
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

  const handleFilter = (f: Filter) => { setFilter(f); doSearch(query, f); };

  const handleDownload = async () => {
    if (downloading || !urlInfo) return;
    setDownloading(true);
    try {
      const resp = await fetch(`${getApiBase()}/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: query.trim(), quality: selectedQuality }),
      });
      if (resp.ok) {
        Alert.alert('Download Started', `"${urlInfo.title}" is downloading in ${selectedQuality}.`);
      } else {
        Alert.alert('Download Failed', 'Could not start download.');
      }
    } catch {
      Alert.alert('Download Failed', 'Network error, please try again.');
    }
    setDownloading(false);
  };

  const clear = () => { setQuery(''); setResults([]); setSuggestions([]); setUrlInfo(null); };

  return (
    <View style={[styles.screen, { backgroundColor: skin.backgroundColor }]}>
      <LinearGradient
        colors={[skin.accentPrimary + '14', skin.backgroundColor]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.25 }}
      />

      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: skin.textColor + '18', backgroundColor: skin.backgroundColor + 'F0' }]}>
        <View style={[styles.searchBar, { backgroundColor: skin.textColor + '0C', borderColor: skin.textColor + '20' }]}>
          <Ionicons name="search" size={20} color={skin.textColor + '66'} />
          <TextInput
            value={query}
            onChangeText={handleChange}
            placeholder="Search music or paste a URL..."
            placeholderTextColor={skin.textColor + '44'}
            style={[styles.input, { color: skin.textColor }]}
            returnKeyType="search"
            onSubmitEditing={() => doSearch(query, filter)}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={clear} hitSlop={8}>
              <Ionicons name="close-circle" size={20} color={skin.textColor + '55'} />
            </TouchableOpacity>
          )}
          <TouchableOpacity hitSlop={8}>
            <Ionicons name="mic-outline" size={20} color={skin.accentPrimary} />
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {FILTERS.map(f => (
            <TouchableOpacity
              key={f}
              onPress={() => handleFilter(f)}
              style={[styles.filterChip, {
                backgroundColor: filter === f ? skin.accentPrimary : skin.textColor + '10',
                borderColor: filter === f ? skin.accentPrimary : skin.textColor + '20',
              }]}
            >
              <Text style={[styles.filterText, { color: filter === f ? '#fff' : skin.textColor + '88' }]}>{f}</Text>
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
          <View style={[styles.suggestions, { backgroundColor: skin.textColor + '0A', borderColor: skin.textColor + '18' }]}>
            {suggestions.map((s, i) => (
              <TouchableOpacity
                key={i}
                style={styles.suggestion}
                onPress={() => { setQuery(s); setSuggestions([]); doSearch(s, filter); }}
              >
                <Ionicons name="search-outline" size={16} color={skin.textColor + '55'} />
                <Text style={[styles.suggText, { color: skin.textColor }]}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {isUrl && (
          <View style={[styles.urlCard, { backgroundColor: skin.textColor + '08', borderColor: skin.textColor + '18' }]}>
            {loadingUrl ? (
              <ActivityIndicator color={skin.accentPrimary} style={{ padding: 32 }} />
            ) : urlInfo ? (
              <View style={styles.urlContent}>
                <Text style={[styles.urlSite, { color: skin.accentPrimary }]}>{urlInfo.site_name}</Text>
                <Text style={[styles.urlTitle, { color: skin.textColor }]} numberOfLines={3}>{urlInfo.title}</Text>
                <Text style={[styles.urlUploader, { color: skin.textColor + '77' }]}>{urlInfo.uploader}</Text>
                <View style={styles.qualityRow}>
                  {QUALITIES.map(q => (
                    <TouchableOpacity
                      key={q}
                      onPress={() => setSelectedQuality(q)}
                      style={[styles.qualityChip, {
                        backgroundColor: selectedQuality === q ? skin.accentPrimary : skin.textColor + '10',
                        borderColor: selectedQuality === q ? skin.accentPrimary : skin.textColor + '20',
                      }]}
                    >
                      <Text style={[styles.qualityText, { color: selectedQuality === q ? '#fff' : skin.textColor + '77' }]}>{q}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity
                  onPress={handleDownload}
                  disabled={downloading}
                  style={[styles.dlBtn, { backgroundColor: downloading ? skin.textColor + '20' : skin.accentPrimary }]}
                >
                  <Ionicons name="download-outline" size={18} color={downloading ? skin.textColor + '55' : '#fff'} />
                  <Text style={[styles.dlBtnText, { color: downloading ? skin.textColor + '55' : '#fff' }]}>
                    {downloading ? 'Downloading...' : 'Download'}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={[styles.urlError, { color: skin.textColor + '66' }]}>
                Paste a URL to download from YouTube, Instagram, TikTok, SoundCloud, and 1000+ sites.
              </Text>
            )}
          </View>
        )}

        {loading && !isUrl && (
          <View style={styles.center}>
            <ActivityIndicator color={skin.accentPrimary} size="large" />
          </View>
        )}

        {!loading && !isUrl && results.map(track => (
          <TrackRow
            key={track.id}
            track={track}
            onPlay={() => play(track, results)}
            onDownload={() => {
              fetch(`${getApiBase()}/download`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ videoId: track.id, quality: 'audio-only' }),
              }).then(r => {
                if (r.ok) Alert.alert('Download Started', `"${track.title}" is downloading.`);
                else Alert.alert('Download Failed', 'Please try again.');
              }).catch(() => Alert.alert('Download Failed', 'Network error.'));
            }}
            onAddToQueue={() => addToQueue(track)}
          />
        ))}

        {!loading && !isUrl && results.length === 0 && query.length > 2 && (
          <View style={styles.empty}>
            <Ionicons name="search-outline" size={52} color={skin.textColor + '44'} />
            <Text style={[styles.emptyTitle, { color: skin.textColor }]}>No results</Text>
            <Text style={[styles.emptyText, { color: skin.textColor + '66' }]}>Try a different search term</Text>
          </View>
        )}

        {!query && (
          <View style={styles.empty}>
            <Ionicons name="globe-outline" size={52} color={skin.textColor + '33'} />
            <Text style={[styles.emptyTitle, { color: skin.textColor }]}>Search or Download</Text>
            <Text style={[styles.emptyText, { color: skin.textColor + '66' }]}>
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
  header: { paddingBottom: 12, borderBottomWidth: 1 },
  searchBar: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 12, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14, borderWidth: 1, gap: 10 },
  input: { flex: 1, fontSize: 15 },
  filterRow: { paddingHorizontal: 16, flexDirection: 'row' },
  filterChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, marginRight: 8 },
  filterText: { fontSize: 13, fontWeight: '600' },
  suggestions: { margin: 16, borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  suggestion: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, gap: 12 },
  suggText: { fontSize: 14 },
  urlCard: { margin: 16, borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  urlContent: { padding: 16, gap: 10 },
  urlSite: { fontSize: 11, fontWeight: '800', letterSpacing: 2, textTransform: 'uppercase' },
  urlTitle: { fontSize: 16, fontWeight: '700', lineHeight: 22 },
  urlUploader: { fontSize: 13 },
  qualityRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  qualityChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  qualityText: { fontSize: 12, fontWeight: '600' },
  dlBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 12, gap: 8, marginTop: 4 },
  dlBtnText: { fontSize: 15, fontWeight: '700' },
  urlError: { padding: 24, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  center: { paddingVertical: 60, alignItems: 'center' },
  empty: { paddingVertical: 60, alignItems: 'center', gap: 12, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
