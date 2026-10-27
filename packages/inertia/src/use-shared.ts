import type { SharedProps } from '@herb09638/brume-schema';
import { usePage } from '@inertiajs/react';

export function useShared(): SharedProps['brume'] {
  return usePage<SharedProps>().props.brume;
}
