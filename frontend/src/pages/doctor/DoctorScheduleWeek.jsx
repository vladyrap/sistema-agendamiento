import React, { useMemo, useState } from 'react'
import { addDays, format, isSameDay, parseISO, startOfWeek } from 'date-fns'
import { es } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { cn } from '../../lib/cn'

const DAY_START_HOUR = 8   // 08:00
const DAY_END_HOUR = 21    // 21:00 (last visible hour)
const ROW_HEIGHT_PX = 48   // por hora

const STATUS_COLORS = {
  scheduled: 'bg-brand-100 border-brand-300 text-brand-800',
  confirmed: 'bg-wellness-100 border-wellness-300 text-wellness-800',
  completed: 'bg-ink-100 border-ink-300 text-ink-700',
  cancelled: 'bg-red-100 border-red-300 text-red-800 opacity-60 line-through',
  no_show:   'bg-amber-100 border-amber-300 text-amber-800',
}

function timeToMinutes(t) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export function DoctorScheduleWeek({ appointments, loading, onAppointmentClick }) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  )

  const hours = useMemo(
    () => Array.from({ length: DAY_END_HOUR - DAY_START_HOUR + 1 }, (_, i) => DAY_START_HOUR + i),
    [],
  )

  const startMinutes = DAY_START_HOUR * 60
  const totalHeight = (DAY_END_HOUR - DAY_START_HOUR + 1) * ROW_HEIGHT_PX

  const apptsByDay = useMemo(() => {
    const map = {}
    days.forEach((d) => { map[format(d, 'yyyy-MM-dd')] = [] })
    appointments.forEach((a) => {
      if (a.status === 'cancelled') return  // ocultar canceladas en la grilla
      const key = a.appointment_date
      if (map[key]) map[key].push(a)
    })
    return map
  }, [appointments, days])

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-ink-900">
            {format(weekStart, "MMMM yyyy", { locale: es }).replace(/^\w/, (c) => c.toUpperCase())}
          </h3>
          <p className="text-xs text-ink-500 mt-0.5">
            {format(days[0], 'd MMM', { locale: es })} – {format(days[6], 'd MMM', { locale: es })}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => setWeekStart(addDays(weekStart, -7))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}>
            Hoy
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setWeekStart(addDays(weekStart, 7))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="py-16 flex justify-center"><Spinner size="lg" /></div>
      ) : (
        <div className="overflow-x-auto -mx-2">
          <div className="min-w-[760px] px-2">
            {/* Header */}
            <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-ink-100 sticky top-0 bg-white">
              <div />
              {days.map((day) => {
                const isToday = isSameDay(day, new Date())
                return (
                  <div key={day.toISOString()} className="text-center py-2 px-1">
                    <div className="text-[10px] uppercase tracking-wider text-ink-400 font-semibold">
                      {format(day, 'EEE', { locale: es })}
                    </div>
                    <div className={cn(
                      'text-sm font-bold tabular-nums mt-0.5',
                      isToday ? 'text-brand-600' : 'text-ink-900',
                    )}>
                      {format(day, 'd')}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Body */}
            <div className="grid grid-cols-[60px_repeat(7,1fr)] relative">
              {/* Hour labels column */}
              <div className="relative" style={{ height: totalHeight }}>
                {hours.map((h, i) => (
                  <div
                    key={h}
                    className="absolute left-0 right-0 text-[10px] text-ink-400 tabular-nums px-1.5 -translate-y-1.5"
                    style={{ top: i * ROW_HEIGHT_PX }}
                  >
                    {String(h).padStart(2, '0')}:00
                  </div>
                ))}
              </div>

              {/* Day columns */}
              {days.map((day) => {
                const key = format(day, 'yyyy-MM-dd')
                const dayAppts = apptsByDay[key] || []
                return (
                  <div
                    key={key}
                    className="relative border-l border-ink-100"
                    style={{ height: totalHeight }}
                  >
                    {/* Hour grid lines */}
                    {hours.map((h, i) => (
                      <div
                        key={h}
                        className="absolute left-0 right-0 border-t border-ink-100/70"
                        style={{ top: i * ROW_HEIGHT_PX }}
                      />
                    ))}

                    {/* Appointments */}
                    {dayAppts.map((a) => {
                      const start = timeToMinutes(a.start_time.slice(0, 5))
                      const end = timeToMinutes(a.end_time.slice(0, 5))
                      const top = (start - startMinutes) * (ROW_HEIGHT_PX / 60)
                      const height = Math.max(20, (end - start) * (ROW_HEIGHT_PX / 60))
                      if (top < 0 || top > totalHeight) return null
                      return (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => onAppointmentClick?.(a)}
                          className={cn(
                            'absolute left-1 right-1 rounded-lg border px-2 py-1 text-left transition-all hover:shadow-soft hover:z-10',
                            STATUS_COLORS[a.status] || STATUS_COLORS.scheduled,
                          )}
                          style={{ top, height }}
                          title={`${a.start_time.slice(0,5)} – ${a.end_time.slice(0,5)} · ${a.patient.first_name} ${a.patient.last_name}`}
                        >
                          <div className="text-[11px] font-bold tabular-nums leading-tight">
                            {a.start_time.slice(0, 5)}
                          </div>
                          <div className="text-[11px] font-medium leading-tight truncate">
                            {a.patient.first_name} {a.patient.last_name}
                          </div>
                          {height > 50 && a.reason && (
                            <div className="text-[10px] opacity-70 truncate mt-0.5 italic">"{a.reason}"</div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}
