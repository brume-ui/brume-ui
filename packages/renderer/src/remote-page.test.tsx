import {
  BrumeProvider,
  createFetchAdapter,
  createMemoryAdapter,
  type HttpRequest,
  type HttpResponse,
} from '@brume-ui/brume-react';
import type { PageEnvelope } from '@brume-ui/brume-schema';
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRegistry } from './registry';
import { RegistryProvider } from './registry-context';
import { BrumeRemotePage, type BrumeRemotePageProps } from './remote-page';

const dashboard = (title: string): PageEnvelope => ({
  schemaVersion: '0.1.0',
  page: { type: 'dashboard', title, blocks: [] },
});

beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  window.history.replaceState(null, '', '/');
});

function mount(
  respond: (req: HttpRequest) => HttpResponse | Promise<HttpResponse>,
  props: BrumeRemotePageProps = {},
) {
  const request = vi.fn(async (req: HttpRequest) => respond(req));
  const adapter = createFetchAdapter({ request });
  render(
    <BrumeProvider adapter={adapter}>
      <RegistryProvider registry={createRegistry({ mode: 'precompiled' })}>
        <BrumeRemotePage {...props} />
      </RegistryProvider>
    </BrumeProvider>,
  );
  return { adapter, request };
}

describe('BrumeRemotePage', () => {
  it('loads the current url, then each visit, through pageUrl', async () => {
    window.history.replaceState(null, '', '/admin');
    const onPage = vi.fn();
    const { adapter, request } = mount(
      (req) => ({ status: 200, data: dashboard(req.url === '/api/admin' ? 'Home' : 'Users') }),
      { pageUrl: (url) => `/api${url}`, loading: <p>Loading…</p>, onPage },
    );
    expect(screen.getByText('Loading…')).toBeTruthy();
    expect(await screen.findByRole('heading', { name: 'Home' })).toBeTruthy();
    act(() => adapter.visit('/admin/users'));
    expect(await screen.findByRole('heading', { name: 'Users' })).toBeTruthy();
    expect(request.mock.calls.map(([req]) => req.url)).toEqual(['/api/admin', '/api/admin/users']);
    expect(onPage).toHaveBeenCalledTimes(2);
    // The first load keeps the scroll; a plain visit starts at the top.
    expect(window.scrollTo).toHaveBeenCalledTimes(1);
  });

  it('shows an error page envelope as the page, whatever its status', async () => {
    mount(() => ({
      status: 404,
      data: {
        schemaVersion: '0.1.0',
        page: { type: 'error', status: 404, title: '找不到頁面', message: '這個頁面不存在。' },
      },
    }));
    expect(await screen.findByRole('heading', { name: '找不到頁面' })).toBeTruthy();
  });

  it('shows the server message, or a generic one, for a response that is not a page', async () => {
    mount(() => ({ status: 500, data: { message: '資料庫掛了' } }));
    expect((await screen.findByRole('alert')).textContent).toContain('資料庫掛了');
  });

  it('a 200 that is not an envelope says the server did not return a page', async () => {
    mount(() => ({ status: 200, data: { hello: 'world' } }));
    expect((await screen.findByRole('alert')).textContent).toContain('伺服器回傳的不是 Brume 頁面');
  });

  it('an older response that arrives late never replaces the newer page', async () => {
    let releaseSlow: (res: HttpResponse) => void = () => {};
    const { adapter } = mount((req) =>
      req.url === '/slow'
        ? new Promise<HttpResponse>((resolve) => {
            releaseSlow = resolve;
          })
        : { status: 200, data: dashboard(req.url === '/' ? 'Start' : 'Fast') },
    );
    await screen.findByRole('heading', { name: 'Start' });
    act(() => adapter.visit('/slow'));
    act(() => adapter.visit('/fast'));
    expect(await screen.findByRole('heading', { name: 'Fast' })).toBeTruthy();
    await act(async () => releaseSlow({ status: 200, data: dashboard('Slow') }));
    expect(screen.queryByRole('heading', { name: 'Slow' })).toBeNull();
  });

  it('refuses an adapter without subscribe', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() =>
      render(
        <BrumeProvider adapter={createMemoryAdapter()}>
          <BrumeRemotePage />
        </BrumeProvider>,
      ),
    ).toThrow('createFetchAdapter');
  });
});
