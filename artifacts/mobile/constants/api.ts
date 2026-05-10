export function getApiBase(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) {
    return `https://${domain}/api`;
  }
  return '/api';
}

export function getStreamUrl(videoId: string): string {
  return `${getApiBase()}/stream/${videoId}`;
}
