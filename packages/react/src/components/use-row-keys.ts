import { useRef } from 'react';

/**
 * Client-side identity for rows of a plain value array, so editing or moving a row never remounts
 * it. The array is kept in step with `length`; the caller mirrors every add, remove and move
 * before it calls `onChange`.
 */
export function useRowKeys(length: number) {
  const keys = useRef<string[]>([]);
  const seq = useRef(0);
  const next = () => `row-${++seq.current}`;
  const list = keys.current;
  while (list.length < length) list.push(next());
  if (list.length > length) list.length = length;
  return {
    keys: list,
    insert(index: number) {
      list.splice(index, 0, next());
    },
    remove(index: number) {
      list.splice(index, 1);
    },
    move(from: number, to: number) {
      const [key] = list.splice(from, 1);
      if (key !== undefined) list.splice(to, 0, key);
    },
  };
}
