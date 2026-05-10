import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import type { SearchResult, Track } from '@/constants/types';

interface TrackRowProps {
  track: SearchResult | Track;
  onPlay?: () => void;
  onDownload?: () => void;
  onAddToQueue?: () => void;
  onMore?: () => void;
  showDownload?: boolean;
  isDownloaded?: boolean;
}

function formatDuration(seconds: number): string {
  if (!seconds) return '';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatViews(views?: number): string {
  if (!views) return '';
  if (views >= 1e9) return `${(views / 1e9).toFixed(1)}B`;
  if (views >= 1e6) return `${(views / 1e6).toFixed(1)}M`;
  if (views >= 1e3) return `${(views / 1e3).toFixed(1)}K`;
  return `${views}`;
}

export function TrackRow({
  track, onPlay, onDownload, onAddToQueue, onMore,
  showDownload = true, isDownloaded = false,
}: TrackRowProps) {
  const colors = useColors();
  const views = 'views' in track ? (track as SearchResult).views : undefined;
  const metaParts = [
    track.artist,
    views ? `${formatViews(views)} views` : '',
    track.duration ? formatDuration(track.duration) : '',
  ].filter(Boolean);

  return (
    <TouchableOpacity onPress={onPlay} activeOpacity={0.7} style={styles.container}>
      {track.thumbnail ? (
        <Image source={{ uri: track.thumbnail }} style={[styles.thumbnail, { borderRadius: 8 }]} resizeMode="cover" />
      ) : (
        <View style={[styles.thumbnail, { borderRadius: 8, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' }]}>
          <Ionicons name="musical-notes" size={20} color={colors.mutedForeground} />
        </View>
      )}
      <View style={styles.info}>
        <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>{track.title}</Text>
        <Text style={[styles.meta, { color: colors.mutedForeground }]} numberOfLines={1}>
          {metaParts.join(' · ')}
        </Text>
      </View>
      <View style={styles.actions}>
        {showDownload && onDownload && (
          <TouchableOpacity onPress={onDownload} hitSlop={8} style={styles.actionBtn}>
            <Ionicons
              name={isDownloaded ? 'checkmark-circle' : 'download-outline'}
              size={22}
              color={isDownloaded ? colors.primary : colors.mutedForeground}
            />
          </TouchableOpacity>
        )}
        {onAddToQueue && (
          <TouchableOpacity onPress={onAddToQueue} hitSlop={8} style={styles.actionBtn}>
            <Ionicons name="add-circle-outline" size={22} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={onMore} hitSlop={8} style={styles.actionBtn}>
          <Ionicons name="ellipsis-vertical" size={18} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 12,
  },
  thumbnail: {
    width: 52,
    height: 52,
  },
  info: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
  },
  meta: {
    fontSize: 12,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
