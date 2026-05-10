import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { Pressable } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { usePlayer } from '@/contexts/PlayerContext';

export function MiniPlayer() {
  const colors = useColors();
  const { currentTrack, isPlaying, position, duration, pause, resume } = usePlayer();
  const router = useRouter();
  const scale = useSharedValue(1);

  if (!currentTrack) return null;

  const progress = duration > 0 ? Math.min(position / duration, 1) : 0;

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePlayPause = (e: any) => {
    e.stopPropagation();
    if (isPlaying) pause(); else resume();
  };

  return (
    <Pressable
      onPress={() => router.push('/(tabs)/player')}
      onPressIn={() => { scale.value = withSpring(0.98, { damping: 15 }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 15 }); }}
    >
      <Animated.View style={[styles.wrapper, animStyle, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
        <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
          <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: colors.primary }]} />
        </View>
        <View style={styles.inner}>
          {currentTrack.thumbnail ? (
            <Image source={{ uri: currentTrack.thumbnail }} style={[styles.art, { borderRadius: 8 }]} />
          ) : (
            <View style={[styles.art, { borderRadius: 8, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' }]}>
              <Ionicons name="musical-notes" size={20} color={colors.primary} />
            </View>
          )}
          <View style={styles.info}>
            <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>{currentTrack.title}</Text>
            <Text style={[styles.artist, { color: colors.mutedForeground }]} numberOfLines={1}>{currentTrack.artist}</Text>
          </View>
          <TouchableOpacity onPress={handlePlayPause} hitSlop={12} style={styles.btn}>
            <Ionicons name={isPlaying ? 'pause' : 'play'} size={28} color={colors.foreground} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={(e) => { e.stopPropagation(); }}
            hitSlop={12}
            style={styles.btn}
          >
            <Ionicons name="play-skip-forward" size={22} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderTopWidth: 1,
    overflow: 'hidden',
  },
  progressBar: {
    height: 2,
    width: '100%',
  },
  progressFill: {
    height: '100%',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  art: {
    width: 46,
    height: 46,
  },
  info: {
    flex: 1,
    gap: 3,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
  },
  artist: {
    fontSize: 12,
  },
  btn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
