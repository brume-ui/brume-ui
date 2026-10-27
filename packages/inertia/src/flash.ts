import { toast } from '@herb09638/brume-react';
import type { Flash } from '@herb09638/brume-schema';
import { useEffect, useRef } from 'react';

/** Toasts each flash once per id; a new id with the same message toasts again. */
export function useFlashToast(flash: Flash | null): void {
  const lastId = useRef<string | null>(null);
  useEffect(() => {
    if (!flash || flash.id === lastId.current) return;
    lastId.current = flash.id;
    toast[flash.type](flash.message, { id: flash.id });
  }, [flash]);
}
