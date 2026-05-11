import { useSkin } from '@/contexts/SkinContext';
import { useColors } from '@/hooks/useColors';

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return null;
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

function lighten(hex: string, amount: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const r = Math.min(255, rgb.r + amount);
  const g = Math.min(255, rgb.g + amount);
  const b = Math.min(255, rgb.b + amount);
  return `#${Math.round(r).toString(16).padStart(2, '0')}${Math.round(g).toString(16).padStart(2, '0')}${Math.round(b).toString(16).padStart(2, '0')}`;
}

export function useAppTheme() {
  const colors = useColors();
  const { skin } = useSkin();

  const bg = skin.backgroundColor;
  const fg = skin.textColor;
  const primary = skin.accentPrimary;

  return {
    ...colors,
    background: bg,
    card: lighten(bg, 12),
    foreground: fg,
    primary,
    primaryForeground: '#FFFFFF',
    secondary: skin.accentSecondary,
    muted: lighten(bg, 8),
    mutedForeground: fg + 'AA',
    border: fg + '18',
    destructive: '#FF4444',
    radius: colors.radius,
  };
}
