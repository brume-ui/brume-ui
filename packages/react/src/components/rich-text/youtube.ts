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
  if (!id || !ID.test(id) || id === 'videoseries') return null;
  const start = (url.searchParams.get('start') ?? url.searchParams.get('t') ?? '').match(
    /^(\d+)s?$/,
  );
  return `https://${embedHost}/embed/${id}${start ? `?start=${start[1]}` : ''}`;
}

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** The embed the editor inserts for a YouTube URL (video popup and pasted URL alike), or null. */
export function youtubeIframeHtml(input: string): string | null {
  const src = youtubeEmbedUrl(input);
  return src
    ? `<iframe src="${escapeAttr(src)}" width="560" height="315" allowfullscreen></iframe>`
    : null;
}

/**
 * Jodit's `video.parseUrlToVideoEmbed`, which its link plugin calls for a pasted URL: YouTube becomes
 * our iframe; anything else is returned unchanged, which Jodit then inserts as an ordinary link
 * (its own converter would embed Vimeo and any youtube.com/embed/… path, which the server deletes).
 */
export function youtubeVideoEmbed(url: string): string {
  return youtubeIframeHtml(url) ?? url;
}
