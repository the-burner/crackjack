// Buttons: filled (default, nav, primary), in two sizes, optionally full width
// and with an icon after the label (right) or under it (bottom).

import type { ComponentProps } from 'react';
import { cva } from 'class-variance-authority';
import type { VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Icon } from './icon';
import type { IconName } from './icon';

export const buttonVariants = cva(
  [
    'relative inline-flex cursor-pointer touch-manipulation items-center justify-center gap-2 rounded-(--radius-s) border-0 px-4 py-2.5 select-none',
    'min-h-(--control-h) text-body font-semibold transition-[background-color,transform,opacity] duration-150 active:scale-[0.98]',
    'disabled:cursor-default disabled:bg-(--btn-bg) disabled:text-(--btn-text) disabled:opacity-40 disabled:active:scale-100',
  ],
  {
    variants: {
      variant: {
        default: 'bg-(--btn-bg) text-(--btn-text) active:bg-(--btn-bg-active)',
        nav: 'bg-(--nav-bg) text-(--nav-text) active:bg-(--nav-bg-active)',
        primary: 'bg-(--primary-bg) text-(--primary-text) active:bg-(--primary-bg-active)',
      },
      large: { true: 'min-h-[52px] rounded-(--radius) text-title' },
      block: { true: 'flex w-full' },
      iconPos: { right: 'pr-10', bottom: 'flex-col gap-1' },
    },
    defaultVariants: { variant: 'default' },
  },
);

export type ButtonProps = ComponentProps<'button'> &
  Omit<VariantProps<typeof buttonVariants>, 'iconPos'> & {
    icon?: IconName;
    iconPos?: 'right' | 'bottom';
  };

export function Button({
  variant,
  large,
  block,
  icon,
  iconPos = 'right',
  className,
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      data-slot="button"
      className={cn(buttonVariants({ variant, large, block, iconPos: icon ? iconPos : undefined }), className)}
      {...props}
    >
      {children}
      {icon && (
        <Icon
          name={icon}
          className={cn(
            'size-[18px] opacity-60',
            variant && variant !== 'default' && 'opacity-85',
            iconPos === 'right' && 'absolute top-1/2 right-3.5 -translate-y-1/2',
            'in-data-[slot=list-row]:opacity-35',
          )}
        />
      )}
    </button>
  );
}
