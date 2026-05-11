import React from 'react'
import { cn } from '../../lib/cn'

export const Input = React.forwardRef(function Input(
  { className, leftIcon: LeftIcon, rightAccessory, ...props },
  ref,
) {
  return (
    <div className="relative">
      {LeftIcon && (
        <LeftIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400 pointer-events-none" strokeWidth={2} />
      )}
      <input
        ref={ref}
        className={cn(
          'w-full h-11 rounded-xl border border-ink-200 bg-white text-sm text-ink-900 placeholder:text-ink-400',
          'transition-all duration-150',
          'hover:border-ink-300',
          'focus:outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10',
          'disabled:bg-ink-50 disabled:text-ink-500 disabled:cursor-not-allowed',
          LeftIcon ? 'pl-10' : 'pl-3.5',
          rightAccessory ? 'pr-10' : 'pr-3.5',
          className,
        )}
        {...props}
      />
      {rightAccessory && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">{rightAccessory}</div>
      )}
    </div>
  )
})

export const Textarea = React.forwardRef(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        'w-full rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 text-sm text-ink-900 placeholder:text-ink-400',
        'transition-all duration-150 resize-y min-h-[90px]',
        'hover:border-ink-300',
        'focus:outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10',
        className,
      )}
      {...props}
    />
  )
})

export const Label = React.forwardRef(function Label({ className, ...props }, ref) {
  return (
    <label
      ref={ref}
      className={cn('block text-xs font-semibold text-ink-700 mb-1.5 tracking-wide', className)}
      {...props}
    />
  )
})
