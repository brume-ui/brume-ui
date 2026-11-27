import { createContext } from 'react';

/** Internal form navigation: composite fields reveal descendants before the root focuses them. */
export const FieldRevealContext = createContext<{
  register(path: string, reveal: () => void): () => void;
} | null>(null);

/** Keep one field-ID namespace when composite fields recurse through the ordinary Nodes. */
export const FieldIdPrefixContext = createContext<string | undefined>(undefined);

/** The field a failed submit or an error-summary jump last targeted; `n` changes on every request. */
export const FieldsetRevealContext = createContext<{ path: string; n: number } | null>(null);
