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
   * Registers a check called before every navigation (a `visit`, including link clicks) and before
   * the tab closes; returning `false` cancels it. `allow` is read live, so a form that has just
   * saved should start returning `true` before it calls `visit` to leave. Only GET navigations are
   * checked: the form's own POST/PUT saves are never blocked. Returns the unregister function.
   */
  guardNavigation(allow: (url: string) => boolean): () => void;
  request<T = unknown>(req: HttpRequest): Promise<HttpResponse<T>>;
}
