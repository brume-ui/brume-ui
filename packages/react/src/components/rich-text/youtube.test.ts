import { describe, expect, it } from 'vitest';
import { youtubeEmbedUrl, youtubeIframeHtml, youtubeVideoEmbed } from './youtube';

const ID = 'dQw4w9WgXcQ';
const EMBED = `https://www.youtube.com/embed/${ID}`;

describe('youtubeEmbedUrl', () => {
  it.each([
    [`https://www.youtube.com/watch?v=${ID}`, EMBED],
    [`https://youtube.com/watch?feature=share&v=${ID}&t=10s`, `${EMBED}?start=10`],
    [`https://youtu.be/${ID}?si=abc`, EMBED],
    [`https://www.youtube.com/shorts/${ID}`, EMBED],
    [`https://www.youtube.com/embed/${ID}`, EMBED],
    [
      `https://www.youtube-nocookie.com/embed/${ID}`,
      `https://www.youtube-nocookie.com/embed/${ID}`,
    ],
    [`  https://m.youtube.com/watch?v=${ID}  `, EMBED],
    ['https://vimeo.com/12345', null],
    [`https://youtube.com.evil.com/watch?v=${ID}`, null],
    [`https://evil.com/?youtube.com/watch?v=${ID}`, null],
    [`https://www.youtube.com/watch?v=${ID}x`, null],
    ['https://www.youtube.com/embed/videoseries?list=x', null],
    [`https://youtu.be/${ID}?t=42`, `${EMBED}?start=42`],
    [`https://youtu.be/${ID}?t=42s`, `${EMBED}?start=42`],
    [`https://www.youtube.com/watch?v=${ID}&start=7&list=x&autoplay=1`, `${EMBED}?start=7`],
    [`https://www.youtube.com/watch?v=${ID}&t=1h2m`, EMBED],
    ['https://www.youtube.com/watch?v=short', null],
    ['https://evil.example/watch?v=dQw4w9WgXcQ', null],
    ['javascript:alert(1)', null],
    ['', null],
    ['not a url', null],
  ])('%s', (input, expected) => {
    expect(youtubeEmbedUrl(input)).toBe(expected);
  });
});

describe('youtubeIframeHtml', () => {
  it('is the iframe the editor inserts (560x315, allowfullscreen), or null', () => {
    expect(youtubeIframeHtml(`https://youtu.be/${ID}?t=42`)).toBe(
      `<iframe src="${EMBED}?start=42" width="560" height="315" allowfullscreen></iframe>`,
    );
    expect(youtubeIframeHtml('https://vimeo.com/123456')).toBeNull();
  });
});

describe('youtubeVideoEmbed (Jodit video.parseUrlToVideoEmbed)', () => {
  it('turns YouTube URLs into the iframe and returns anything else unchanged', () => {
    expect(youtubeVideoEmbed(`https://www.youtube.com/watch?v=${ID}&t=7`)).toBe(
      `<iframe src="${EMBED}?start=7" width="560" height="315" allowfullscreen></iframe>`,
    );
    for (const url of [
      'https://vimeo.com/123456',
      'https://www.youtube.com/embed/videoseries?list=x',
      'https://www.youtube.com/embed/not-an-id',
      'https://example.com/a',
    ])
      expect(youtubeVideoEmbed(url)).toBe(url);
  });
});
