import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet,
  Dimensions, Platform, PanResponder, ScrollView, Modal, FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming,
  withSequence, Easing,
} from 'react-native-reanimated';
import { useColors } from '@/hooks/useColors';
import { usePlayer } from '@/contexts/PlayerContext';
import { useSkin } from '@/contexts/SkinContext';
import { useLibrary } from '@/contexts/LibraryContext';
import { getApiBase } from '@/constants/api';

const { width: W, height: H } = Dimensions.get('window');

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

type Panel = 'none' | 'lyrics' | 'eq' | 'queue';

export default function PlayerScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { skin } = useSkin();
  const {
    currentTrack, isPlaying, position, duration,
    queue, queueIndex, shuffle, repeatMode, eqSettings, isLoading,
    pause, resume, seek, next, prev, toggleShuffle, toggleRepeat,
    addToQueue, removeFromQueue, updateEQ,
  } = usePlayer();
  const { likedIds, toggleLike } = useLibrary();

  const [panel, setPanel] = useState<Panel>('none');
  const [lyrics, setLyrics] = useState('');
  const [lyricsLoading, setLyricsLoading] = useState(false);

  const progress = duration > 0 ? Math.min(position / duration, 1) : 0;
  const isLiked = currentTrack ? likedIds.has(currentTrack.id) : false;

  const floatAnim = useSharedValue(0);
  const artStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: floatAnim.value }],
  }));

  useEffect(() => {
    floatAnim.value = withRepeat(
      withSequence(
        withTiming(-6, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

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

  const togglePanel = (p: Panel) => {
    if (p === 'lyrics' && panel !== 'lyrics') fetchLyrics();
    setPanel(prev => prev === p ? 'none' : p);
  };

  const scrubberWidth = W - 48;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const x = evt.nativeEvent.locationX;
        const pct = Math.max(0, Math.min(1, x / scrubberWidth));
        seek(pct * duration);
      },
      onPanResponderMove: (evt) => {
        const x = evt.nativeEvent.locationX;
        const pct = Math.max(0, Math.min(1, x / scrubberWidth));
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
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Nothing Playing</Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Search for a track or browse trending music to get started
          </Text>
        </View>
      </LinearGradient>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: skin.backgroundColor }]}>
      <LinearGradient
        colors={[skin.accentPrimary + '22', skin.backgroundColor, skin.accentSecondary + '11']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
      />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: topPad, paddingBottom: botPad }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.artWrap}>
          <Animated.View style={artStyle}>
            {currentTrack.thumbnail ? (
              <Image
                source={{ uri: currentTrack.thumbnail }}
                style={[
                  styles.art,
                  {
                    width: artSize,
                    height: artSize,
                    borderRadius: skin.albumArtShape === 'circle' ? artSize / 2 : skin.albumArtShape === 'square' ? 8 : 24,
                    shadowColor: skin.accentPrimary,
                    shadowOffset: { width: 0, height: 12 },
                    shadowOpacity: skin.albumArtGlow ? 0.6 : 0.2,
                    shadowRadius: 24,
                  },
                ]}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.artPlaceholder, { width: artSize, height: artSize, borderRadius: 24, backgroundColor: colors.muted }]}>
                <Ionicons name="musical-notes" size={80} color={skin.accentPrimary} />
              </View>
            )}
          </Animated.View>
        </View>

        <View style={styles.trackInfo}>
          <Text style={[styles.trackTitle, { color: skin.textColor, fontSize: 22 * skin.fontSizeScale }]} numberOfLines={2}>
            {currentTrack.title}
          </Text>
          <Text style={[styles.trackArtist, { color: skin.textColor + 'AA' }]} numberOfLines={1}>
            {currentTrack.artist}
          </Text>
        </View>

        <View style={styles.scrubberArea} {...panResponder.panHandlers}>
          <View style={[styles.scrubberTrack, { backgroundColor: colors.border }]}>
            <LinearGradient
              colors={[skin.progressStart, skin.progressEnd]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={[styles.scrubberFill, { width: `${progress * 100}%` }]}
            />
            <View style={[
              styles.scrubberThumb,
              { left: `${progress * 100}%`, backgroundColor: skin.progressEnd }
            ]} />
          </View>
          <View style={styles.timeRow}>
            <Text style={[styles.timeText, { color: skin.textColor + '99' }]}>{formatTime(position)}</Text>
            <Text style={[styles.timeText, { color: skin.textColor + '99' }]}>{formatTime(duration)}</Text>
          </View>
        </View>

        <View style={styles.secondaryControls}>
          <TouchableOpacity onPress={toggleShuffle} style={styles.iconBtn} hitSlop={8}>
            <Ionicons name="shuffle" size={22} color={shuffle ? skin.accentPrimary : skin.textColor + '66'} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              if (currentTrack) {
                toggleLike(currentTrack.id, currentTrack.title, currentTrack.artist, currentTrack.thumbnail, currentTrack.duration);
              }
            }}
            style={styles.iconBtn}
            hitSlop={8}
          >
            <Ionicons name={isLiked ? 'heart' : 'heart-outline'} size={24} color={isLiked ? skin.accentSecondary : skin.textColor + '66'} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} hitSlop={8}>
            <Ionicons name="download-outline" size={22} color={skin.textColor + '66'} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} hitSlop={8}>
            <Ionicons name="bookmark-outline" size={22} color={skin.textColor + '66'} />
          </TouchableOpacity>
          <TouchableOpacity onPress={toggleRepeat} style={styles.iconBtn} hitSlop={8}>
            <Ionicons
              name={repeatMode === 'one' ? 'repeat-sharp' : 'repeat'}
              size={22}
              color={repeatMode !== 'off' ? skin.accentPrimary : skin.textColor + '66'}
            />
          </TouchableOpacity>
        </View>

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

        <View style={styles.panelButtons}>
          {([['lyrics', 'text-outline'], ['eq', 'options-outline'], ['queue', 'list-outline']] as const).map(([p, icon]) => (
            <TouchableOpacity
              key={p}
              onPress={() => togglePanel(p)}
              style={[
                styles.panelBtn,
                { backgroundColor: panel === p ? skin.accentPrimary + '33' : 'transparent', borderColor: panel === p ? skin.accentPrimary : skin.textColor + '22' }
              ]}
              hitSlop={6}
            >
              <Ionicons name={icon as any} size={20} color={panel === p ? skin.accentPrimary : skin.textColor + '77'} />
            </TouchableOpacity>
          ))}
        </View>

        {panel === 'lyrics' && (
          <View style={[styles.panel, { backgroundColor: colors.card + 'EE', borderColor: colors.border }]}>
            <Text style={[styles.panelTitle, { color: colors.foreground }]}>Lyrics</Text>
            {lyricsLoading ? (
              <Text style={[styles.lyricsText, { color: colors.mutedForeground }]}>Loading...</Text>
            ) : (
              <Text style={[styles.lyricsText, { color: colors.foreground }]}>{lyrics}</Text>
            )}
          </View>
        )}

        {panel === 'eq' && (
          <EQPanel eqSettings={eqSettings} updateEQ={updateEQ} skin={skin} colors={colors} />
        )}

        {panel === 'queue' && (
          <View style={[styles.panel, { backgroundColor: colors.card + 'EE', borderColor: colors.border }]}>
            <Text style={[styles.panelTitle, { color: colors.foreground }]}>Queue ({queue.length})</Text>
            {queue.map((t, i) => (
              <TouchableOpacity
                key={t.id + i}
                style={[styles.queueItem, i === queueIndex && { backgroundColor: skin.accentPrimary + '22' }]}
              >
                <Text style={[styles.queueNum, { color: i === queueIndex ? skin.accentPrimary : colors.mutedForeground }]}>{i + 1}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.queueTitle, { color: colors.foreground }]} numberOfLines={1}>{t.title}</Text>
                  <Text style={[styles.queueArtist, { color: colors.mutedForeground }]} numberOfLines={1}>{t.artist}</Text>
                </View>
                <TouchableOpacity onPress={() => removeFromQueue(i)} hitSlop={8}>
                  <Ionicons name="close" size={18} color={colors.mutedForeground} />
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
            {queue.length === 0 && (
              <Text style={[styles.lyricsText, { color: colors.mutedForeground }]}>Queue is empty</Text>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function EQPanel({ eqSettings, updateEQ, skin, colors }: {
  eqSettings: ReturnType<typeof usePlayer>['eqSettings'];
  updateEQ: ReturnType<typeof usePlayer>['updateEQ'];
  skin: ReturnType<typeof useSkin>['skin'];
  colors: ReturnType<typeof useColors>;
}) {
  const EQ_MAX = 12;
  return (
    <View style={[styles.panel, { backgroundColor: colors.card + 'EE', borderColor: colors.border }]}>
      <Text style={[styles.panelTitle, { color: colors.foreground }]}>EQ</Text>
      <View style={styles.eqRow}>
        {eqSettings.bands.map((band, i) => (
          <View key={band.frequency} style={styles.eqBand}>
            <Text style={[styles.eqGain, { color: colors.mutedForeground }]}>
              {band.gain > 0 ? `+${band.gain}` : band.gain}
            </Text>
            <View style={[styles.eqTrack, { backgroundColor: colors.border }]}>
              <TouchableOpacity
                onPress={() => {
                  const newBands = [...eqSettings.bands];
                  newBands[i] = { ...band, gain: Math.min(EQ_MAX, band.gain + 1) };
                  updateEQ({ bands: newBands });
                }}
                style={styles.eqArrow}
              >
                <Ionicons name="chevron-up" size={14} color={colors.mutedForeground} />
              </TouchableOpacity>
              <View style={[styles.eqFill, {
                height: `${((band.gain + EQ_MAX) / (EQ_MAX * 2)) * 100}%`,
                backgroundColor: skin.accentPrimary,
              }]} />
              <TouchableOpacity
                onPress={() => {
                  const newBands = [...eqSettings.bands];
                  newBands[i] = { ...band, gain: Math.max(-EQ_MAX, band.gain - 1) };
                  updateEQ({ bands: newBands });
                }}
                style={styles.eqArrow}
              >
                <Ionicons name="chevron-down" size={14} color={colors.mutedForeground} />
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
            style={[
              styles.eqToggle,
              { backgroundColor: eqSettings[key] ? skin.accentPrimary : colors.muted, borderColor: eqSettings[key] ? skin.accentPrimary : colors.border },
            ]}
          >
            <Text style={[styles.eqToggleText, { color: eqSettings[key] ? '#fff' : colors.mutedForeground }]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 24,
  },
  artWrap: {
    alignItems: 'center',
    paddingTop: 16,
  },
  art: {
    elevation: 20,
  },
  artPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackInfo: {
    alignItems: 'center',
    gap: 6,
    width: '100%',
  },
  trackTitle: {
    fontWeight: '800',
    letterSpacing: 0.3,
    textAlign: 'center',
    lineHeight: 28,
  },
  trackArtist: {
    fontSize: 15,
    textAlign: 'center',
  },
  scrubberArea: {
    width: '100%',
    gap: 8,
  },
  scrubberTrack: {
    height: 4,
    borderRadius: 4,
    overflow: 'visible',
    position: 'relative',
  },
  scrubberFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: '100%',
    borderRadius: 4,
  },
  scrubberThumb: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    top: -5,
    marginLeft: -7,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeText: {
    fontSize: 12,
  },
  secondaryControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 8,
  },
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 32,
    width: '100%',
  },
  controlBtn: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
  },
  panelButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  panelBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panel: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  panelTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  lyricsText: {
    fontSize: 15,
    lineHeight: 24,
  },
  queueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
    gap: 10,
  },
  queueNum: {
    fontSize: 13,
    fontWeight: '700',
    width: 20,
    textAlign: 'center',
  },
  queueTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  queueArtist: {
    fontSize: 11,
  },
  eqRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    height: 130,
    gap: 4,
  },
  eqBand: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    gap: 4,
  },
  eqGain: {
    fontSize: 9,
  },
  eqTrack: {
    flex: 1,
    width: 20,
    borderRadius: 4,
    overflow: 'hidden',
    alignItems: 'center',
  },
  eqFill: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderRadius: 4,
  },
  eqArrow: {
    zIndex: 1,
  },
  eqFreq: {
    fontSize: 8,
  },
  eqToggles: {
    flexDirection: 'row',
    gap: 10,
  },
  eqToggle: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  eqToggleText: {
    fontSize: 12,
    fontWeight: '600',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 40,
    minHeight: H * 0.7,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  emptyText: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
});
