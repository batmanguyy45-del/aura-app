import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet,
  Dimensions, Platform, PanResponder, ScrollView,
  Modal, TextInput, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat,
  withSequence, withTiming, Easing,
} from 'react-native-reanimated';
import { useAppTheme } from '@/hooks/useAppTheme';
import { usePlayer } from '@/contexts/PlayerContext';
import { useSkin } from '@/contexts/SkinContext';
import { useLibrary } from '@/contexts/LibraryContext';
import { WaveformVisualizer } from '@/components/WaveformVisualizer';
import { getApiBase } from '@/constants/api';

const { width: W } = Dimensions.get('window');

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

type Panel = 'none' | 'lyrics' | 'eq' | 'queue';

export default function PlayerScreen() {
  const colors = useAppTheme();
  const insets = useSafeAreaInsets();
  const { skin } = useSkin();
  const {
    currentTrack, isPlaying, position, duration,
    queue, queueIndex, shuffle, repeatMode, eqSettings, isLoading, autoQueueActive,
    pause, resume, seek, next, prev, toggleShuffle, toggleRepeat,
    addToQueue, removeFromQueue, updateEQ, playAtIndex,
  } = usePlayer();
  const { likedIds, toggleLike, playlists, createPlaylist, addToPlaylist } = useLibrary();

  const [panel, setPanel] = useState<Panel>('none');
  const [lyrics, setLyrics] = useState('');
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Playlist modal
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [creatingPlaylist, setCreatingPlaylist] = useState(false);

  const progress = duration > 0 ? Math.min(position / duration, 1) : 0;
  const isLiked = currentTrack ? likedIds.has(currentTrack.id) : false;

  // Float animation
  const floatAnim = useSharedValue(0);
  const artStyle = useAnimatedStyle(() => ({ transform: [{ translateY: floatAnim.value }] }));

  useEffect(() => {
    if (isPlaying) {
      floatAnim.value = withRepeat(
        withSequence(
          withTiming(-7, { duration: 1600, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 1600, easing: Easing.inOut(Easing.ease) })
        ), -1, true
      );
    } else {
      floatAnim.value = withTiming(0, { duration: 400 });
    }
  }, [isPlaying]);

  const fetchLyrics = async () => {
    if (!currentTrack) return;
    setLyricsLoading(true);
    try {
      const resp = await fetch(
        `${getApiBase()}/lyrics?title=${encodeURIComponent(currentTrack.title)}&artist=${encodeURIComponent(currentTrack.artist)}`
      );
      const data = await resp.json() as { lyrics: string };
      setLyrics(data.lyrics || 'No lyrics found.');
    } catch {
      setLyrics('Could not load lyrics.');
    }
    setLyricsLoading(false);
  };

  const handleDownload = useCallback(async () => {
    if (!currentTrack || downloading) return;
    setDownloading(true);
    try {
      const resp = await fetch(`${getApiBase()}/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId: currentTrack.id, quality: 'audio-only' }),
      });
      if (resp.ok) {
        Alert.alert('Download Started', `"${currentTrack.title}" is downloading to your library.`);
      } else {
        Alert.alert('Download Failed', 'Could not start download. Try again.');
      }
    } catch {
      Alert.alert('Download Failed', 'Network error. Please try again.');
    }
    setDownloading(false);
  }, [currentTrack, downloading]);

  const handleAddToPlaylist = useCallback((playlistId: string) => {
    if (!currentTrack) return;
    addToPlaylist(playlistId, currentTrack.id);
    setShowPlaylistModal(false);
    Alert.alert('Added!', `Added to playlist.`);
  }, [currentTrack, addToPlaylist]);

  const handleCreateAndAdd = useCallback(() => {
    if (!newPlaylistName.trim() || !currentTrack) return;
    createPlaylist(newPlaylistName.trim());
    setCreatingPlaylist(false);
    setNewPlaylistName('');
    setShowPlaylistModal(false);
    Alert.alert('Created!', `Playlist "${newPlaylistName.trim()}" created and track added.`);
  }, [newPlaylistName, currentTrack, createPlaylist]);

  const handleSaveQueueAsPlaylist = useCallback(() => {
    setShowPlaylistModal(true);
  }, []);

  const togglePanel = (p: Panel) => {
    if (p === 'lyrics' && panel !== 'lyrics') fetchLyrics();
    setPanel(prev => prev === p ? 'none' : p);
  };

  const scrubberWidth = W - 48;
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const pct = Math.max(0, Math.min(1, evt.nativeEvent.locationX / scrubberWidth));
        seek(pct * duration);
      },
      onPanResponderMove: (evt) => {
        const pct = Math.max(0, Math.min(1, evt.nativeEvent.locationX / scrubberWidth));
        seek(pct * duration);
      },
    })
  ).current;

  const topPad = Platform.OS === 'web' ? 67 : insets.top + 8;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom + 8;
  const artSize = W * 0.68;

  if (!currentTrack) {
    return (
      <LinearGradient
        colors={[skin.backgroundColor, '#0D0D2A', skin.backgroundColor]}
        style={[styles.screen, { paddingTop: topPad }]}
      >
        <View style={styles.empty}>
          <Ionicons name="musical-notes-outline" size={80} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>NOTHING PLAYING</Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Search for a track or browse trending music{'\n'}to get started
          </Text>
        </View>
      </LinearGradient>
    );
  }

  const upcomingTracks = queue.slice(queueIndex + 1, queueIndex + 51);

  return (
    <View style={[styles.screen, { backgroundColor: skin.backgroundColor }]}>
      <LinearGradient
        colors={[skin.accentPrimary + '22', skin.backgroundColor, skin.accentSecondary + '11']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
      />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: topPad, paddingBottom: botPad + 60 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Album art ────────────────────────────────────────────────── */}
        <View style={styles.artWrap}>
          <Animated.View style={artStyle}>
            {currentTrack.thumbnail ? (
              <Image
                source={{ uri: currentTrack.thumbnail }}
                style={[styles.art, {
                  width: artSize, height: artSize,
                  borderRadius:
                    skin.albumArtShape === 'circle' ? artSize / 2 :
                    skin.albumArtShape === 'square' ? 8 : 24,
                  shadowColor: skin.accentPrimary,
                  shadowOffset: { width: 0, height: 12 },
                  shadowOpacity: skin.albumArtGlow ? 0.65 : 0.2,
                  shadowRadius: 28,
                }]}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.artPlaceholder, { width: artSize, height: artSize, borderRadius: 24, backgroundColor: colors.muted }]}>
                <Ionicons name="musical-notes" size={80} color={skin.accentPrimary} />
              </View>
            )}
          </Animated.View>
        </View>

        {/* ── Waveform ─────────────────────────────────────────────────── */}
        <View style={styles.waveformRow}>
          <WaveformVisualizer isPlaying={isPlaying} color={skin.accentPrimary} height={32} />
        </View>

        {/* ── Track info ───────────────────────────────────────────────── */}
        <View style={styles.trackInfo}>
          <Text style={[styles.trackTitle, { color: skin.textColor, fontSize: 22 * skin.fontSizeScale }]} numberOfLines={2}>
            {currentTrack.title}
          </Text>
          <Text style={[styles.trackArtist, { color: skin.textColor + 'AA' }]} numberOfLines={1}>
            {currentTrack.artist}
          </Text>
        </View>

        {/* ── Progress scrubber ────────────────────────────────────────── */}
        <View style={styles.scrubberArea} {...panResponder.panHandlers}>
          <View style={[styles.scrubberTrack, { backgroundColor: colors.border }]}>
            <LinearGradient
              colors={[skin.progressStart, skin.progressEnd]}
              start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
              style={[styles.scrubberFill, { width: `${progress * 100}%` }]}
            />
            <View style={[styles.scrubberThumb, { left: `${progress * 100}%`, backgroundColor: skin.progressEnd }]} />
          </View>
          <View style={styles.timeRow}>
            <Text style={[styles.timeText, { color: skin.textColor + '99' }]}>{formatTime(position)}</Text>
            <Text style={[styles.timeText, { color: skin.textColor + '99' }]}>{formatTime(duration)}</Text>
          </View>
        </View>

        {/* ── Secondary controls ───────────────────────────────────────── */}
        <View style={styles.secondaryControls}>
          <TouchableOpacity onPress={toggleShuffle} style={styles.iconBtn} hitSlop={8}>
            <Ionicons name="shuffle" size={22} color={shuffle ? skin.accentPrimary : skin.textColor + '55'} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => currentTrack && toggleLike(currentTrack.id, currentTrack.title, currentTrack.artist, currentTrack.thumbnail ?? '', (currentTrack as any).duration ?? 0)}
            style={styles.iconBtn} hitSlop={8}
          >
            <Ionicons name={isLiked ? 'heart' : 'heart-outline'} size={24} color={isLiked ? skin.accentSecondary : skin.textColor + '55'} />
          </TouchableOpacity>

          <TouchableOpacity onPress={handleDownload} style={styles.iconBtn} hitSlop={8}>
            <Ionicons name={downloading ? 'ellipsis-horizontal' : 'download-outline'} size={22} color={downloading ? skin.accentPrimary : skin.textColor + '55'} />
          </TouchableOpacity>

          <TouchableOpacity onPress={handleSaveQueueAsPlaylist} style={styles.iconBtn} hitSlop={8}>
            <Ionicons name="add-circle-outline" size={22} color={skin.textColor + '55'} />
          </TouchableOpacity>

          <TouchableOpacity onPress={toggleRepeat} style={styles.iconBtn} hitSlop={8}>
            <Ionicons
              name={repeatMode === 'one' ? 'repeat-sharp' : 'repeat'}
              size={22}
              color={repeatMode !== 'off' ? skin.accentPrimary : skin.textColor + '55'}
            />
            {repeatMode === 'one' && (
              <Text style={[styles.repeatOneLabel, { color: skin.accentPrimary }]}>1</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* ── Primary controls ─────────────────────────────────────────── */}
        <View style={styles.primaryControls}>
          <TouchableOpacity onPress={prev} style={styles.controlBtn} hitSlop={12}>
            <Ionicons name="play-skip-back" size={34} color={skin.textColor} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={isPlaying ? pause : resume}
            style={[styles.playBtn, { backgroundColor: skin.accentPrimary, shadowColor: skin.accentPrimary }]}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <Ionicons name="ellipsis-horizontal" size={32} color="#fff" />
            ) : (
              <Ionicons name={isPlaying ? 'pause' : 'play'} size={34} color="#fff" style={{ marginLeft: isPlaying ? 0 : 3 }} />
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={next} style={styles.controlBtn} hitSlop={12}>
            <Ionicons name="play-skip-forward" size={34} color={skin.textColor} />
          </TouchableOpacity>
        </View>

        {/* ── Panel toggles ────────────────────────────────────────────── */}
        <View style={styles.panelButtons}>
          {([
            ['lyrics', 'text-outline', 'Lyrics'],
            ['eq', 'options-outline', 'EQ'],
            ['queue', 'list-outline', `Queue (${Math.max(0, queue.length - queueIndex - 1)})`],
          ] as const).map(([p, icon, label]) => (
            <TouchableOpacity
              key={p}
              onPress={() => togglePanel(p)}
              style={[
                styles.panelBtn,
                {
                  backgroundColor: panel === p ? skin.accentPrimary + '33' : 'transparent',
                  borderColor: panel === p ? skin.accentPrimary : skin.textColor + '22',
                },
              ]}
              hitSlop={6}
            >
              <Ionicons name={icon as any} size={16} color={panel === p ? skin.accentPrimary : skin.textColor + '77'} />
              <Text style={[styles.panelBtnLabel, { color: panel === p ? skin.accentPrimary : skin.textColor + '66' }]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Lyrics panel ─────────────────────────────────────────────── */}
        {panel === 'lyrics' && (
          <View style={[styles.panel, { backgroundColor: colors.card + 'EE', borderColor: colors.border }]}>
            <Text style={[styles.panelTitle, { color: colors.foreground }]}>Lyrics</Text>
            {lyricsLoading ? (
              <Text style={[styles.lyricsText, { color: colors.mutedForeground }]}>Loading…</Text>
            ) : (
              <ScrollView style={{ maxHeight: 300 }} nestedScrollEnabled>
                <Text style={[styles.lyricsText, { color: colors.foreground }]}>{lyrics}</Text>
              </ScrollView>
            )}
          </View>
        )}

        {/* ── EQ panel ─────────────────────────────────────────────────── */}
        {panel === 'eq' && (
          <EQPanel eqSettings={eqSettings} updateEQ={updateEQ} skin={skin} colors={colors} />
        )}

        {/* ── Queue panel ───────────────────────────────────────────────── */}
        {panel === 'queue' && (
          <View style={[styles.panel, { backgroundColor: colors.card + 'EE', borderColor: colors.border }]}>
            <View style={styles.queueHeader}>
              <Text style={[styles.panelTitle, { color: colors.foreground }]}>
                Up Next · {upcomingTracks.length} tracks
              </Text>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                {autoQueueActive && (
                  <View style={[styles.autoBadge, { backgroundColor: skin.accentPrimary + '33', borderColor: skin.accentPrimary + '66' }]}>
                    <Ionicons name="radio-outline" size={11} color={skin.accentPrimary} />
                    <Text style={[styles.autoBadgeText, { color: skin.accentPrimary }]}>Radio</Text>
                  </View>
                )}
                <TouchableOpacity onPress={handleSaveQueueAsPlaylist} hitSlop={8}>
                  <Ionicons name="save-outline" size={18} color={skin.accentPrimary} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Now playing indicator */}
            <View style={[styles.queueItem, styles.nowPlayingItem, { backgroundColor: skin.accentPrimary + '18', borderColor: skin.accentPrimary + '44' }]}>
              <WaveformVisualizer isPlaying={isPlaying} color={skin.accentPrimary} height={18} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.queueTitle, { color: skin.accentPrimary }]} numberOfLines={1}>{currentTrack.title}</Text>
                <Text style={[styles.queueArtist, { color: colors.mutedForeground }]} numberOfLines={1}>{currentTrack.artist}</Text>
              </View>
            </View>

            {upcomingTracks.length === 0 && (
              <Text style={[styles.lyricsText, { color: colors.mutedForeground }]}>Fetching suggestions…</Text>
            )}

            {/* Tappable queue items */}
            {upcomingTracks.map((t, i) => {
              const globalIdx = queueIndex + 1 + i;
              return (
                <TouchableOpacity
                  key={t.id + globalIdx}
                  onPress={() => playAtIndex(globalIdx)}
                  style={[styles.queueItem]}
                  activeOpacity={0.65}
                >
                  <Text style={[styles.queueNum, { color: colors.mutedForeground }]}>{i + 1}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.queueTitle, { color: colors.foreground }]} numberOfLines={1}>{t.title}</Text>
                    <Text style={[styles.queueArtist, { color: colors.mutedForeground }]} numberOfLines={1}>{t.artist}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={(e) => { e.stopPropagation?.(); removeFromQueue(globalIdx); }}
                    hitSlop={10}
                    style={{ padding: 4 }}
                  >
                    <Ionicons name="close" size={16} color={colors.mutedForeground} />
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* ── Add to Playlist modal ─────────────────────────────────────── */}
      <Modal visible={showPlaylistModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Add to Playlist</Text>
            <Text style={[styles.modalSub, { color: colors.mutedForeground }]} numberOfLines={1}>
              {currentTrack?.title}
            </Text>

            <ScrollView style={{ maxHeight: 220 }}>
              {playlists.map(pl => (
                <TouchableOpacity
                  key={pl.id}
                  onPress={() => handleAddToPlaylist(pl.id)}
                  style={[styles.playlistItem, { borderColor: colors.border }]}
                >
                  <Ionicons name="musical-notes-outline" size={18} color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.playlistItemName, { color: colors.foreground }]}>{pl.name}</Text>
                    <Text style={[styles.playlistItemCount, { color: colors.mutedForeground }]}>
                      {pl.trackIds.length} tracks
                    </Text>
                  </View>
                  <Ionicons name="add" size={18} color={colors.primary} />
                </TouchableOpacity>
              ))}
            </ScrollView>

            {creatingPlaylist ? (
              <View style={{ gap: 10 }}>
                <TextInput
                  value={newPlaylistName}
                  onChangeText={setNewPlaylistName}
                  placeholder="Playlist name..."
                  placeholderTextColor={colors.mutedForeground}
                  style={[styles.playlistInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.muted }]}
                  autoFocus
                />
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity
                    onPress={() => { setCreatingPlaylist(false); setNewPlaylistName(''); }}
                    style={[styles.modalBtn, { backgroundColor: colors.muted }]}
                  >
                    <Text style={{ color: colors.mutedForeground, fontWeight: '600' }}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleCreateAndAdd}
                    style={[styles.modalBtn, { backgroundColor: colors.primary }]}
                  >
                    <Text style={{ color: '#fff', fontWeight: '600' }}>Create & Add</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => setCreatingPlaylist(true)}
                style={[styles.newPlaylistBtn, { borderColor: colors.primary }]}
              >
                <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
                <Text style={[styles.newPlaylistText, { color: colors.primary }]}>New Playlist</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={() => { setShowPlaylistModal(false); setCreatingPlaylist(false); setNewPlaylistName(''); }}
              style={[styles.modalCloseBtn, { backgroundColor: colors.muted }]}
            >
              <Text style={{ color: colors.mutedForeground, fontWeight: '600', textAlign: 'center' }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── EQ Panel ─────────────────────────────────────────────────────────────────

function EQPanel({ eqSettings, updateEQ, skin, colors }: {
  eqSettings: ReturnType<typeof usePlayer>['eqSettings'];
  updateEQ: ReturnType<typeof usePlayer>['updateEQ'];
  skin: ReturnType<typeof useSkin>['skin'];
  colors: ReturnType<typeof useAppTheme>;
}) {
  const EQ_MAX = 12;
  return (
    <View style={[styles.panel, { backgroundColor: colors.card + 'EE', borderColor: colors.border }]}>
      <Text style={[styles.panelTitle, { color: colors.foreground }]}>Equalizer</Text>
      <View style={styles.eqRow}>
        {eqSettings.bands.map((band, i) => (
          <View key={band.frequency} style={styles.eqBand}>
            <Text style={[styles.eqGain, { color: colors.mutedForeground }]}>
              {band.gain > 0 ? `+${band.gain}` : band.gain}
            </Text>
            <View style={[styles.eqTrack, { backgroundColor: colors.border }]}>
              <TouchableOpacity
                onPress={() => {
                  const b = [...eqSettings.bands];
                  b[i] = { ...band, gain: Math.min(EQ_MAX, band.gain + 1) };
                  updateEQ({ bands: b });
                }}
                style={styles.eqArrow}
              >
                <Ionicons name="chevron-up" size={12} color={colors.mutedForeground} />
              </TouchableOpacity>
              <View style={[styles.eqFill, {
                height: `${((band.gain + EQ_MAX) / (EQ_MAX * 2)) * 100}%`,
                backgroundColor: skin.accentPrimary,
              }]} />
              <TouchableOpacity
                onPress={() => {
                  const b = [...eqSettings.bands];
                  b[i] = { ...band, gain: Math.max(-EQ_MAX, band.gain - 1) };
                  updateEQ({ bands: b });
                }}
                style={styles.eqArrow}
              >
                <Ionicons name="chevron-down" size={12} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.eqFreq, { color: colors.mutedForeground }]}>
              {band.frequency >= 1000 ? `${band.frequency / 1000}k` : `${band.frequency}`}
            </Text>
          </View>
        ))}
      </View>
      <View style={styles.eqToggles}>
        {[
          { label: 'Bass Boost', key: 'bassBoost' as const },
          { label: 'Treble Boost', key: 'trebleBoost' as const },
        ].map(({ label, key }) => (
          <TouchableOpacity
            key={key}
            onPress={() => updateEQ({ [key]: !eqSettings[key] })}
            style={[styles.eqToggle, {
              backgroundColor: eqSettings[key] ? skin.accentPrimary : colors.muted,
              borderColor: eqSettings[key] ? skin.accentPrimary : colors.border,
            }]}
          >
            <Text style={[styles.eqToggleText, { color: eqSettings[key] ? '#fff' : colors.mutedForeground }]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 24, alignItems: 'center', gap: 20 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32 },
  emptyTitle: { fontSize: 20, fontWeight: '800', letterSpacing: 4 },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 22 },
  artWrap: { alignItems: 'center', paddingTop: 12 },
  art: { elevation: 20 },
  artPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  waveformRow: { width: '100%', alignItems: 'center', paddingHorizontal: 16 },
  trackInfo: { alignItems: 'center', gap: 6, width: '100%' },
  trackTitle: { fontWeight: '800', letterSpacing: 0.3, textAlign: 'center', lineHeight: 28 },
  trackArtist: { fontSize: 15, textAlign: 'center' },
  scrubberArea: { width: '100%', gap: 8 },
  scrubberTrack: { height: 4, borderRadius: 4, overflow: 'visible', position: 'relative' },
  scrubberFill: { position: 'absolute', left: 0, top: 0, height: '100%', borderRadius: 4 },
  scrubberThumb: { position: 'absolute', width: 14, height: 14, borderRadius: 7, top: -5, marginLeft: -7 },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between' },
  timeText: { fontSize: 12 },
  secondaryControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingHorizontal: 4 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  repeatOneLabel: { fontSize: 9, fontWeight: '900', position: 'absolute', bottom: 4, right: 8 },
  primaryControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 32, width: '100%' },
  controlBtn: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  playBtn: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.55, shadowRadius: 16, elevation: 12 },
  panelButtons: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  panelBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, gap: 5 },
  panelBtnLabel: { fontSize: 12, fontWeight: '600' },
  panel: { width: '100%', borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  panelTitle: { fontSize: 15, fontWeight: '700' },
  lyricsText: { fontSize: 15, lineHeight: 24 },
  queueHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  autoBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, borderWidth: 1 },
  autoBadgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  nowPlayingItem: { borderRadius: 10, borderWidth: 1, paddingVertical: 10, paddingHorizontal: 10, gap: 10 },
  queueItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 4, borderRadius: 8, gap: 10 },
  queueNum: { fontSize: 12, fontWeight: '700', width: 18, textAlign: 'center' },
  queueTitle: { fontSize: 13, fontWeight: '600' },
  queueArtist: { fontSize: 11 },
  eqRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', height: 130, gap: 2 },
  eqBand: { flex: 1, alignItems: 'center', height: '100%', gap: 4 },
  eqGain: { fontSize: 8 },
  eqTrack: { flex: 1, width: 18, borderRadius: 4, overflow: 'hidden', alignItems: 'center', justifyContent: 'flex-end', position: 'relative' },
  eqFill: { width: '100%', borderRadius: 4 },
  eqArrow: { width: '100%', alignItems: 'center', paddingVertical: 2 },
  eqFreq: { fontSize: 8 },
  eqToggles: { flexDirection: 'row', gap: 10 },
  eqToggle: { flex: 1, paddingVertical: 8, borderRadius: 8, borderWidth: 1, alignItems: 'center' },
  eqToggleText: { fontSize: 12, fontWeight: '700' },
  // Playlist modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modalCard: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderBottomWidth: 0, padding: 20, gap: 14, paddingBottom: 36 },
  modalTitle: { fontSize: 18, fontWeight: '800' },
  modalSub: { fontSize: 13, marginTop: -8 },
  playlistItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1 },
  playlistItemName: { fontSize: 14, fontWeight: '600' },
  playlistItemCount: { fontSize: 11 },
  newPlaylistBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5 },
  newPlaylistText: { fontSize: 14, fontWeight: '700' },
  playlistInput: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 15 },
  modalBtn: { flex: 1, padding: 12, borderRadius: 10, alignItems: 'center' },
  modalCloseBtn: { padding: 12, borderRadius: 10, marginTop: 4 },
});
