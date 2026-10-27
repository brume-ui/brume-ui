import type { SharedProps } from '@brume-ui/brume-schema';
import { usePage } from '@inertiajs/react';

export function useShared(): SharedProps['brume'] {
  return usePage<SharedProps>().props.brume;
}
