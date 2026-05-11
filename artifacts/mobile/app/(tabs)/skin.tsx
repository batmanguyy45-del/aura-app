import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Platform, Alert, TextInput, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useSkin, PRESET_SKINS } from '@/contexts/SkinContext';
import type { SkinConfig } from '@/constants/types';

const COLORS = [
  '#B347FF', '#FF3CAC', '#FF6B00', '#FF2D00', '#FFD700',
  '#00D4FF', '#0088FF', '#00FF41', '#FF69B4', '#7B68EE',
  '#FFFFFF', '#CCCCCC', '#20B2AA', '#FF4444', '#39FF14',
  '#FF1493', '#00FFCC', '#FF6347', '#9B59B6', '#1ABC9C',
];

const FONT_SCALES = [
  { label: 'XS', value: 0.8 },
  { label: 'S', value: 0.9 },
  { label: 'M', value: 1.0 },
  { label: 'L', value: 1.1 },
  { label: 'XL', value: 1.25 },
];

const EXTRA_PRESETS: SkinConfig[] = [
  {
    id: 'neon-purple', name: 'NEON', backgroundStyle: 'solid', backgroundColor: '#0A0014',
    accentPrimary: '#D400FF', accentSecondary: '#7B00FF', textColor: '#F8EEFF',
    glassTint: 'rgba(10,0,20,0.6)', glassBlur: 24, glassOpacity: 0.6,
    progressStart: '#D400FF', progressEnd: '#7B00FF', fontSizeScale: 1.0, letterSpacing: '0.01em',
    textGlow: 0.6, visualizerStyle: 'bar-spectrum', visualizerColorMode: 'aurora-match',
    visualizerIntensity: 0.9, albumArtSize: 'large', albumArtShape: 'circle', albumArtRotation: true,
    albumArtGlow: true, albumArtGlowIntensity: 1.0, albumArtReflection: false,
    buttonStyle: 'circle', buttonSize: 'normal', pulseOnBeat: true, albumArtShakeOnSkip: true,
    bloomBlur: true, miniPlayerStyle: 'slim',
  },
  {
    id: 'gold-dark', name: 'GOLD', backgroundStyle: 'solid', backgroundColor: '#0C0900',
    accentPrimary: '#FFD700', accentSecondary: '#FF8C00', textColor: '#FFF8E0',
    glassTint: 'rgba(12,9,0,0.6)', glassBlur: 20, glassOpacity: 0.6,
    progressStart: '#FFD700', progressEnd: '#FF8C00', fontSizeScale: 1.0, letterSpacing: '0.02em',
    textGlow: 0.3, visualizerStyle: 'waveform', visualizerColorMode: 'fixed-accent',
    visualizerIntensity: 0.7, albumArtSize: 'large', albumArtShape: 'rounded-square', albumArtRotation: false,
    albumArtGlow: true, albumArtGlowIntensity: 0.6, albumArtReflection: true,
    buttonStyle: 'pill', buttonSize: 'large', pulseOnBeat: false, albumArtShakeOnSkip: false,
    bloomBlur: false, miniPlayerStyle: 'standard',
  },
  {
    id: 'ocean', name: 'OCEAN', backgroundStyle: 'gradient', backgroundColor: '#020B18',
    accentPrimary: '#00E5FF', accentSecondary: '#006EFF', textColor: '#E0F7FF',
    glassTint: 'rgba(2,11,24,0.6)', glassBlur: 28, glassOpacity: 0.6,
    progressStart: '#00E5FF', progressEnd: '#006EFF', fontSizeScale: 1.0, letterSpacing: '0.01em',
    textGlow: 0.35, visualizerStyle: 'floating-particles', visualizerColorMode: 'rainbow',
    visualizerIntensity: 0.8, albumArtSize: 'large', albumArtShape: 'circle', albumArtRotation: false,
    albumArtGlow: true, albumArtGlowIntensity: 0.7, albumArtReflection: true,
    buttonStyle: 'ghost', buttonSize: 'normal', pulseOnBeat: true, albumArtShakeOnSkip: true,
    bloomBlur: true, miniPlayerStyle: 'bubble',
  },
  {
    id: 'rose', name: 'ROSE', backgroundStyle: 'solid', backgroundColor: '#0F0608',
    accentPrimary: '#FF3CAC', accentSecondary: '#FF69B4', textColor: '#FFE8F0',
    glassTint: 'rgba(15,6,8,0.6)', glassBlur: 22, glassOpacity: 0.6,
    progressStart: '#FF3CAC', progressEnd: '#FF69B4', fontSizeScale: 1.0, letterSpacing: '0.01em',
    textGlow: 0.5, visualizerStyle: 'circular-rings', visualizerColorMode: 'aurora-match',
    visualizerIntensity: 0.75, albumArtSize: 'large', albumArtShape: 'blob', albumArtRotation: false,
    albumArtGlow: true, albumArtGlowIntensity: 0.85, albumArtReflection: true,
    buttonStyle: 'pill', buttonSize: 'normal', pulseOnBeat: true, albumArtShakeOnSkip: true,
    bloomBlur: true, miniPlayerStyle: 'standard',
  },
  {
    id: 'monochrome', name: 'MONO', backgroundStyle: 'solid', backgroundColor: '#0A0A0A',
    accentPrimary: '#FFFFFF', accentSecondary: '#888888', textColor: '#FFFFFF',
    glassTint: 'rgba(10,10,10,0.6)', glassBlur: 20, glassOpacity: 0.6,
    progressStart: '#FFFFFF', progressEnd: '#888888', fontSizeScale: 1.0, letterSpacing: '0.03em',
    textGlow: 0, visualizerStyle: 'bar-spectrum', visualizerColorMode: 'white',
    visualizerIntensity: 0.6, albumArtSize: 'large', albumArtShape: 'square', albumArtRotation: false,
    albumArtGlow: false, albumArtGlowIntensity: 0, albumArtReflection: false,
    buttonStyle: 'square', buttonSize: 'normal', pulseOnBeat: false, albumArtShakeOnSkip: false,
    bloomBlur: false, miniPlayerStyle: 'slim',
  },
  {
    id: 'tropical', name: 'TROPIC', backgroundStyle: 'gradient', backgroundColor: '#020C0A',
    accentPrimary: '#00FF88', accentSecondary: '#00CCFF', textColor: '#E0FFF5',
    glassTint: 'rgba(2,12,10,0.6)', glassBlur: 24, glassOpacity: 0.6,
    progressStart: '#00FF88', progressEnd: '#00CCFF', fontSizeScale: 1.0, letterSpacing: '0.01em',
    textGlow: 0.4, visualizerStyle: 'waveform', visualizerColorMode: 'rainbow',
    visualizerIntensity: 0.85, albumArtSize: 'large', albumArtShape: 'rounded-square', albumArtRotation: false,
    albumArtGlow: true, albumArtGlowIntensity: 0.7, albumArtReflection: true,
    buttonStyle: 'pill', buttonSize: 'normal', pulseOnBeat: true, albumArtShakeOnSkip: false,
    bloomBlur: true, miniPlayerStyle: 'standard',
  },
];

