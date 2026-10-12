import { describe, it, expect, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { Toaster, dismissToast, toast } from '@/components/ui/toast';

describe('a toast', () => {
  it('can be taken down before its time, but only while it is the one up', () => {
    render(<Toaster />);
    const onGone = vi.fn();
    let first = 0;
    act(() => void (first = toast('Insurance?', { onGone })));
    expect(screen.getByText('Insurance?')).toBeInTheDocument();
    act(() => dismissToast(first));
    expect(screen.queryByText('Insurance?')).not.toBeInTheDocument();
    expect(onGone).toHaveBeenCalledTimes(1);
    act(() => void toast('Next'));
    // The first is long gone: taking it down again leaves the new one up.
    act(() => dismissToast(first));
    expect(screen.getByText('Next')).toBeInTheDocument();
  });
});
