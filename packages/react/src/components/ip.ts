const V4_PART = /^(?:0|[1-9][0-9]{0,2})$/;
const V6_GROUP = /^[0-9a-fA-F]{1,4}$/;

function isV4(value: string): boolean {
  const parts = value.split('.');
  return parts.length === 4 && parts.every((p) => V4_PART.test(p) && Number(p) <= 255);
}

/** Groups of one side of an IPv6 address; null when malformed. `tail` allows an IPv4 ending. */
function groups(text: string, tail: boolean): number | null {
  if (text === '') return 0;
  const items = text.split(':');
  let count = 0;
  for (const [i, item] of items.entries()) {
    if (tail && i === items.length - 1 && item.includes('.')) {
      if (!isV4(item)) return null;
      count += 2;
    } else if (V6_GROUP.test(item)) {
      count += 1;
    } else {
      return null;
    }
  }
  return count;
}

function isV6(value: string): boolean {
  const halves = value.split('::');
  if (halves.length > 2) return false;
  const [head = '', rest] = halves;
  if (rest === undefined) {
    // No compression: exactly eight groups.
    return groups(head, true) === 8;
  }
  // `::` stands for at least one group of zeros; ':::' leaves a stray colon that fails below.
  const before = groups(head, false);
  const after = groups(rest, true);
  return before !== null && after !== null && before + after <= 7;
}

/**
 * Whether `value` is exactly an IPv4 or IPv6 address (`version` restricts it). No zone id,
 * brackets, port, CIDR or surrounding whitespace: callers trim first. Hand written so that the
 * Laravel rule can mirror it row by row (see ip.test.ts); IPv4 has no leading zeros.
 */
export function isIp(value: string, version?: 4 | 6): boolean {
  if (version !== 6 && isV4(value)) return true;
  if (version !== 4 && isV6(value)) return true;
  return false;
}
