import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';

const NUM_BARS = 18;

// Each bar has its own personality: speed range, min/max height
const BAR_PROFILES: { minH: number; maxH: number; speed: number }[] = [
  { minH: 4, maxH: 12, speed: 320 },
  { minH: 6, maxH: 20, speed: 270 },
  { minH: 8, maxH: 26, speed: 210 },
  { minH: 10, maxH: 30, speed: 180 },
  { minH: 12, maxH: 34, speed: 160 },
  { minH: 14, maxH: 36, speed: 140 },
  { minH: 16, maxH: 36, speed: 130 },
  { minH: 16, maxH: 34, speed: 125 },
  { minH: 18, maxH: 36, speed: 120 },
  { minH: 18, maxH: 36, speed: 125 },
  { minH: 16, maxH: 34, speed: 130 },
  { minH: 14, maxH: 36, speed: 140 },
  { minH: 12, maxH: 34, speed: 155 },
  { minH: 10, maxH: 30, speed: 175 },
  { minH: 8, maxH: 26, speed: 200 },
  { minH: 6, maxH: 20, speed: 255 },
  { minH: 4, maxH: 14, speed: 295 },
  { minH: 3, maxH: 10, speed: 340 },
];

interface Props {
  isPlaying: boolean;
  color: string;
  height?: number;
}

export function WaveformVisualizer({ isPlaying, color, height = 36 }: Props) {
  const bars = useRef<Animated.Value[]>(
    BAR_PROFILES.map(p => new Animated.Value(p.minH))
  ).current;
  const timers = useRef<ReturnType<typeof setInterval>[]>([]);

  useEffect(() => {
    // Clear any existing timers
    timers.current.forEach(t => clearInterval(t));
    timers.current = [];

    if (isPlaying) {
      bars.forEach((bar, i) => {
        const profile = BAR_PROFILES[i];
        const range = profile.maxH - profile.minH;

        // Stagger start so bars don't sync up
        const startDelay = i * 40;
        const timeout = setTimeout(() => {
          const animate = () => {
            const targetH = profile.minH + Math.random() * range;
            Animated.timing(bar, {
              toValue: targetH,
              duration: profile.speed + Math.random() * 80,
              useNativeDriver: false,
            }).start(({ finished }) => {
              if (finished) animate();
            });
          };
          animate();
        }, startDelay);

        timers.current.push(timeout as unknown as ReturnType<typeof setInterval>);
      });
    } else {
      // Gracefully collapse bars to idle state (low, non-uniform)
      bars.forEach((bar, i) => {
        const idleH = 3 + (i % 3) * 1.5;
        Animated.timing(bar, {
          toValue: idleH,
          duration: 300,
          useNativeDriver: false,
        }).start();
      });
    }

    return () => {
      timers.current.forEach(t => clearTimeout(t as unknown as ReturnType<typeof setTimeout>));
      timers.current = [];
    };
  }, [isPlaying]);

  return (
    <View style={[styles.container, { height }]}>
      {bars.map((bar, i) => (
        <Animated.View
          key={i}
          style={[
            styles.bar,
            {
              height: bar,
              backgroundColor: color,
              opacity: isPlaying ? 0.85 + (i % 3) * 0.05 : 0.3,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 3,
  },
  bar: {
    width: 3.5,
    borderRadius: 2,
    minHeight: 3,
  },
});
