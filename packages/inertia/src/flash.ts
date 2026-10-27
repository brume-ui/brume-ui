import { toast } from '@brume-ui/brume-react';
import type { Flash } from '@brume-ui/brume-schema';
import { useEffect } from 'react';

export const SEEN_FLASH_STORAGE_KEY = 'brume.seen-flash';
const MAX_SEEN = 50;

// Module-level so it is shared by every layout/page; persisted so Back/Forward and full
// reloads (which restore old props from history.state) never re-toast a flash.
let seen: string[] | null = null;

function load(): string[] {
  if (seen) return seen;
  seen = [];
  try {
    const raw = sessionStorage.getItem(SEEN_FLASH_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) seen = parsed.filter((v): v is string => typeof v === 'string');
  } catch {
    // storage unavailable or corrupt: in-memory only
  }
  return seen;
}

/** Records the id; returns false when it was already seen. */
export function markFlashSeen(id: string): boolean {
  const list = load();
  if (list.includes(id)) return false;
  seen = [...list, id].slice(-MAX_SEEN);
  try {
    sessionStorage.setItem(SEEN_FLASH_STORAGE_KEY, JSON.stringify(seen));
  } catch {
    // storage unavailable: keep the in-memory set
  }
  return true;
}

/** Test hook: drops the in-memory set so the next access rehydrates from storage. */
export function resetSeenFlashMemory(): void {
  seen = null;
}

/** Toasts each flash id at most once per browser session; a new id with the same message toasts again. */
export function useFlashToast(flash: Flash | null): void {
  useEffect(() => {
    if (!flash || !markFlashSeen(flash.id)) return;
    toast[flash.type](flash.message, { id: flash.id });
  }, [flash]);
}
