import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Select } from '@/components/ui/select';

const OPTIONS = [
  { value: 'a', label: 'Apple' },
  { value: 'b', label: 'Banana' },
];

describe('Select', () => {
  it('lists only its options, so the iOS picker has no empty row', () => {
    render(<Select aria-label="Fruit" options={OPTIONS} value="b" onChange={() => {}} />);
    const select = screen.getByRole('combobox', { name: 'Fruit' }) as HTMLSelectElement;
    expect([...select.options].map(o => o.text)).toEqual(['Apple', 'Banana']);
    expect(select.selectedOptions[0].text).toBe('Banana');
  });
});
