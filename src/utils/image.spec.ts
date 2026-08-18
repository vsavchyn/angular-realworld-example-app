import { describe, expect, it } from 'vitest';
import { defaultImage } from './image';

describe('defaultImage', () => {
  it('returns the default avatar when image is missing', () => {
    expect(defaultImage(null)).toBe('/assets/default-avatar.svg');
    expect(defaultImage(undefined)).toBe('/assets/default-avatar.svg');
    expect(defaultImage('')).toBe('/assets/default-avatar.svg');
  });

  it('returns a normal https URL unchanged', () => {
    expect(defaultImage('https://example.com/me.png')).toBe('https://example.com/me.png');
  });

  it('rejects javascript and data URLs', () => {
    expect(defaultImage('javascript:alert(1)')).toBe('/assets/default-avatar.svg');
    expect(defaultImage('data:text/html,<script>alert(1)</script>')).toBe('/assets/default-avatar.svg');
  });
});
