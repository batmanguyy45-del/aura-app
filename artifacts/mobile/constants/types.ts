export interface Track {
  id: string;
  title: string;
  artist: string;
  album?: string;
  genre?: string;
  year?: string;
  duration: number;
  thumbnail: string;
  sourceUrl?: string;
  sourceType?: string;
  format?: string;
  bitrate?: number;
  downloadedAt?: number;
  playCount: number;
  lastPlayed?: number;
  liked: boolean;
  tags?: string[];
}

export interface SearchResult {
  id: string;
  title: string;
  artist: string;
  duration: number;
  thumbnail: string;
  views?: number;
  type?: string;
}

export interface Playlist {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  coverArt?: string;
  trackIds: string[];
  description?: string;
}

export interface HistoryEntry {
  id: string;
  trackId: string;
  title: string;
  artist: string;
  thumbnail: string;
  playedAt: number;
  duration: number;
}

export interface EQBand {
  frequency: number;
  gain: number;
}

export interface EQSettings {
  preampGain: number;
  bands: EQBand[];
  bassBoost: boolean;
  trebleBoost: boolean;
  stereoExpansion: number;
  reverbEnabled: boolean;
  reverbSize: number;
  pitch: number;
  tempo: number;
  monoMix: boolean;
  balance: number;
}

export interface SkinConfig {
  id: string;
  name: string;
  backgroundStyle: 'aurora-dynamic' | 'solid' | 'gradient';
  backgroundColor: string;
  accentPrimary: string;
  accentSecondary: string;
  textColor: string;
  glassTint: string;
  glassBlur: number;
  glassOpacity: number;
  progressStart: string;
  progressEnd: string;
  fontSizeScale: number;
  letterSpacing: string;
  textGlow: number;
  visualizerStyle: 'circular-rings' | 'bar-spectrum' | 'waveform' | 'floating-particles' | 'dna-helix' | 'none';
  visualizerColorMode: 'aurora-match' | 'fixed-accent' | 'rainbow' | 'white';
  visualizerIntensity: number;
  albumArtSize: 'small' | 'medium' | 'large' | 'full-bleed';
  albumArtShape: 'square' | 'rounded-square' | 'circle' | 'blob';
  albumArtRotation: boolean;
  albumArtGlow: boolean;
  albumArtGlowIntensity: number;
  albumArtReflection: boolean;
  buttonStyle: 'pill' | 'square' | 'circle' | 'ghost' | 'text';
  buttonSize: 'compact' | 'normal' | 'large';
  pulseOnBeat: boolean;
  albumArtShakeOnSkip: boolean;
  bloomBlur: boolean;
  miniPlayerStyle: 'standard' | 'slim' | 'bubble';
}
