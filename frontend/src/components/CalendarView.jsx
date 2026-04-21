import { formatDuration } from '../utils'
import { useState } from 'react'
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, format, isSameMonth, isSameDay,
  addMonths, subMonths, addWeeks, subWeeks,
  parseISO, isToday,
} from 'date-fns'

const COURSE_COLORS = [
  'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-pink-500',
  'bg-yellow-500', 'bg-orange-500', 'bg-teal-500', 'bg-red-500',
]

function courseColorMap(assignments) {
  const courses = [...new Set(assignments.map(a => a.course_name))]
  return Object.fromEntries(courses.map((c, i) => [c, COURSE_COLORS[i % COURSE_COLORS.length]]))
}

export default function CalendarView({ assignments }) {
  const [viewMode, setViewMode] = useState('month')
  const [current, setCurrent] = useState(new Date())
  const [selected, setSelected] = useState(null)

  const colorMap = courseColorMap(assignments)

  function assignmentsOnDay(day) {
    return assignments.filter(a => a.due_at && isSameDay(parseISO(a.due_at), day))
  }

  let days = []
  if (viewMode === 'month') {
    days = eachDayOfInterval({ start: startOfWeek(startOfMonth(current)), end: endOfWeek(endOfMonth(current)) })
  } else {
    days = eachDayOfInterval({ start: startOfWeek(current), end: endOfWeek(current) })
  }

  function navigate(dir) {
    setCurrent(viewMode === 'month'
      ? (dir > 0 ? addMonths(current, 1) : subMonths(current, 1))
      : (dir > 0 ? addWeeks(current, 1) : subWeeks(current, 1)))
  }

  const title = viewMode === 'month'
    ? format(current, 'MMMM yyyy')
    : `Week of ${format(startOfWeek(current), 'MMM d')} – ${format(endOfWeek(current), 'MMM d, yyyy')}`

  const btnBase = 'px-3 py-1.5 text-sm capitalize'
  const btnA = `${btnBase} bg-canvas-dark dark:bg-gray-600 text-white`
  const btnI = `${btnBase} bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700`

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700">←</button>
          <h2 className="font-semibold text-gray-800 dark:text-gray-100 min-w-56 text-center">{title}</h2>
          <button onClick={() => navigate(1)} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700">→</button>
          <button onClick={() => setCurrent(new Date())} className="text-xs text-blue-600 dark:text-blue-400 hover:underline ml-2">Today</button>
        </div>
        <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
          {['month', 'week'].map(v => (
            <button key={v} onClick={() => setViewMode(v)} className={viewMode === v ? btnA : btnI}>{v}</button>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700">
          {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
            <div key={d} className="text-center text-xs font-medium text-gray-500 dark:text-gray-400 py-2">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map(day => {
            const dayAssignments = assignmentsOnDay(day)
            const inMonth = viewMode === 'month' ? isSameMonth(day, current) : true
            const today = isToday(day)
            return (
              <div key={day.toISOString()}
                className={`min-h-20 p-1.5 border-b border-r border-gray-100 dark:border-gray-700 ${!inMonth ? 'bg-gray-50 dark:bg-gray-900/40' : ''}`}>
                <div className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full
                  ${today ? 'bg-canvas-red text-white' : inMonth ? 'text-gray-700 dark:text-gray-200' : 'text-gray-300 dark:text-gray-600'}`}>
                  {format(day, 'd')}
                </div>
                <div className="space-y-0.5">
                  {dayAssignments.slice(0, viewMode === 'month' ? 3 : 10).map(a => (
                    <button key={a.id} onClick={() => setSelected(a)}
                      className={`w-full text-left text-xs text-white rounded px-1.5 py-0.5 truncate ${colorMap[a.course_name] || 'bg-gray-500'}`}
                      title={a.name}>{a.name}</button>
                  ))}
                  {viewMode === 'month' && dayAssignments.length > 3 && (
                    <p className="text-xs text-gray-400 pl-1">+{dayAssignments.length - 3} more</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setSelected(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <span className={`inline-block text-xs text-white rounded px-2 py-0.5 mb-2 ${colorMap[selected.course_name] || 'bg-gray-500'}`}>
                  {selected.course_name}
                </span>
                <h3 className="font-semibold text-lg text-gray-800 dark:text-gray-100">{selected.name}</h3>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none ml-4">×</button>
            </div>
            <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
              <div className="flex justify-between">
                <span className="text-gray-400">Due</span>
                <span className="font-medium">{selected.due_at ? format(parseISO(selected.due_at), 'MMM d, yyyy h:mm a') : 'No due date'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Points</span>
                <span className="font-medium">{selected.points_possible ?? 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Status</span>
                <span className={`font-medium ${selected.submitted ? 'text-green-600' : 'text-red-500'}`}>
                  {selected.submission_state || 'unsubmitted'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">AI estimate</span>
                <span className="font-medium text-blue-600 dark:text-blue-400">
                  {selected.estimated_hours != null ? formatDuration(selected.estimated_hours) : 'Unknown'}
                  {selected.estimate_source === 'manual' && <span className="text-xs text-purple-500 ml-1">(manual)</span>}
                </span>
              </div>
              {selected.description && (
                <p className="pt-2 border-t border-gray-100 dark:border-gray-700 line-clamp-4">{selected.description}</p>
              )}
            </div>
            {selected.html_url && (
              <a href={selected.html_url} target="_blank" rel="noreferrer"
                className="mt-4 inline-block text-blue-600 dark:text-blue-400 hover:underline text-sm">Open in Canvas →</a>
            )}
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {Object.entries(colorMap).map(([course, color]) => (
          <span key={course} className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
            <span className={`w-3 h-3 rounded-sm ${color}`} />{course}
          </span>
        ))}
      </div>
    </div>
  )
}
