import { router, usePage } from '@inertiajs/react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetSeenFlashMemory } from './flash';
import { LoginPage } from './pages/login';
import { makeShared } from './test-fixtures';

vi.mock('@inertiajs/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@inertiajs/react')>()),
  usePage: vi.fn(),
}));

beforeAll(() => {
  // Radix Checkbox measures itself with ResizeObserver, which jsdom lacks.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

beforeEach(() => {
  sessionStorage.clear();
  resetSeenFlashMemory();
  window.history.replaceState(null, '', '/admin/login');
  vi.mocked(usePage).mockReturnValue({
    url: '/admin/login',
    props: { brume: makeShared({ auth: { user: null } }) },
  } as unknown as ReturnType<typeof usePage>);
});
afterEach(() => vi.restoreAllMocks());

describe('LoginPage', () => {
  it('renders app name, fields, remember and the 登入 button, plus status', () => {
    render(<LoginPage status="密碼已重設，請用新密碼登入。" />);
    expect(screen.getByRole('heading', { level: 1, name: 'Brume Admin' })).toBeTruthy();
    expect(screen.getByLabelText(/^帳號/)).toBeTruthy();
    expect(screen.getByLabelText(/^密碼/)).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: '記住我' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '登入' })).toBeTruthy();
    expect(screen.getByText('密碼已重設，請用新密碼登入。')).toBeTruthy();
  });

  it('posts the form to the current path', async () => {
    const post = vi.spyOn(router, 'post').mockImplementation(() => {});
    render(<LoginPage />);
    await userEvent.type(screen.getByLabelText(/^帳號/), 'admin');
    await userEvent.type(screen.getByLabelText(/^密碼/), 'secret');
    await userEvent.click(screen.getByRole('checkbox', { name: '記住我' }));
    await userEvent.click(screen.getByRole('button', { name: '登入' }));
    expect(post).toHaveBeenCalledWith(
      '/admin/login',
      { username: 'admin', password: 'secret', remember: true },
      expect.anything(),
    );
  });

  it('marks and focuses the first invalid field when the server returns errors', async () => {
    vi.spyOn(router, 'post').mockImplementation((_url, _data, options) => {
      options?.onError?.({ password: '密碼錯誤', username: '帳號或密碼不正確，請再試一次。' });
      options?.onFinish?.({} as never);
    });
    render(<LoginPage />);
    await userEvent.click(screen.getByRole('button', { name: '登入' }));
    const username = screen.getByLabelText(/^帳號/);
    expect(username.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText('帳號或密碼不正確，請再試一次。')).toBeTruthy();
    expect(document.activeElement).toBe(username);
  });

  it('focuses password when only the password has an error', async () => {
    vi.spyOn(router, 'post').mockImplementation((_url, _data, options) => {
      options?.onError?.({ password: '密碼至少 8 個字元，請重新輸入。' });
    });
    render(<LoginPage />);
    await userEvent.click(screen.getByRole('button', { name: '登入' }));
    expect(document.activeElement).toBe(screen.getByLabelText(/^密碼/));
  });

  it('toasts the flash message', () => {
    vi.mocked(usePage).mockReturnValue({
      url: '/admin/login',
      props: {
        brume: makeShared({
          auth: { user: null },
          flash: { id: 'out1', type: 'info', message: '你已登出。' },
        }),
      },
    } as unknown as ReturnType<typeof usePage>);
    render(<LoginPage />);
    expect(screen.getByText('你已登出。')).toBeTruthy();
  });
});