const ALL_PRESETS = [...PRESET_SKINS, ...EXTRA_PRESETS];

export default function SkinEditorScreen() {
  const colors = useAppTheme();
  const insets = useSafeAreaInsets();
  const { skin, setSkin, savedSkins, saveSkin, deleteSkin, updateSkinProp } = useSkin();
  const [saveModal, setSaveModal] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [section, setSection] = useState<'presets' | 'colors' | 'art' | 'effects' | 'text'>('presets');

  const topPad = Platform.OS === 'web' ? 67 : insets.top + 8;

  const ColorPicker = ({ label, value, propKey }: { label: string; value: string; propKey: keyof SkinConfig }) => (
    <View style={styles.colorRow}>
      <Text style={[styles.colorLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <View style={styles.colorSwatches}>
        {COLORS.map(c => (
          <TouchableOpacity
            key={c}
            onPress={() => updateSkinProp(propKey, c)}
            style={[styles.swatch, { backgroundColor: c, borderWidth: value === c ? 2.5 : 0, borderColor: '#fff' }]}
          />
        ))}
        <View style={[styles.swatch, { backgroundColor: value, borderWidth: 2, borderColor: colors.border }]} />
      </View>
    </View>
  );

  const Toggle = ({ label, propKey }: { label: string; propKey: keyof SkinConfig }) => (
    <View style={[styles.toggleRow, { borderColor: colors.border }]}>
      <Text style={[styles.toggleLabel, { color: colors.foreground }]}>{label}</Text>
      <TouchableOpacity
        onPress={() => updateSkinProp(propKey, !skin[propKey])}
        style={[styles.toggle, { backgroundColor: skin[propKey] ? colors.primary : colors.muted }]}
      >
        <View style={[styles.toggleKnob, { transform: [{ translateX: skin[propKey] ? 20 : 0 }] }]} />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[styles.screen, { backgroundColor: skin.backgroundColor }]}>
      {/* Gradient overlay */}
      <LinearGradient
        colors={[skin.accentPrimary + '18', skin.backgroundColor, skin.backgroundColor]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.4 }}
      />

      <View style={[styles.header, { paddingTop: topPad, borderBottomColor: skin.textColor + '18', backgroundColor: skin.backgroundColor + 'F0' }]}>
        <Text style={[styles.title, { color: skin.textColor }]}>SKIN</Text>
        <TouchableOpacity
          onPress={() => setSaveModal(true)}
          style={[styles.saveBtn, { backgroundColor: skin.accentPrimary }]}
        >
          <Ionicons name="save-outline" size={16} color="#fff" />
          <Text style={styles.saveBtnText}>Save</Text>
        </TouchableOpacity>
      </View>

      {/* Live preview */}
      <View style={[styles.preview, { backgroundColor: skin.backgroundColor, borderColor: skin.textColor + '15' }]}>
        <LinearGradient
          colors={[skin.accentPrimary + '33', skin.backgroundColor, skin.accentSecondary + '22']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        />
        <View style={styles.previewInner}>
          <View style={[styles.previewArt, {
            backgroundColor: skin.accentPrimary + '44',
            borderRadius: skin.albumArtShape === 'circle' ? 30 : skin.albumArtShape === 'square' ? 6 : 12,
          }]}>
            <Ionicons name="musical-notes" size={24} color={skin.accentPrimary} />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[styles.previewTitle, { color: skin.textColor, fontSize: 14 * skin.fontSizeScale }]}>Track Name</Text>
            <Text style={[styles.previewArtist, { color: skin.textColor + '88' }]}>Artist</Text>
          </View>
          <TouchableOpacity style={[styles.previewPlay, { backgroundColor: skin.accentPrimary }]}>
            <Ionicons name="play" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
        <View style={[styles.previewProgress, { backgroundColor: skin.textColor + '22' }]}>
          <LinearGradient
            colors={[skin.progressStart, skin.progressEnd]}
            start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
            style={[styles.previewProgressFill, { width: '60%' }]}
          />
        </View>
      </View>

      {/* Section tabs */}
      <View style={[styles.sectionTabs, { borderBottomColor: skin.textColor + '15' }]}>
        {(['presets', 'colors', 'text', 'art', 'effects'] as const).map(s => (
          <TouchableOpacity
            key={s}
            onPress={() => setSection(s)}
            style={[styles.sectionTab, { borderBottomColor: section === s ? skin.accentPrimary : 'transparent' }]}
          >
            <Text style={[styles.sectionTabText, { color: section === s ? skin.accentPrimary : skin.textColor + '66' }]}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: Platform.OS === 'web' ? 150 : 120 }}>

        {/* ── Presets ───────────────────────────────────────────────────── */}
        {section === 'presets' && (
          <>
            <Text style={[styles.sectionTitle, { color: skin.textColor + '77' }]}>BUILT-IN PRESETS</Text>
            <View style={styles.presetGrid}>
              {ALL_PRESETS.map(preset => (
                <TouchableOpacity
                  key={preset.id}
                  onPress={() => setSkin(preset)}
                  style={[styles.presetCard, {
                    backgroundColor: preset.backgroundColor,
                    borderColor: skin.id === preset.id ? preset.accentPrimary : preset.textColor + '22',
                    borderWidth: skin.id === preset.id ? 2 : 1,
                  }]}
                >
                  <LinearGradient
                    colors={[preset.accentPrimary + '66', preset.backgroundColor]}
                    style={StyleSheet.absoluteFill}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  />
                  <Text style={[styles.presetName, { color: preset.textColor }]}>{preset.name}</Text>
                  <View style={[styles.presetDot, { backgroundColor: preset.accentPrimary }]} />
                  {skin.id === preset.id && (
                    <View style={[styles.presetCheck, { backgroundColor: preset.accentPrimary }]}>
                      <Ionicons name="checkmark" size={10} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {savedSkins.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { color: skin.textColor + '77' }]}>SAVED SKINS</Text>
                {savedSkins.map(s => (
                  <View key={s.id} style={[styles.savedRow, { backgroundColor: skin.textColor + '0A', borderColor: skin.textColor + '18' }]}>
                    <View style={[styles.savedDot, { backgroundColor: s.accentPrimary }]} />
                    <Text style={[styles.savedName, { color: skin.textColor }]}>{s.name}</Text>
                    <TouchableOpacity onPress={() => setSkin(s)} style={[styles.applyBtn, { backgroundColor: skin.accentPrimary }]}>
                      <Text style={styles.applyBtnText}>Apply</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => Alert.alert('Delete Skin', `Delete "${s.name}"?`, [
                        { text: 'Delete', style: 'destructive', onPress: () => deleteSkin(s.id) },
                        { text: 'Cancel', style: 'cancel' },
                      ])}
                      hitSlop={8}
                    >
                      <Ionicons name="trash-outline" size={18} color="#FF4444" />
                    </TouchableOpacity>
                  </View>
                ))}
              </>
            )}
          </>
        )}

        {/* ── Colors ────────────────────────────────────────────────────── */}
        {section === 'colors' && (
          <>
            <Text style={[styles.sectionTitle, { color: skin.textColor + '77' }]}>ACCENT COLORS</Text>
            <ColorPicker label="Primary Accent" value={skin.accentPrimary} propKey="accentPrimary" />
            <ColorPicker label="Secondary Accent" value={skin.accentSecondary} propKey="accentSecondary" />
            <ColorPicker label="Background" value={skin.backgroundColor} propKey="backgroundColor" />
            <ColorPicker label="Text Color" value={skin.textColor} propKey="textColor" />
            <ColorPicker label="Progress Start" value={skin.progressStart} propKey="progressStart" />
            <ColorPicker label="Progress End" value={skin.progressEnd} propKey="progressEnd" />
          </>
        )}

        {/* ── Text & Typography ────────────────────────────────────────── */}
        {section === 'text' && (
          <>
            <Text style={[styles.sectionTitle, { color: skin.textColor + '77' }]}>FONT SIZE</Text>
            <View style={styles.optionRow}>
              {FONT_SCALES.map(({ label, value }) => (
                <TouchableOpacity
                  key={value}
                  onPress={() => updateSkinProp('fontSizeScale', value)}
                  style={[styles.optionChip, {
                    backgroundColor: skin.fontSizeScale === value ? skin.accentPrimary : skin.textColor + '11',
                    borderColor: skin.fontSizeScale === value ? skin.accentPrimary : skin.textColor + '22',
                    flex: 1,
                  }]}
                >
                  <Text style={[styles.optionChipText, { color: skin.fontSizeScale === value ? '#fff' : skin.textColor + '88' }]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.sectionTitle, { color: skin.textColor + '77', marginTop: 8 }]}>MINI PLAYER STYLE</Text>
            <View style={styles.optionRow}>
              {(['standard', 'slim', 'bubble'] as const).map(style => (
                <TouchableOpacity
                  key={style}
                  onPress={() => updateSkinProp('miniPlayerStyle', style)}
                  style={[styles.optionChip, {
                    backgroundColor: skin.miniPlayerStyle === style ? skin.accentPrimary : skin.textColor + '11',
                    borderColor: skin.miniPlayerStyle === style ? skin.accentPrimary : skin.textColor + '22',
                    flex: 1,
                  }]}
                >
                  <Text style={[styles.optionChipText, { color: skin.miniPlayerStyle === style ? '#fff' : skin.textColor + '88' }]}>
                    {style.charAt(0).toUpperCase() + style.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.sectionTitle, { color: skin.textColor + '77', marginTop: 8 }]}>BUTTON STYLE</Text>
            <View style={[styles.optionRow, { flexWrap: 'wrap' }]}>
              {(['pill', 'square', 'circle', 'ghost', 'text'] as const).map(style => (
                <TouchableOpacity
                  key={style}
                  onPress={() => updateSkinProp('buttonStyle', style)}
                  style={[styles.optionChip, {
                    backgroundColor: skin.buttonStyle === style ? skin.accentPrimary : skin.textColor + '11',
                    borderColor: skin.buttonStyle === style ? skin.accentPrimary : skin.textColor + '22',
                  }]}
                >
                  <Text style={[styles.optionChipText, { color: skin.buttonStyle === style ? '#fff' : skin.textColor + '88' }]}>
                    {style.charAt(0).toUpperCase() + style.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.sectionTitle, { color: skin.textColor + '77', marginTop: 8 }]}>BUTTON SIZE</Text>
            <View style={styles.optionRow}>
              {(['compact', 'normal', 'large'] as const).map(size => (
                <TouchableOpacity
                  key={size}
                  onPress={() => updateSkinProp('buttonSize', size)}
                  style={[styles.optionChip, {
                    backgroundColor: skin.buttonSize === size ? skin.accentPrimary : skin.textColor + '11',
                    borderColor: skin.buttonSize === size ? skin.accentPrimary : skin.textColor + '22',
                    flex: 1,
                  }]}
                >
                  <Text style={[styles.optionChipText, { color: skin.buttonSize === size ? '#fff' : skin.textColor + '88' }]}>
                    {size.charAt(0).toUpperCase() + size.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* ── Art ───────────────────────────────────────────────────────── */}
        {section === 'art' && (
          <>
            <Text style={[styles.sectionTitle, { color: skin.textColor + '77' }]}>ALBUM ART SHAPE</Text>
            <View style={[styles.optionRow, { flexWrap: 'wrap' }]}>
              {(['square', 'rounded-square', 'circle', 'blob'] as const).map(shape => (
                <TouchableOpacity
                  key={shape}
                  onPress={() => updateSkinProp('albumArtShape', shape)}
                  style={[styles.optionChip, {
                    backgroundColor: skin.albumArtShape === shape ? skin.accentPrimary : skin.textColor + '11',
                    borderColor: skin.albumArtShape === shape ? skin.accentPrimary : skin.textColor + '22',
                  }]}
                >
                  <Text style={[styles.optionChipText, { color: skin.albumArtShape === shape ? '#fff' : skin.textColor + '88' }]}>
                    {shape === 'rounded-square' ? 'Rounded' : shape.charAt(0).toUpperCase() + shape.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Toggle label="Rotation" propKey="albumArtRotation" />
            <Toggle label="Glow Effect" propKey="albumArtGlow" />
            <Toggle label="Reflection" propKey="albumArtReflection" />
          </>
        )}

        {/* ── Effects ───────────────────────────────────────────────────── */}
        {section === 'effects' && (
          <>
            <Text style={[styles.sectionTitle, { color: skin.textColor + '77' }]}>VISUALIZER STYLE</Text>
            <View style={[styles.optionRow, { flexWrap: 'wrap' }]}>
              {(['circular-rings', 'bar-spectrum', 'waveform', 'floating-particles', 'none'] as const).map(v => (
                <TouchableOpacity
                  key={v}
                  onPress={() => updateSkinProp('visualizerStyle', v)}
                  style={[styles.optionChip, {
                    backgroundColor: skin.visualizerStyle === v ? skin.accentPrimary : skin.textColor + '11',
                    borderColor: skin.visualizerStyle === v ? skin.accentPrimary : skin.textColor + '22',
                  }]}
                >
                  <Text style={[styles.optionChipText, { color: skin.visualizerStyle === v ? '#fff' : skin.textColor + '88' }]}>
                    {v === 'circular-rings' ? 'Rings' : v === 'bar-spectrum' ? 'Bars' : v === 'floating-particles' ? 'Particles' : v.charAt(0).toUpperCase() + v.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.sectionTitle, { color: skin.textColor + '77', marginTop: 8 }]}>VISUALIZER COLOR</Text>
            <View style={[styles.optionRow, { flexWrap: 'wrap' }]}>
              {(['aurora-match', 'fixed-accent', 'rainbow', 'white'] as const).map(mode => (
                <TouchableOpacity
                  key={mode}
                  onPress={() => updateSkinProp('visualizerColorMode', mode)}
                  style={[styles.optionChip, {
                    backgroundColor: skin.visualizerColorMode === mode ? skin.accentPrimary : skin.textColor + '11',
                    borderColor: skin.visualizerColorMode === mode ? skin.accentPrimary : skin.textColor + '22',
                  }]}
                >
                  <Text style={[styles.optionChipText, { color: skin.visualizerColorMode === mode ? '#fff' : skin.textColor + '88' }]}>
                    {mode === 'aurora-match' ? 'Auto' : mode === 'fixed-accent' ? 'Accent' : mode.charAt(0).toUpperCase() + mode.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Toggle label="Pulse on Beat" propKey="pulseOnBeat" />
            <Toggle label="Shake on Skip" propKey="albumArtShakeOnSkip" />
            <Toggle label="Bloom / Glow Blur" propKey="bloomBlur" />
          </>
        )}
      </ScrollView>

      {/* Save modal */}
      <Modal visible={saveModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: skin.backgroundColor, borderColor: skin.textColor + '22' }]}>
            <Text style={[styles.modalTitle, { color: skin.textColor }]}>Save Skin</Text>
            <TextInput
              value={saveName}
              onChangeText={setSaveName}
              placeholder="Skin name..."
              placeholderTextColor={skin.textColor + '55'}
              style={[styles.modalInput, { color: skin.textColor, borderColor: skin.textColor + '30', backgroundColor: skin.textColor + '0A' }]}
              autoFocus
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity onPress={() => setSaveModal(false)} style={[styles.modalBtn, { backgroundColor: skin.textColor + '15' }]}>
                <Text style={[styles.modalBtnText, { color: skin.textColor + '88' }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { if (saveName.trim()) { saveSkin(saveName.trim()); setSaveName(''); setSaveModal(false); } }}
                style={[styles.modalBtn, { backgroundColor: skin.accentPrimary }]}
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
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1,
  },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: 6 },
  saveBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, gap: 6 },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  preview: { margin: 16, borderRadius: 16, overflow: 'hidden', padding: 12, gap: 8, borderWidth: 1 },
  previewInner: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  previewArt: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  previewTitle: { fontWeight: '700' },
  previewArtist: { fontSize: 12 },
  previewPlay: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  previewProgress: { height: 3, borderRadius: 3, overflow: 'hidden' },
  previewProgressFill: { height: '100%', borderRadius: 3 },
  sectionTabs: { flexDirection: 'row', paddingHorizontal: 8, borderBottomWidth: 1 },
  sectionTab: { flex: 1, paddingVertical: 11, alignItems: 'center', borderBottomWidth: 2 },
  sectionTabText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 },
  presetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  presetCard: { width: '30%', height: 72, borderRadius: 14, overflow: 'hidden', padding: 10, justifyContent: 'space-between' },
  presetName: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  presetDot: { width: 10, height: 10, borderRadius: 5 },
  presetCheck: { position: 'absolute', top: 6, right: 6, width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  savedRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, borderWidth: 1, gap: 10 },
  savedDot: { width: 12, height: 12, borderRadius: 6 },
  savedName: { flex: 1, fontSize: 14, fontWeight: '600' },
  applyBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  applyBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  colorRow: { gap: 8 },
  colorLabel: { fontSize: 12, fontWeight: '600' },
  colorSwatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  swatch: { width: 30, height: 30, borderRadius: 15 },
  optionRow: { flexDirection: 'row', gap: 8 },
  optionChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
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
