import { describe, expect, it } from 'vitest';
import { defaultImage } from './image';

const DEFAULT_AVATAR = '/assets/default-avatar.svg';

describe('defaultImage', () => {
  it('returns the default avatar when image is missing', () => {
    expect(defaultImage(null)).toBe(DEFAULT_AVATAR);
    expect(defaultImage(undefined)).toBe(DEFAULT_AVATAR);
    expect(defaultImage('')).toBe(DEFAULT_AVATAR);
    expect(defaultImage('   ')).toBe(DEFAULT_AVATAR);
  });

  it('returns a normal https URL unchanged', () => {
    expect(defaultImage('https://example.com/me.png')).toBe('https://example.com/me.png');
  });

  it('returns a normal http URL unchanged', () => {
    expect(defaultImage('http://example.com/me.png')).toBe('http://example.com/me.png');
  });

  it('returns same-origin relative paths unchanged', () => {
    expect(defaultImage('/assets/custom-avatar.png')).toBe('/assets/custom-avatar.png');
  });

  it('rejects javascript and data URLs', () => {
    expect(defaultImage('javascript:alert(1)')).toBe(DEFAULT_AVATAR);
    expect(defaultImage('data:text/html,<script>alert(1)</script>')).toBe(DEFAULT_AVATAR);
    expect(defaultImage('vbscript:msgbox(1)')).toBe(DEFAULT_AVATAR);
  });

  it('rejects protocol-relative and non-http schemes', () => {
    expect(defaultImage('//evil.example/avatar.png')).toBe(DEFAULT_AVATAR);
    expect(defaultImage('file:///etc/passwd')).toBe(DEFAULT_AVATAR);
    expect(defaultImage('blob:https://example.com/123')).toBe(DEFAULT_AVATAR);
  });
});
