import { describe, it, expect } from 'vitest';
import { isStrategyFileText, normalizeImportedText, strategyCodeUrl } from '../../../public/src/settings/strategy-import.js';
import { STRATEGY_FILES } from '../../../public/src/data/strategy-files.js';

describe('strategyCodeUrl', () => {
  it('builds the site-relative download URL', () => {
    expect(strategyCodeUrl('12345')).toBe('/Apps/z12345.php');
  });

  it('trims and lowercases the code, as the original did', () => {
    expect(strategyCodeUrl('  12AB ')).toBe('/Apps/z12ab.php');
  });
});

describe('normalizeImportedText', () => {
  it('turns escaped spaces back into spaces', () => {
    expect(normalizeImportedText('|My%20Strategy|0|')).toBe('|My Strategy|0|');
  });
});

describe('isStrategyFileText', () => {
  it('accepts a real strategy file', () => {
    expect(isStrategyFileText(STRATEGY_FILES[30])).toBe(true);
  });

  it('rejects a server error page', () => {
    expect(isStrategyFileText('The page cannot be displayed because an internal server error has occurred.')).toBe(false);
  });

  it('rejects anything that is not pipe-delimited text', () => {
    expect(isStrategyFileText('')).toBe(false);
    expect(isStrategyFileText('|')).toBe(false);
    expect(isStrategyFileText('|name|')).toBe(false);
    expect(isStrategyFileText(null)).toBe(false);
    expect(isStrategyFileText(42)).toBe(false);
  });

  it('rejects a truncated strategy file', () => {
    expect(isStrategyFileText(STRATEGY_FILES[30].slice(0, 400))).toBe(false);
  });
});
