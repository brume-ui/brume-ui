import type { HttpRequest, HttpResponse } from './http';

export interface VisitOptions {
  preserveScroll?: boolean;
  preserveState?: boolean;
  only?: string[];
  replace?: boolean;
}

export interface SubmitOptions {
  preserveScroll?: boolean;
  onSuccess?(): void;
  onError?(errors: Record<string, string>): void;
  onFinish?(): void;
}

export type NavigationTarget = { url: string } | { unload: true };

export interface BrumeAdapter {
  visit(url: string, options?: VisitOptions): void;
  reload(options?: { only?: string[] }): void;
  submit(
    method: 'post' | 'put' | 'patch' | 'delete',
    url: string,
    data: Record<string, unknown>,
    options?: SubmitOptions,
  ): void;
  currentUrl(): string;
  /**
   * Registers a check called before the user leaves the page, with `{ url }` for a navigation (a
   * `visit`, including link clicks) and `{ unload: true }` when the tab is closing or reloading;
   * returning `false` cancels it (for an unload, the browser shows its own confirm). Only real page
   * changes are asked: a GET to the current page (same path and query, a hash-only change too, and
   * `reload`), a partial reload (`only`) and prefetches pass without calling `allow`, so a list's
   * refresh is never blocked by a dirty form. Non-GET requests (the form's own POST/PUT) are never
   * checked either. `allow` is read live, so a form that has just saved should start returning
   * `true` before it calls `visit` to leave. Returns the unregister function.
   */
  guardNavigation(allow: (target: NavigationTarget) => boolean): () => void;
  request<T = unknown>(req: HttpRequest): Promise<HttpResponse<T>>;
}
