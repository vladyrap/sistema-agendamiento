import React from 'react'
import { cn } from '../../lib/cn'

export function Card({ className, hover = false, ...props }) {
  return (
    <div
      className={cn(
        'rounded-2xl bg-white border border-ink-200/70 shadow-soft',
        hover && 'transition-all duration-200 hover:-translate-y-0.5 hover:shadow-soft-lg hover:border-ink-200',
        className,
      )}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }) {
  return <div className={cn('p-6 pb-4', className)} {...props} />
}

export function CardTitle({ className, ...props }) {
  return <h3 className={cn('text-base font-semibold text-ink-900 tracking-tight', className)} {...props} />
}

export function CardDescription({ className, ...props }) {
  return <p className={cn('text-sm text-ink-500 mt-1', className)} {...props} />
}

export function CardContent({ className, ...props }) {
  return <div className={cn('p-6 pt-0', className)} {...props} />
}

export function CardFooter({ className, ...props }) {
  return <div className={cn('p-6 pt-4 border-t border-ink-100', className)} {...props} />
}
