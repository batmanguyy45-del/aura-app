export function getApiBase(): string {
  const apiDomain = process.env.EXPO_PUBLIC_API_DOMAIN || process.env.EXPO_PUBLIC_DOMAIN;
  if (apiDomain) {
    return `https://${apiDomain}/api`;
  }
  return '/api';
}

export function getStreamUrl(videoId: string): string {
  return `${getApiBase()}/stream/${videoId}`;
}

async function getYouTubeStreamUrl(videoId: string): Promise<string | null> {
  const clients = [
    {
      name: 'ANDROID',
      version: '19.29.37',
      key: '3',
      sdkVersion: 30,
      userAgent: 'com.google.android.youtube/19.29.37 (Linux; U; Android 11) gzip',
    },
    {
      name: 'IOS',
      version: '19.29.1',
      key: '5',
      userAgent: 'com.google.ios.youtube/19.29.1 (iPhone14,3; U; CPU iOS 15_6 like Mac OS X)',
    },
    {
      name: 'TVHTML5',
      version: '7.20230913',
      key: '7',
      userAgent: 'Mozilla/5.0 (SMART-TV; LINUX; Tizen 5.0) AppleWebKit/537.36',
    },
  ];

  for (const client of clients) {
    try {
      const resp = await fetch('https://www.youtube.com/youtubei/v1/player', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': client.userAgent,
          'X-Youtube-Client-Name': client.key,
          'X-Youtube-Client-Version': client.version,
        },
        body: JSON.stringify({
          context: {
            client: {
              clientName: client.name,
              clientVersion: client.version,
              ...(client.sdkVersion ? { androidSdkVersion: client.sdkVersion } : {}),
              hl: 'en',
              gl: 'US',
            },
          },
          videoId,
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (!resp.ok) continue;
      const data = await resp.json() as {
        streamingData?: {
          adaptiveFormats?: Array<{ url?: string; mimeType?: string; bitrate?: number }>;
          formats?: Array<{ url?: string; mimeType?: string; bitrate?: number }>;
        };
      };

      const formats = [
        ...(data.streamingData?.adaptiveFormats ?? []),
        ...(data.streamingData?.formats ?? []),
      ].filter(f => f.url && f.mimeType?.includes('audio'))
       .sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0));

      if (formats[0]?.url) return formats[0].url;
    } catch {}
  }
  return null;
}

export async function resolveStreamUrl(videoId: string): Promise<string> {
  const url = await getYouTubeStreamUrl(videoId);
  if (url) return url;
  return getStreamUrl(videoId);
}
