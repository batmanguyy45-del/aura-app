import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import type { SearchResult } from '@/constants/types';

interface TrackCardProps {
  track: SearchResult;
  onPress: () => void;
}

function formatDuration(seconds: number): string {
  if (!seconds) return '';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function TrackCard({ track, onPress }: TrackCardProps) {
  const colors = useColors();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[styles.container, { backgroundColor: colors.card, borderRadius: 12, borderColor: colors.border }]}
    >
      {track.thumbnail ? (
        <Image source={{ uri: track.thumbnail }} style={styles.thumbnail} resizeMode="cover" />
      ) : (
        <View style={[styles.thumbnail, { backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' }]}>
          <Ionicons name="musical-notes" size={32} color={colors.primary} />
        </View>
      )}
      {track.duration > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{formatDuration(track.duration)}</Text>
        </View>
      )}
      <View style={styles.info}>
        <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={2}>{track.title}</Text>
        <Text style={[styles.artist, { color: colors.mutedForeground }]} numberOfLines={1}>{track.artist}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 164,
    marginRight: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  thumbnail: {
    width: '100%',
    height: 104,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  badge: {
    position: 'absolute',
    top: 78,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  info: {
    padding: 10,
    gap: 4,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  artist: {
    fontSize: 11,
    lineHeight: 15,
  },
});
