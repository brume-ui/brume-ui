import { describe, expect, it, vi } from 'vitest';
import { createMemoryAdapter } from './memory-adapter';

describe('createMemoryAdapter', () => {
  it('visit updates currentUrl and records the call', () => {
    const a = createMemoryAdapter('/start');
    expect(a.currentUrl()).toBe('/start');
    a.visit('/users?page=2', { replace: true });
    expect(a.currentUrl()).toBe('/users?page=2');
    expect(a.calls).toEqual([{ fn: 'visit', args: ['/users?page=2', { replace: true }] }]);
  });

  it('records reload and submit', () => {
    const a = createMemoryAdapter();
    a.reload({ only: ['rows'] });
    a.submit('post', '/x', { a: 1 });
    expect(a.calls.map((c) => c.fn)).toEqual(['reload', 'submit']);
  });
});

describe('createMemoryAdapter request', () => {
  it('defaults to 200 and records the call', async () => {
    const a = createMemoryAdapter();
    const res = await a.request({ method: 'get', url: '/x' });
    expect(res).toEqual({ status: 200, data: {} });
    expect(a.calls).toEqual([{ fn: 'request', args: [{ method: 'get', url: '/x' }] }]);
  });

  it('calls respond and returns its response', async () => {
    const respond = vi.fn(async () => ({ status: 422, data: { message: 'bad' } }));
    const a = createMemoryAdapter('/', { respond });
    const req = { method: 'post', url: '/y', body: { a: 1 } } as const;
    expect(await a.request(req)).toEqual({ status: 422, data: { message: 'bad' } });
    expect(respond).toHaveBeenCalledWith(req);
    expect(a.calls[0]?.fn).toBe('request');
  });
});

describe('createMemoryAdapter guardNavigation', () => {
  it('does not record a visit a guard refuses, and works again once unregistered', () => {
    const a = createMemoryAdapter('/start');
    const allow = vi.fn(() => false);
    const off = a.guardNavigation(allow);
    a.visit('/blocked');
    expect(allow).toHaveBeenCalledWith({ url: '/blocked' });
    expect(a.calls).toEqual([]);
    expect(a.currentUrl()).toBe('/start');
    off();
    a.visit('/ok');
    expect(a.calls).toEqual([{ fn: 'visit', args: ['/ok'] }]);
  });

  it('refuses when any guard refuses', () => {
    const a = createMemoryAdapter();
    a.guardNavigation(() => true);
    a.guardNavigation(() => false);
    a.visit('/x');
    expect(a.calls).toEqual([]);
  });

  it('never guards a visit that stays on the current page', () => {
    const a = createMemoryAdapter('/users?page=2');
    const allow = vi.fn(() => false);
    a.guardNavigation(allow);
    a.visit('/users?page=2');
    a.visit('/users?page=2#top');
    a.visit('/users?page=3', { only: ['rows'] });
    a.reload({ only: ['rows'] });
    expect(allow).not.toHaveBeenCalled();
    expect(a.calls.map((c) => c.fn)).toEqual(['visit', 'visit', 'visit', 'reload']);
    a.visit('/orders');
    expect(allow).toHaveBeenCalledWith({ url: '/orders' });
  });

  it('registering the same function twice and unregistering once leaves one guard', () => {
    const a = createMemoryAdapter();
    const allow = () => false;
    const off = a.guardNavigation(allow);
    a.guardNavigation(allow);
    off();
    a.visit('/x');
    expect(a.calls).toEqual([]);
  });
});
