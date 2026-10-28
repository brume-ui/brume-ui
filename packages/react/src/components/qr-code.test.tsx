import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { QrCode } from './qr-code';

describe('QrCode', () => {
  it('renders an <svg role="img"> named by label, 160px by default', () => {
    render(<QrCode value="https://example.com/orders/42" label="訂單 42 的 QR Code" />);
    const svg = screen.getByRole('img', { name: '訂單 42 的 QR Code' });
    expect(svg.tagName.toLowerCase()).toBe('svg');
    expect(svg.getAttribute('width')).toBe('160');
    // 4-module quiet zone: the first dark module (finder pattern corner) is at (4, 4).
    expect(svg.querySelector('path')?.getAttribute('d')).toMatch(/^M4 4h1/);
  });

  it('honours size', () => {
    render(<QrCode value="x" label="QR" size={96} />);
    expect(screen.getByRole('img', { name: 'QR' }).getAttribute('height')).toBe('96');
  });
});
