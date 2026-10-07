import { describe, it, expect } from 'vitest';
import { money, dollars } from '@/core/money';

describe('money', () => {
  it('drops the cents of whole dollars and groups thousands', () => {
    expect(money(25)).toBe('$25');
    expect(money(1500)).toBe('$1,500');
    expect(money(12.5)).toBe('$12.50');
    expect(money(1234.5)).toBe('$1,234.50');
  });

  it('shows the bankroll to the cent', () => {
    expect(dollars(1010)).toBe('$1,010.00');
    expect(dollars(7.5)).toBe('$7.50');
  });
});
