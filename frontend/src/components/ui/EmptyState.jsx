import React from 'react'
import { cn } from '../../lib/cn'

export function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center py-14 px-6', className)}>
      {Icon && (
        <div className="w-14 h-14 rounded-2xl bg-brand-50 border border-brand-100 flex items-center justify-center mb-4">
          <Icon className="w-6 h-6 text-brand-600" strokeWidth={1.8} />
        </div>
      )}
      <h3 className="text-base font-semibold text-ink-900 tracking-tight">{title}</h3>
      {description && (
        <p className="text-sm text-ink-500 mt-1.5 max-w-sm text-pretty">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
