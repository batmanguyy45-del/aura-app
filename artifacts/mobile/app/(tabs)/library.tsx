import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Platform, FlatList, Alert, TextInput, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useSkin } from '@/contexts/SkinContext';
import { useLibrary } from '@/contexts/LibraryContext';
import { usePlayer } from '@/contexts/PlayerContext';
import { TrackRow } from '@/components/TrackRow';

type Tab = 'downloads' | 'playlists' | 'stats';

export default function LibraryScreen() {
  const colors = useAppTheme();
  const { skin } = useSkin();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('downloads');
  const topPad = Platform.OS === 'web' ? 67 : insets.top + 8;

  return (
    <View style={[styles.screen, { backgroundColor: skin.backgroundColor }]}>
      <LinearGradient
        colors={[skin.accentPrimary + '14', skin.backgroundColor, skin.backgroundColor]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.3 }}
      />
      <View style={[styles.header, { paddingTop: topPad, borderBottomColor: skin.textColor + '18', backgroundColor: skin.backgroundColor + 'F0' }]}>
        <Text style={[styles.title, { color: skin.textColor }]}>Library</Text>
        <View style={styles.tabs}>
          {(['downloads', 'playlists', 'stats'] as Tab[]).map(t => (
            <TouchableOpacity
              key={t}
              onPress={() => setTab(t)}
              style={[styles.tab, { borderBottomColor: tab === t ? skin.accentPrimary : 'transparent' }]}
            >
              <Text style={[styles.tabText, { color: tab === t ? skin.accentPrimary : skin.textColor + '55' }]}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      {tab === 'downloads' && <DownloadsTab />}
      {tab === 'playlists' && <PlaylistsTab />}
      {tab === 'stats' && <StatsTab />}
    </View>
  );
}

function DownloadsTab() {
  const colors = useAppTheme();
  const { skin } = useSkin();
  const { tracks, likedIds, removeTrack } = useLibrary();
  const { play } = usePlayer();
  const [search, setSearch] = useState('');

  const filtered = tracks.filter(t =>
    !search || t.title.toLowerCase().includes(search.toLowerCase()) || t.artist.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <View style={{ flex: 1 }}>
      <View style={[styles.searchBar, { backgroundColor: skin.textColor + '0A', borderColor: skin.textColor + '18' }]}>
        <Ionicons name="search" size={16} color={skin.textColor + '55'} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Filter downloads..."
          placeholderTextColor={skin.textColor + '44'}
          style={[styles.searchInput, { color: skin.textColor }]}
        />
      </View>
      {filtered.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="cloud-download-outline" size={56} color={skin.textColor + '44'} />
          <Text style={[styles.emptyTitle, { color: skin.textColor }]}>No Downloads Yet</Text>
          <Text style={[styles.emptyText, { color: skin.textColor + '66' }]}>
            Search for music and tap the download button
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={i => i.id}
          contentContainerStyle={{ paddingBottom: Platform.OS === 'web' ? 150 : 120 }}
          renderItem={({ item }) => (
            <TrackRow
              track={item}
              isDownloaded
              showDownload={false}
              onPlay={() => play(item, filtered)}
              onMore={() => Alert.alert(item.title, undefined, [
                { text: 'Remove', style: 'destructive', onPress: () => removeTrack(item.id) },
                { text: 'Cancel', style: 'cancel' },
              ])}
            />
          )}
        />
      )}
    </View>
  );
}

function PlaylistsTab() {
  const colors = useAppTheme();
  const { skin } = useSkin();
  const { playlists, tracks, createPlaylist, deletePlaylist } = useLibrary();
  const { play } = usePlayer();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');

  const handleCreate = () => {
    if (!newName.trim()) return;
    createPlaylist(newName.trim());
    setNewName('');
    setShowCreate(false);
  };

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: Platform.OS === 'web' ? 150 : 120 }}>
      <TouchableOpacity
        onPress={() => setShowCreate(true)}
        style={[styles.createBtn, { backgroundColor: skin.accentPrimary }]}
      >
        <Ionicons name="add" size={20} color="#fff" />
        <Text style={styles.createBtnText}>New Playlist</Text>
      </TouchableOpacity>

      {playlists.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="musical-note-outline" size={56} color={skin.textColor + '44'} />
          <Text style={[styles.emptyTitle, { color: skin.textColor }]}>No Playlists</Text>
          <Text style={[styles.emptyText, { color: skin.textColor + '66' }]}>
            Create your first playlist to organize your music
          </Text>
        </View>
      ) : (
        <View style={styles.playlistGrid}>
          {playlists.map(pl => {
            const plTracks = tracks.filter(t => pl.trackIds.includes(t.id));
            return (
              <TouchableOpacity
                key={pl.id}
                style={[styles.playlistCard, { backgroundColor: skin.textColor + '0A', borderColor: skin.textColor + '18' }]}
                onPress={() => plTracks.length > 0 && play(plTracks[0], plTracks)}
                onLongPress={() => Alert.alert(pl.name, undefined, [
                  { text: 'Delete', style: 'destructive', onPress: () => deletePlaylist(pl.id) },
                  { text: 'Cancel', style: 'cancel' },
                ])}
              >
                <LinearGradient
                  colors={[skin.accentPrimary + '33', skin.accentSecondary + '22']}
                  style={[styles.playlistArt]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                >
                  <Ionicons name="musical-notes" size={32} color={skin.accentPrimary} />
                </LinearGradient>
                <Text style={[styles.playlistName, { color: skin.textColor }]} numberOfLines={1}>{pl.name}</Text>
                <Text style={[styles.playlistCount, { color: skin.textColor + '66' }]}>{pl.trackIds.length} tracks</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <Modal visible={showCreate} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: skin.backgroundColor, borderColor: skin.textColor + '22' }]}>
            <Text style={[styles.modalTitle, { color: skin.textColor }]}>New Playlist</Text>
            <TextInput
              value={newName}
              onChangeText={setNewName}
              placeholder="Playlist name..."
              placeholderTextColor={skin.textColor + '44'}
              style={[styles.modalInput, { color: skin.textColor, borderColor: skin.textColor + '22', backgroundColor: skin.textColor + '0A' }]}
              autoFocus
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity onPress={() => setShowCreate(false)} style={[styles.modalBtn, { backgroundColor: skin.textColor + '15' }]}>
                <Text style={[styles.modalBtnText, { color: skin.textColor + '88' }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleCreate} style={[styles.modalBtn, { backgroundColor: skin.accentPrimary }]}>
                <Text style={[styles.modalBtnText, { color: '#fff' }]}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function StatsTab() {
  const colors = useAppTheme();
  const { skin } = useSkin();
  const { stats, tracks, history } = useLibrary();

  const hours = Math.floor(stats.totalListeningMinutes / 60);
  const mins = Math.floor(stats.totalListeningMinutes % 60);

  const topTracks = [...tracks].sort((a, b) => b.playCount - a.playCount).slice(0, 5);

  const artistMap: Record<string, number> = {};
  tracks.forEach(t => { artistMap[t.artist] = (artistMap[t.artist] || 0) + t.playCount; });
  const topArtists = Object.entries(artistMap).sort(([, a], [, b]) => b - a).slice(0, 5);

  const today = new Date().toISOString().split('T')[0];
  const todayMins = Math.round(stats.dailyActivity[today] || 0);

  const cardStyle = [styles.statCard, { backgroundColor: skin.textColor + '0A', borderColor: skin.textColor + '15' }];

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: Platform.OS === 'web' ? 150 : 120, gap: 16, paddingTop: 20 }}>
      <View style={[styles.statsRow]}>
        <View style={[cardStyle, { flex: 1 }]}>
          <Text style={[styles.statLabel, { color: skin.textColor + '77' }]}>Listening Time</Text>
          <Text style={[styles.statValue, { color: skin.accentPrimary }]}>
            {hours > 0 ? `${hours}h ${mins}m` : `${mins}m`}
          </Text>
        </View>
        <View style={[cardStyle, { flex: 1 }]}>
          <Text style={[styles.statLabel, { color: skin.textColor + '77' }]}>Today</Text>
          <Text style={[styles.statValue, { color: skin.accentSecondary }]}>{todayMins}m</Text>
        </View>
        <View style={[cardStyle, { flex: 1 }]}>
          <Text style={[styles.statLabel, { color: skin.textColor + '77' }]}>Library</Text>
          <Text style={[styles.statValue, { color: skin.textColor }]}>{tracks.length}</Text>
        </View>
      </View>

      {topTracks.length > 0 && (
        <View style={[styles.statSection, { backgroundColor: skin.textColor + '08', borderColor: skin.textColor + '15' }]}>
          <Text style={[styles.statSectionTitle, { color: skin.textColor }]}>Top Tracks</Text>
          {topTracks.map((t, i) => (
            <View key={t.id} style={styles.statRow}>
              <Text style={[styles.statRank, { color: skin.accentPrimary }]}>#{i + 1}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.statRowTitle, { color: skin.textColor }]} numberOfLines={1}>{t.title}</Text>
                <Text style={[styles.statRowSub, { color: skin.textColor + '66' }]}>{t.artist}</Text>
              </View>
              <Text style={[styles.statRowCount, { color: skin.textColor + '55' }]}>{t.playCount} plays</Text>
            </View>
          ))}
        </View>
      )}

      {topArtists.length > 0 && (
        <View style={[styles.statSection, { backgroundColor: skin.textColor + '08', borderColor: skin.textColor + '15' }]}>
          <Text style={[styles.statSectionTitle, { color: skin.textColor }]}>Top Artists</Text>
          {topArtists.map(([artist, count], i) => (
            <View key={artist} style={styles.statRow}>
              <Text style={[styles.statRank, { color: skin.accentSecondary }]}>#{i + 1}</Text>
              <Text style={[styles.statRowTitle, { color: skin.textColor, flex: 1 }]} numberOfLines={1}>{artist}</Text>
              <Text style={[styles.statRowCount, { color: skin.textColor + '55' }]}>{count} plays</Text>
            </View>
          ))}
        </View>
      )}

      {tracks.length === 0 && (
        <View style={styles.empty}>
          <Ionicons name="stats-chart-outline" size={56} color={skin.textColor + '44'} />
          <Text style={[styles.emptyTitle, { color: skin.textColor }]}>No Stats Yet</Text>
          <Text style={[styles.emptyText, { color: skin.textColor + '66' }]}>Start playing music to see your stats</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { paddingBottom: 0, borderBottomWidth: 1 },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: 4, textTransform: 'uppercase', paddingHorizontal: 20, marginBottom: 14 },
  tabs: { flexDirection: 'row', paddingHorizontal: 20 },
  tab: { paddingVertical: 12, paddingHorizontal: 16, marginRight: 4, borderBottomWidth: 2 },
  tabText: { fontSize: 14, fontWeight: '600' },
  searchBar: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginVertical: 12, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1, gap: 8 },
  searchInput: { flex: 1, fontSize: 14 },
  empty: { paddingVertical: 60, alignItems: 'center', gap: 12, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  createBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', margin: 16, padding: 14, borderRadius: 12, gap: 8 },
  createBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  playlistGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 12 },
  playlistCard: { width: '47%', borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  playlistArt: { width: '100%', height: 110, alignItems: 'center', justifyContent: 'center' },
  playlistName: { fontSize: 14, fontWeight: '700', paddingHorizontal: 12, paddingTop: 10 },
  playlistCount: { fontSize: 12, paddingHorizontal: 12, paddingBottom: 10, marginTop: 2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center' },
  modalCard: { width: 300, borderRadius: 16, borderWidth: 1, padding: 20, gap: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  modalInput: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 15 },
  modalBtns: { flexDirection: 'row', gap: 12 },
  modalBtn: { flex: 1, padding: 12, borderRadius: 10, alignItems: 'center' },
  modalBtnText: { fontSize: 14, fontWeight: '700' },
  statsRow: { flexDirection: 'row', gap: 12 },
  statCard: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 4 },
  statLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  statValue: { fontSize: 24, fontWeight: '800' },
  statSection: { borderRadius: 12, borderWidth: 1, padding: 16, gap: 14 },
  statSectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statRank: { fontSize: 14, fontWeight: '800', width: 28 },
  statRowTitle: { fontSize: 14, fontWeight: '600' },
  statRowSub: { fontSize: 12, marginTop: 2 },
  statRowCount: { fontSize: 12 },
});
