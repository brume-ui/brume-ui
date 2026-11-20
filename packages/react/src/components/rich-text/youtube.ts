const ID = /^[A-Za-z0-9_-]{11}$/;
const HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com']);

/** watch?v=, youtu.be/, shorts/, embed/ -> embed URL; youtube-nocookie.com keeps its host; anything else null. */
export function youtubeEmbedUrl(input: string): string | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  const host = url.hostname.toLowerCase();
  const parts = url.pathname.split('/').filter(Boolean);
  let id: string | null = null;
  let embedHost = 'www.youtube.com';

  if (host === 'youtu.be') {
    id = parts[0] ?? null;
  } else if (host === 'www.youtube-nocookie.com' || host === 'youtube-nocookie.com') {
    if (parts[0] !== 'embed') return null;
    id = parts[1] ?? null;
    embedHost = 'www.youtube-nocookie.com';
  } else if (HOSTS.has(host)) {
    if (parts[0] === 'watch') id = url.searchParams.get('v');
    else if (parts[0] === 'shorts' || parts[0] === 'embed') id = parts[1] ?? null;
  }
  return id && ID.test(id) ? `https://${embedHost}/embed/${id}` : null;
}
