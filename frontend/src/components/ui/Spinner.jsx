import React from 'react'
import { cn } from '../../lib/cn'

const sizes = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-9 h-9' }

export function Spinner({ size = 'md', className }) {
  return (
    <div
      className={cn(
        'inline-block rounded-full border-[2.5px] border-ink-200 border-t-brand-600 animate-spin',
        sizes[size],
        className,
      )}
    />
  )
}

export function PageSpinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <Spinner size="lg" />
    </div>
  )
}
