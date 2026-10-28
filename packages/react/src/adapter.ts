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
  request<T = unknown>(req: HttpRequest): Promise<HttpResponse<T>>;
}
