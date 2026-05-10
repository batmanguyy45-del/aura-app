import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SkinConfig } from '@/constants/types';

export const VOID_SKIN: SkinConfig = {
  id: 'void-default',
  name: 'VOID',
  backgroundStyle: 'aurora-dynamic',
  backgroundColor: '#080810',
  accentPrimary: '#B347FF',
  accentSecondary: '#FF3CAC',
  textColor: '#F0F0FF',
  glassTint: 'rgba(8,8,16,0.58)',
  glassBlur: 24,
  glassOpacity: 0.58,
  progressStart: '#B347FF',
  progressEnd: '#FF3CAC',
  fontSizeScale: 1.0,
  letterSpacing: '0.01em',
  textGlow: 0.4,
  visualizerStyle: 'circular-rings',
  visualizerColorMode: 'aurora-match',
  visualizerIntensity: 0.75,
  albumArtSize: 'large',
  albumArtShape: 'rounded-square',
  albumArtRotation: false,
  albumArtGlow: true,
  albumArtGlowIntensity: 0.8,
  albumArtReflection: true,
  buttonStyle: 'pill',
  buttonSize: 'normal',
  pulseOnBeat: true,
  albumArtShakeOnSkip: true,
  bloomBlur: true,
  miniPlayerStyle: 'standard',
};

export const PRESET_SKINS: SkinConfig[] = [
  VOID_SKIN,
  {
    ...VOID_SKIN,
    id: 'chrome',
    name: 'CHROME',
    backgroundColor: '#0A0A0E',
    accentPrimary: '#C8C8D8',
    accentSecondary: '#8888AA',
    textColor: '#FFFFFF',
    progressStart: '#C8C8D8',
    progressEnd: '#8888AA',
  },
  {
    ...VOID_SKIN,
    id: 'ember',
    name: 'EMBER',
    backgroundColor: '#100808',
    accentPrimary: '#FF6B00',
    accentSecondary: '#FF2D00',
    textColor: '#FFF0E8',
    progressStart: '#FF6B00',
    progressEnd: '#FF2D00',
  },
  {
    ...VOID_SKIN,
    id: 'arctic',
    name: 'ARCTIC',
    backgroundColor: '#060C14',
    accentPrimary: '#00D4FF',
    accentSecondary: '#0088FF',
    textColor: '#F0FEFF',
    progressStart: '#00D4FF',
    progressEnd: '#0088FF',
  },
  {
    ...VOID_SKIN,
    id: 'matrix',
    name: 'MATRIX',
    backgroundColor: '#000A00',
    accentPrimary: '#00FF41',
    accentSecondary: '#008F11',
    textColor: '#CCFFCC',
    progressStart: '#00FF41',
    progressEnd: '#008F11',
  },
  {
    ...VOID_SKIN,
    id: 'cotton',
    name: 'COTTON',
    backgroundColor: '#100A10',
    accentPrimary: '#FFB3D9',
    accentSecondary: '#FF69B4',
    textColor: '#FFF0F8',
    progressStart: '#FFB3D9',
    progressEnd: '#FF69B4',
  },
];

interface SkinContextType {
  skin: SkinConfig;
  setSkin: (skin: SkinConfig) => void;
  savedSkins: SkinConfig[];
  saveSkin: (name: string) => void;
  deleteSkin: (id: string) => void;
  updateSkinProp: <K extends keyof SkinConfig>(key: K, value: SkinConfig[K]) => void;
}

const SkinContext = createContext<SkinContextType | null>(null);

export function SkinProvider({ children }: { children: React.ReactNode }) {
  const [skin, setSkinState] = useState<SkinConfig>(VOID_SKIN);
  const [savedSkins, setSavedSkins] = useState<SkinConfig[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem('@aura:skin');
        if (stored) setSkinState(JSON.parse(stored));
        const saved = await AsyncStorage.getItem('@aura:saved_skins');
        if (saved) setSavedSkins(JSON.parse(saved));
      } catch {}
    })();
  }, []);

  const setSkin = async (newSkin: SkinConfig) => {
    setSkinState(newSkin);
    try { await AsyncStorage.setItem('@aura:skin', JSON.stringify(newSkin)); } catch {}
  };

  const updateSkinProp = <K extends keyof SkinConfig>(key: K, value: SkinConfig[K]) => {
    const updated = { ...skin, [key]: value };
    setSkin(updated);
  };

  const saveSkin = async (name: string) => {
    const newSkin: SkinConfig = {
      ...skin,
      id: Date.now().toString() + Math.random().toString(36).substring(2, 7),
      name,
    };
    const updated = [...savedSkins, newSkin];
    setSavedSkins(updated);
    try { await AsyncStorage.setItem('@aura:saved_skins', JSON.stringify(updated)); } catch {}
  };

  const deleteSkin = async (id: string) => {
    const updated = savedSkins.filter(s => s.id !== id);
    setSavedSkins(updated);
    try { await AsyncStorage.setItem('@aura:saved_skins', JSON.stringify(updated)); } catch {}
  };

  return (
    <SkinContext.Provider value={{ skin, setSkin, savedSkins, saveSkin, deleteSkin, updateSkinProp }}>
      {children}
    </SkinContext.Provider>
  );
}

export function useSkin() {
  const ctx = useContext(SkinContext);
  if (!ctx) throw new Error('useSkin must be used within SkinProvider');
  return ctx;
}
