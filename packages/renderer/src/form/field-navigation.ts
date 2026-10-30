import { createContext } from 'react';

/** Internal form navigation: composite fields reveal descendants before the root focuses them. */
export const FieldRevealContext = createContext<{
  register(path: string, reveal: () => void): () => void;
} | null>(null);

/** Keep one field-ID namespace when composite fields recurse through the ordinary Nodes. */
export const FieldIdPrefixContext = createContext<string | undefined>(undefined);
