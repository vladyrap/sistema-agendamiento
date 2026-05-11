import React from 'react'
import { cn } from '../../lib/cn'

const variants = {
  primary:
    'bg-brand-600 text-white shadow-brand-sm hover:bg-brand-700 hover:shadow-brand active:scale-[.98]',
  secondary:
    'bg-white text-ink-700 border border-ink-200 hover:bg-ink-50 hover:border-ink-300 active:scale-[.98]',
  ghost:
    'text-ink-700 hover:bg-ink-100 active:scale-[.98]',
  outline:
    'border border-brand-200 text-brand-700 bg-brand-50 hover:bg-brand-100 active:scale-[.98]',
  danger:
    'bg-red-50 text-red-700 border border-red-100 hover:bg-red-100',
  success:
    'bg-wellness-50 text-wellness-700 border border-wellness-100 hover:bg-wellness-100',
  dark:
    'bg-ink-900 text-white hover:bg-ink-800 active:scale-[.98]',
}

const sizes = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2.5',
  icon: 'h-10 w-10',
}

export const Button = React.forwardRef(function Button(
  { variant = 'primary', size = 'md', className, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex items-center justify-center rounded-xl font-medium transition-all duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
        'disabled:opacity-50 disabled:pointer-events-none',
        'whitespace-nowrap',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  )
})
