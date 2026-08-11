import { describe, it, expect } from 'vitest';
import { parseAcceptString, validateFile, resolveDynamicValue, formatFileSize } from '../src/utils';

describe('parseAcceptString', () => {
  it('returns undefined for empty/falsy input', () => {
    expect(parseAcceptString()).toBeUndefined();
    expect(parseAcceptString('')).toBeUndefined();
    expect(parseAcceptString('   ')).toBeUndefined();
  });

  it('maps concrete MIME types to an extension array', () => {
    const result = parseAcceptString('image/png,text/plain');
    expect(result).toEqual([
      { description: 'Files', accept: { 'image/png': [], 'text/plain': [] } },
    ]);
  });

  it('folds bare extensions under a catch-all type', () => {
    const result = parseAcceptString('.pdf,.zip');
    expect(result).toEqual([
      { description: 'Files', accept: { 'application/octet-stream': ['.pdf', '.zip'] } },
    ]);
  });

  it('expands wildcard subtypes into concrete MIME types for the native picker', () => {
    const result = parseAcceptString('image/*');
    expect(result).toBeDefined();
    expect(result![0].accept['image/jpeg']).toEqual([]);
    expect(result![0].accept['image/png']).toEqual([]);
    const mixed = parseAcceptString('image/*,application/pdf');
    expect(mixed?.[0].accept['application/pdf']).toEqual([]);
    expect(mixed?.[0].accept['image/jpeg']).toEqual([]);
  });
});

describe('validateFile', () => {
  const file = new File(['hello world'], 'a.txt', { type: 'text/plain' });

  it('passes with no constraints', () => {
    expect(validateFile(file)).toBeNull();
  });

  it('rejects oversized files', () => {
    expect(validateFile(file, { maxSize: 5 })).toMatch(/exceeds maximum/);
  });

  it('rejects disallowed types', () => {
    expect(validateFile(file, { allowedTypes: ['image/png'] })).toMatch(/not allowed/);
  });

  it('honors wildcard subtypes in allowedTypes', () => {
    const img = new File([''], 'a.png', { type: 'image/png' });
    expect(validateFile(img, { allowedTypes: ['image/*'] })).toBeNull();
  });
});

describe('resolveDynamicValue', () => {
  it('passes through static values', async () => {
    expect(await resolveDynamicValue({ a: '1' })).toEqual({ a: '1' });
    expect(await resolveDynamicValue(undefined)).toBeUndefined();
  });

  it('invokes sync and async factories', async () => {
    expect(await resolveDynamicValue(() => ({ t: 'sync' }))).toEqual({ t: 'sync' });
    expect(await resolveDynamicValue(async () => ({ t: 'async' }))).toEqual({ t: 'async' });
  });
});

describe('formatFileSize', () => {
  it('formats common magnitudes', () => {
    expect(formatFileSize(0)).toBe('0 Bytes');
    expect(formatFileSize(1024)).toBe('1 KB');
    expect(formatFileSize(1024 * 1024)).toBe('1 MB');
  });
});
