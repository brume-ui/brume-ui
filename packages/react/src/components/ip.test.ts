import { describe, expect, it } from 'vitest';
import { isIp } from './ip';

/**
 * The shared table: the Laravel `ip` rule must give the same answer for every row.
 * Columns: input, no version, version 4, version 6.
 */
const TABLE: [string, boolean, boolean, boolean][] = [
  // IPv4
  ['192.168.1.1', true, true, false],
  ['0.0.0.0', true, true, false],
  ['255.255.255.255', true, true, false],
  ['256.1.1.1', false, false, false],
  ['1.2.3.256', false, false, false],
  ['01.2.3.4', false, false, false],
  ['1.2.3.04', false, false, false],
  ['00.1.1.1', false, false, false],
  ['1.2.3', false, false, false],
  ['1.2.3.4.5', false, false, false],
  ['1..3.4', false, false, false],
  ['1.2.3.', false, false, false],
  ['.1.2.3', false, false, false],
  ['1.2.3.a', false, false, false],
  ['1.2.3.-4', false, false, false],
  ['1.2.3.+4', false, false, false],
  ['1.2.3.0x4', false, false, false],
  ['1.2.3.1000', false, false, false],
  ['１.2.3.4', false, false, false],
  // IPv6
  ['::', true, false, true],
  ['::1', true, false, true],
  ['1::', true, false, true],
  ['2001:db8::8a2e:370:7334', true, false, true],
  ['2001:0db8:0000:0000:0000:8a2e:0370:7334', true, false, true],
  ['2001:DB8::1', true, false, true],
  ['1:2:3:4:5:6:7:8', true, false, true],
  ['1:2:3:4:5:6:7::', true, false, true],
  ['::2:3:4:5:6:7:8', true, false, true],
  ['1:2:3:4:5:6:7:8:9', false, false, false],
  ['1:2:3:4:5:6:7', false, false, false],
  ['1:2:3:4:5:6:7::8', false, false, false],
  ['1::2::3', false, false, false],
  [':::', false, false, false],
  ['1:::2', false, false, false],
  [':1:2:3:4:5:6:7', false, false, false],
  ['1:2:3:4:5:6:7:', false, false, false],
  ['12345::1', false, false, false],
  ['g::1', false, false, false],
  ['::ffff:192.0.2.1', true, false, true],
  ['::192.0.2.1', true, false, true],
  ['1:2:3:4:5:6:1.2.3.4', true, false, true],
  ['1:2:3:4:5:6:7:1.2.3.4', false, false, false],
  ['::ffff:256.0.2.1', false, false, false],
  ['::ffff:01.0.2.1', false, false, false],
  ['::1.2.3.4:5', false, false, false],
  ['1.2.3.4::', false, false, false],
  ['::ffff:1.2.3', false, false, false],
  // Not an address on its own
  ['fe80::1%eth0', false, false, false],
  ['[::1]', false, false, false],
  ['[::1]:80', false, false, false],
  ['1.2.3.4:80', false, false, false],
  ['1.2.3.4/24', false, false, false],
  ['2001:db8::/32', false, false, false],
  [' 192.168.1.1', false, false, false],
  ['192.168.1.1 ', false, false, false],
  [' ::1', false, false, false],
  ['::1 ', false, false, false],
  ['192.168.1.1\n', false, false, false],
  ['', false, false, false],
  ['   ', false, false, false],
  ['abc', false, false, false],
  ['localhost', false, false, false],
];

describe('isIp', () => {
  it.each(TABLE)('%j: any %s, v4 %s, v6 %s', (input, any, v4, v6) => {
    expect(isIp(input)).toBe(any);
    expect(isIp(input, 4)).toBe(v4);
    expect(isIp(input, 6)).toBe(v6);
  });
});
