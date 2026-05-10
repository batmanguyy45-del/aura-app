import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Platform, Alert, TextInput, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useSkin, PRESET_SKINS } from '@/contexts/SkinContext';
import type { SkinConfig } from '@/constants/types';

const COLORS = [
  '#B347FF', '#FF3CAC', '#00D4FF', '#FF6B00', '#00FF41',
  '#FF4444', '#FFD700', '#FFFFFF', '#7B68EE', '#20B2AA',
];

export default function SkinEditorScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { skin, setSkin, savedSkins, saveSkin, deleteSkin, updateSkinProp } = useSkin();
  const [saveModal, setSaveModal] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [section, setSection] = useState<'presets' | 'colors' | 'art' | 'effects'>('presets');

  const topPad = Platform.OS === 'web' ? 67 : insets.top + 8;

  const ColorPicker = ({ label, value, propKey }: { label: string; value: string; propKey: keyof SkinConfig }) => (
    <View style={styles.colorRow}>
      <Text style={[styles.colorLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <View style={styles.colorSwatches}>
        {COLORS.map(c => (
          <TouchableOpacity
            key={c}
            onPress={() => updateSkinProp(propKey, c)}
            style={[
              styles.swatch,
              { backgroundColor: c, borderWidth: value === c ? 2 : 0, borderColor: '#fff' },
            ]}
          />
        ))}
        <View style={[styles.swatch, { backgroundColor: value, borderWidth: 2, borderColor: colors.border }]} />
      </View>
    </View>
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad, borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Skin Editor</Text>
        <TouchableOpacity
          onPress={() => setSaveModal(true)}
          style={[styles.saveBtn, { backgroundColor: colors.primary }]}
        >
          <Ionicons name="save-outline" size={16} color="#fff" />
          <Text style={styles.saveBtnText}>Save</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.preview, { backgroundColor: skin.backgroundColor }]}>
        <LinearGradient
          colors={[skin.accentPrimary + '33', skin.backgroundColor, skin.accentSecondary + '22']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <View style={styles.previewInner}>
          <View style={[styles.previewArt, {
            backgroundColor: skin.accentPrimary + '44',
            borderRadius: skin.albumArtShape === 'circle' ? 30 : skin.albumArtShape === 'square' ? 6 : 12,
          }]}>
            <Ionicons name="musical-notes" size={24} color={skin.accentPrimary} />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[styles.previewTitle, { color: skin.textColor }]}>Track Name</Text>
            <Text style={[styles.previewArtist, { color: skin.textColor + '88' }]}>Artist Name</Text>
          </View>
          <TouchableOpacity style={[styles.previewPlay, { backgroundColor: skin.accentPrimary }]}>
            <Ionicons name="play" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
        <View style={[styles.previewProgress, { backgroundColor: skin.textColor + '22' }]}>
          <LinearGradient
            colors={[skin.progressStart, skin.progressEnd]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={[styles.previewProgressFill, { width: '60%' }]}
          />
        </View>
      </View>

      <View style={styles.sectionTabs}>
        {(['presets', 'colors', 'art', 'effects'] as const).map(s => (
          <TouchableOpacity
            key={s}
            onPress={() => setSection(s)}
            style={[styles.sectionTab, { borderBottomColor: section === s ? colors.primary : 'transparent' }]}
          >
            <Text style={[styles.sectionTabText, { color: section === s ? colors.primary : colors.mutedForeground }]}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: Platform.OS === 'web' ? 150 : 120 }}>
        {section === 'presets' && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>BUILT-IN PRESETS</Text>
            <View style={styles.presetGrid}>
              {PRESET_SKINS.map(preset => (
                <TouchableOpacity
                  key={preset.id}
                  onPress={() => setSkin(preset)}
                  style={[
                    styles.presetCard,
                    {
                      backgroundColor: preset.backgroundColor,
                      borderColor: skin.id === preset.id ? preset.accentPrimary : colors.border,
                      borderWidth: skin.id === preset.id ? 2 : 1,
                    }
                  ]}
                >
                  <LinearGradient
                    colors={[preset.accentPrimary + '55', preset.backgroundColor]}
                    style={StyleSheet.absoluteFill}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  />
                  <Text style={[styles.presetName, { color: preset.textColor }]}>{preset.name}</Text>
                  <View style={[styles.presetDot, { backgroundColor: preset.accentPrimary }]} />
                </TouchableOpacity>
              ))}
            </View>

            {savedSkins.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>SAVED SKINS</Text>
                {savedSkins.map(s => (
                  <View key={s.id} style={[styles.savedRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={[styles.savedDot, { backgroundColor: s.accentPrimary }]} />
                    <Text style={[styles.savedName, { color: colors.foreground }]}>{s.name}</Text>
                    <TouchableOpacity onPress={() => setSkin(s)} style={[styles.applyBtn, { backgroundColor: colors.primary }]}>
                      <Text style={styles.applyBtnText}>Apply</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => Alert.alert('Delete Skin', `Delete "${s.name}"?`, [
                        { text: 'Delete', style: 'destructive', onPress: () => deleteSkin(s.id) },
                        { text: 'Cancel', style: 'cancel' },
                      ])}
                      hitSlop={8}
                    >
                      <Ionicons name="trash-outline" size={18} color={colors.destructive} />
                    </TouchableOpacity>
                  </View>
                ))}
              </>
            )}
          </>
        )}

        {section === 'colors' && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>ACCENT COLORS</Text>
            <ColorPicker label="Primary Accent" value={skin.accentPrimary} propKey="accentPrimary" />
            <ColorPicker label="Secondary Accent" value={skin.accentSecondary} propKey="accentSecondary" />
            <ColorPicker label="Background" value={skin.backgroundColor} propKey="backgroundColor" />
            <ColorPicker label="Text Color" value={skin.textColor} propKey="textColor" />
            <ColorPicker label="Progress Start" value={skin.progressStart} propKey="progressStart" />
            <ColorPicker label="Progress End" value={skin.progressEnd} propKey="progressEnd" />
          </>
        )}

        {section === 'art' && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>ALBUM ART</Text>
            <View style={styles.optionGroup}>
              <Text style={[styles.optionLabel, { color: colors.foreground }]}>Shape</Text>
              <View style={styles.optionRow}>
                {(['square', 'rounded-square', 'circle', 'blob'] as const).map(shape => (
                  <TouchableOpacity
                    key={shape}
                    onPress={() => updateSkinProp('albumArtShape', shape)}
                    style={[
                      styles.optionChip,
                      { backgroundColor: skin.albumArtShape === shape ? colors.primary : colors.muted, borderColor: skin.albumArtShape === shape ? colors.primary : colors.border }
                    ]}
                  >
                    <Text style={[styles.optionChipText, { color: skin.albumArtShape === shape ? '#fff' : colors.mutedForeground }]}>
                      {shape === 'rounded-square' ? 'Rounded' : shape.charAt(0).toUpperCase() + shape.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            {[
              { label: 'Rotation', key: 'albumArtRotation' as const },
              { label: 'Glow', key: 'albumArtGlow' as const },
              { label: 'Reflection', key: 'albumArtReflection' as const },
            ].map(({ label, key }) => (
              <View key={key} style={[styles.toggleRow, { borderColor: colors.border }]}>
                <Text style={[styles.toggleLabel, { color: colors.foreground }]}>{label}</Text>
                <TouchableOpacity
                  onPress={() => updateSkinProp(key, !skin[key])}
                  style={[styles.toggle, { backgroundColor: skin[key] ? colors.primary : colors.muted }]}
                >
                  <View style={[styles.toggleKnob, { transform: [{ translateX: skin[key] ? 20 : 0 }] }]} />
                </TouchableOpacity>
              </View>
            ))}
          </>
        )}

        {section === 'effects' && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>EFFECTS</Text>
            <View style={styles.optionGroup}>
              <Text style={[styles.optionLabel, { color: colors.foreground }]}>Visualizer</Text>
              <View style={styles.optionRow}>
                {(['circular-rings', 'bar-spectrum', 'waveform', 'floating-particles', 'none'] as const).map(v => (
                  <TouchableOpacity
                    key={v}
                    onPress={() => updateSkinProp('visualizerStyle', v)}
                    style={[
                      styles.optionChip,
                      { backgroundColor: skin.visualizerStyle === v ? colors.primary : colors.muted, borderColor: skin.visualizerStyle === v ? colors.primary : colors.border }
                    ]}
                  >
                    <Text style={[styles.optionChipText, { color: skin.visualizerStyle === v ? '#fff' : colors.mutedForeground }]}>
                      {v === 'circular-rings' ? 'Rings' : v === 'bar-spectrum' ? 'Bars' : v === 'floating-particles' ? 'Particles' : v.charAt(0).toUpperCase() + v.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            {[
              { label: 'Pulse on Beat', key: 'pulseOnBeat' as const },
              { label: 'Shake on Skip', key: 'albumArtShakeOnSkip' as const },
              { label: 'Bloom Blur', key: 'bloomBlur' as const },
            ].map(({ label, key }) => (
              <View key={key} style={[styles.toggleRow, { borderColor: colors.border }]}>
                <Text style={[styles.toggleLabel, { color: colors.foreground }]}>{label}</Text>
                <TouchableOpacity
                  onPress={() => updateSkinProp(key, !skin[key])}
                  style={[styles.toggle, { backgroundColor: skin[key] ? colors.primary : colors.muted }]}
                >
                  <View style={[styles.toggleKnob, { transform: [{ translateX: skin[key] ? 20 : 0 }] }]} />
                </TouchableOpacity>
              </View>
            ))}
          </>
        )}
      </ScrollView>

      <Modal visible={saveModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Save Skin</Text>
            <TextInput
              value={saveName}
              onChangeText={setSaveName}
              placeholder="Skin name..."
              placeholderTextColor={colors.mutedForeground}
              style={[styles.modalInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.muted }]}
              autoFocus
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity onPress={() => setSaveModal(false)} style={[styles.modalBtn, { backgroundColor: colors.muted }]}>
                <Text style={[styles.modalBtnText, { color: colors.mutedForeground }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { if (saveName.trim()) { saveSkin(saveName.trim()); setSaveName(''); setSaveModal(false); } }}
                style={[styles.modalBtn, { backgroundColor: colors.primary }]}
              >
                <Text style={[styles.modalBtnText, { color: '#fff' }]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: 4, textTransform: 'uppercase' },
  saveBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, gap: 6 },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  preview: {
    margin: 16,
    borderRadius: 16,
    overflow: 'hidden',
    padding: 12,
    gap: 8,
  },
  previewInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  previewArt: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewTitle: { fontSize: 14, fontWeight: '700' },
  previewArtist: { fontSize: 12 },
  previewPlay: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewProgress: { height: 3, borderRadius: 3, overflow: 'hidden' },
  previewProgressFill: { height: '100%', borderRadius: 3 },
  sectionTabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
  },
  sectionTab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
  },
  sectionTabText: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 },
  presetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  presetCard: {
    width: '30%',
    height: 70,
    borderRadius: 12,
    overflow: 'hidden',
    padding: 10,
    justifyContent: 'space-between',
  },
  presetName: { fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  presetDot: { width: 10, height: 10, borderRadius: 5 },
  savedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  savedDot: { width: 12, height: 12, borderRadius: 6 },
  savedName: { flex: 1, fontSize: 14, fontWeight: '600' },
  applyBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  applyBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  colorRow: { gap: 8 },
  colorLabel: { fontSize: 12, fontWeight: '600' },
  colorSwatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  swatch: { width: 32, height: 32, borderRadius: 16 },
  optionGroup: { gap: 10 },
  optionLabel: { fontSize: 14, fontWeight: '600' },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1 },
  optionChipText: { fontSize: 12, fontWeight: '600' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1 },
  toggleLabel: { fontSize: 14, fontWeight: '600' },
  toggle: { width: 48, height: 26, borderRadius: 13, justifyContent: 'center', paddingHorizontal: 3 },
  toggleKnob: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center' },
  modalCard: { width: 300, borderRadius: 16, borderWidth: 1, padding: 20, gap: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  modalInput: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 15 },
  modalBtns: { flexDirection: 'row', gap: 12 },
  modalBtn: { flex: 1, padding: 12, borderRadius: 10, alignItems: 'center' },
  modalBtnText: { fontSize: 14, fontWeight: '700' },
});
