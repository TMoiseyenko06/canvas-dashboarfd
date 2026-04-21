import { useState } from 'react'
import { format, parseISO, isPast } from 'date-fns'
import { formatDuration } from '../utils'

const STATUS_BADGE = {
  submitted: 'bg-green-100 text-green-800',
  graded: 'bg-blue-100 text-blue-800',
  pending_review: 'bg-yellow-100 text-yellow-800',
  unsubmitted: 'bg-red-100 text-red-800',
}

export default function AssignmentList({ assignments, courses, onOverride }) {
  const [overrideId, setOverrideId] = useState(null)
  const [overrideVal, setOverrideVal] = useState('')
  const [retrying, setRetrying] = useState(new Set())
  const [filter, setFilter] = useState('all')
  const [courseFilter, setCourseFilter] = useState('all')

  const courseNames = [...new Set(assignments.map(a => a.course_name))].sort()

  const filtered = assignments.filter(a => {
    if (filter === 'upcoming' && a.submitted) return false
    if (filter === 'submitted' && !a.submitted) return false
    if (courseFilter !== 'all' && a.course_name !== courseFilter) return false
    return true
  })

  const sorted = [...filtered].sort((a, b) => {
    if (!a.due_at && !b.due_at) return 0
    if (!a.due_at) return 1
    if (!b.due_at) return -1
    return new Date(a.due_at) - new Date(b.due_at)
  })

  async function submitOverride(id) {
    const hours = parseFloat(overrideVal)
    if (isNaN(hours) || hours <= 0) return
    await onOverride(id, hours)
    setOverrideId(null)
    setOverrideVal('')
  }

  async function retryEstimate(a) {
    setRetrying(r => new Set([...r, a.id]))
    try {
      const resp = await fetch('/api/sync', { method: 'POST' })
      if (resp.ok) window.location.reload()
    } finally {
      setRetrying(r => { const s = new Set(r); s.delete(a.id); return s })
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="flex rounded-lg overflow-hidden border border-gray-200">
          {['all', 'upcoming', 'submitted'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-sm capitalize ${filter === f ? 'bg-canvas-dark text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              {f}
            </button>
          ))}
        </div>
        <select
          value={courseFilter}
          onChange={e => setCourseFilter(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white"
        >
          <option value="all">All Courses</option>
          {courseNames.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>

      {sorted.length === 0 && (
        <p className="text-center text-gray-400 py-10">No assignments found.</p>
      )}

      <div className="space-y-3">
        {sorted.map(a => {
          const overdue = a.due_at && isPast(parseISO(a.due_at)) && !a.submitted
          return (
            <div
              key={a.id}
              className={`bg-white rounded-xl shadow-sm border p-4 ${overdue ? 'border-red-300' : 'border-gray-200'}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <a
                      href={a.html_url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-gray-800 hover:text-blue-600 hover:underline truncate"
                    >
                      {a.name}
                    </a>
                    <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${STATUS_BADGE[a.submission_state] || STATUS_BADGE.unsubmitted}`}>
                      {a.submission_state || 'unsubmitted'}
                    </span>
                    {overdue && (
                      <span className="text-xs bg-red-100 text-red-700 rounded-full px-2 py-0.5 font-medium">Overdue</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">{a.course_name}</p>
                  {a.description && (
                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">{a.description}</p>
                  )}
                </div>

                <div className="text-right shrink-0">
                  <p className="text-sm font-medium text-gray-700">
                    {a.due_at ? format(parseISO(a.due_at), 'MMM d, h:mm a') : 'No due date'}
                  </p>
                  <p className="text-xs text-gray-400">
                    {a.points_possible != null ? `${a.points_possible} pts` : ''}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Time estimate:</span>
                  {a.estimated_hours != null ? (
                    <span className={`text-sm font-semibold ${a.estimate_source === 'manual' ? 'text-purple-700' : 'text-blue-700'}`}>
                      {formatDuration(a.estimated_hours)}
                      {a.estimate_source === 'manual' && <span className="text-xs font-normal ml-1 text-purple-400">(manual)</span>}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400 italic">
                      Unknown
                      <button
                        onClick={() => retryEstimate(a)}
                        disabled={retrying.has(a.id)}
                        className="ml-2 text-blue-500 hover:underline text-xs"
                      >
                        {retrying.has(a.id) ? 'Retrying…' : 'Retry'}
                      </button>
                    </span>
                  )}
                </div>

                <div>
                  {overrideId === a.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0.1"
                        step="0.5"
                        value={overrideVal}
                        onChange={e => setOverrideVal(e.target.value)}
                        placeholder="Hours"
                        className="w-20 border rounded px-2 py-1 text-sm"
                        autoFocus
                      />
                      <button
                        onClick={() => submitOverride(a.id)}
                        className="text-xs bg-purple-600 text-white px-2 py-1 rounded hover:bg-purple-700"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => { setOverrideId(null); setOverrideVal('') }}
                        className="text-xs text-gray-400 hover:text-gray-600"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setOverrideId(a.id); setOverrideVal(a.estimated_hours ?? '') }}
                      className="text-xs text-gray-400 hover:text-gray-600 underline"
                    >
                      Set custom estimate
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
