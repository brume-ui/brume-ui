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
    async request<T>(req: HttpRequest) {
      calls.push({ fn: 'request', args: [req] });
      const res = opts.respond ? await opts.respond(req) : { status: 200, data: {} };
      return res as HttpResponse<T>;
    },
  };
}
