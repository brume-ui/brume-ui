import type { BrumeAdapter } from './adapter';
import type { HttpRequest, HttpResponse } from './http';

export interface MemoryAdapterOptions {
  respond?(req: HttpRequest): HttpResponse | Promise<HttpResponse>;
}

export function createMemoryAdapter(
  initialUrl = '/',
  opts: MemoryAdapterOptions = {},
): BrumeAdapter & { calls: Array<{ fn: string; args: unknown[] }> } {
  let url = initialUrl;
  const guards = new Set<(url: string) => boolean>();
  const calls: Array<{ fn: string; args: unknown[] }> = [];
  return {
    calls,
    visit(...args) {
      for (const allow of [...guards]) if (!allow(args[0])) return;
      calls.push({ fn: 'visit', args });
      url = args[0];
    },
    reload(...args) {
      calls.push({ fn: 'reload', args });
    },
    submit(...args) {
      calls.push({ fn: 'submit', args });
    },
    guardNavigation(allow) {
      guards.add(allow);
      return () => {
        guards.delete(allow);
      };
    },
    currentUrl: () => url,
    async request<T>(req: HttpRequest) {
      calls.push({ fn: 'request', args: [req] });
      const res = opts.respond ? await opts.respond(req) : { status: 200, data: {} };
      return res as HttpResponse<T>;
    },
  };
}
