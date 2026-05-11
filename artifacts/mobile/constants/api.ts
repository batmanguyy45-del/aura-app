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
