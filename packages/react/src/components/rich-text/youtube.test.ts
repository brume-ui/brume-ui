import { describe, expect, it } from 'vitest';
import { youtubeEmbedUrl } from './youtube';

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
