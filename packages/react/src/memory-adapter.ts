import type { BrumeAdapter } from './adapter';

export function createMemoryAdapter(
  initialUrl = '/',
): BrumeAdapter & { calls: Array<{ fn: string; args: unknown[] }> } {
  let url = initialUrl;
  const calls: Array<{ fn: string; args: unknown[] }> = [];
  return {
    calls,
    visit(...args) {
      calls.push({ fn: 'visit', args });
      url = args[0];
    },
    reload(...args) {
      calls.push({ fn: 'reload', args });
    },
    submit(...args) {
      calls.push({ fn: 'submit', args });
    },
    currentUrl: () => url,
  };
}
