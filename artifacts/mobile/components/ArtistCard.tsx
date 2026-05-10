import React, { useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

export interface ArtistItem {
  id: string;
  name: string;
  genre: string;
}

// Vivid gradient palettes — one gets picked deterministically from the artist name
const PALETTES: [string, string][] = [
  ['#B347FF', '#5B2FE0'],
  ['#FF3CAC', '#7B2FBE'],
  ['#FF6B35', '#C43B00'],
  ['#00D4FF', '#0057FF'],
  ['#39FF14', '#007700'],
  ['#FFD700', '#FF8C00'],
  ['#FF69B4', '#8B0057'],
  ['#00FFCC', '#008B8B'],
  ['#FF1493', '#4B0082'],
  ['#7FDBFF', '#0074D9'],
  ['#2ECC40', '#006400'],
  ['#FF4136', '#85144b'],
];

function artistPalette(name: string): [string, string] {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) & 0x7fffffff;
  }
  return PALETTES[hash % PALETTES.length];
}

function initials(name: string): string {
  return name
    .split(/[\s,\.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('');
}

interface Props {
  artist: ArtistItem;
  isFollowing: boolean;
  onToggleFollow: (name: string) => void;
  onPress: (artist: ArtistItem) => void;
  size?: 'normal' | 'compact';
}

export function ArtistCard({ artist, isFollowing, onToggleFollow, onPress, size = 'normal' }: Props) {
  const [colorA, colorB] = useMemo(() => artistPalette(artist.name), [artist.name]);
  const cardSize = size === 'compact' ? 80 : 110;
  const fontSize = size === 'compact' ? 16 : 22;
  const nameFontSize = size === 'compact' ? 11 : 13;

  return (
    <TouchableOpacity
      onPress={() => onPress(artist)}
      style={[styles.container, { width: cardSize }]}
      activeOpacity={0.8}
    >
      <View style={styles.avatarWrap}>
        <LinearGradient
          colors={[colorA, colorB]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.avatar, { width: cardSize, height: cardSize, borderRadius: cardSize / 2 }]}
        >
          <Text style={[styles.initials, { fontSize }]}>{initials(artist.name)}</Text>
        </LinearGradient>

        {/* Follow button overlay */}
        <TouchableOpacity
          onPress={() => onToggleFollow(artist.name)}
          style={[
            styles.followBtn,
            isFollowing
              ? { backgroundColor: colorA, borderColor: colorA }
              : { backgroundColor: 'rgba(0,0,0,0.65)', borderColor: 'rgba(255,255,255,0.3)' },
          ]}
          hitSlop={8}
        >
          <Ionicons
            name={isFollowing ? 'checkmark' : 'add'}
            size={12}
            color="#fff"
          />
        </TouchableOpacity>
      </View>

      <Text style={[styles.name, { fontSize: nameFontSize }]} numberOfLines={2} textBreakStrategy="simple">
        {artist.name}
      </Text>
      <Text style={styles.genre} numberOfLines={1}>{artist.genre}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 6,
    marginRight: 14,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: '#fff',
    fontWeight: '900',
    letterSpacing: 1,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  followBtn: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    color: '#F0F0FF',
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 15,
  },
  genre: {
    color: 'rgba(240,240,255,0.5)',
    fontSize: 10,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
});
