import type { BrumeAdapter, NavigationTarget, VisitOptions } from './adapter';
import type { HttpRequest, HttpResponse } from './http';

export interface MemoryAdapterOptions {
  respond?(req: HttpRequest): HttpResponse | Promise<HttpResponse>;
}

const pathAndQuery = (url: string) => url.split('#')[0];

/** Mirrors the Inertia adapter: a visit that stays on the current page is never guarded. */
function isSamePage(target: string, current: string, options?: VisitOptions): boolean {
  if (options?.only?.length) return true;
  return pathAndQuery(target) === pathAndQuery(current);
}

export function createMemoryAdapter(
  initialUrl = '/',
  opts: MemoryAdapterOptions = {},
): BrumeAdapter & { calls: Array<{ fn: string; args: unknown[] }> } {
  let url = initialUrl;
  const guards: Array<{ allow: (target: NavigationTarget) => boolean }> = [];
  const calls: Array<{ fn: string; args: unknown[] }> = [];
  return {
    calls,
    visit(...args) {
      if (!isSamePage(args[0], url, args[1])) {
        for (const guard of [...guards]) if (!guard.allow({ url: args[0] })) return;
      }
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
      const guard = { allow };
      guards.push(guard);
      return () => {
        const index = guards.indexOf(guard);
        if (index >= 0) guards.splice(index, 1);
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
