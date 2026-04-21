import { useState } from 'react'
import { format, parseISO, isPast } from 'date-fns'
import { formatDuration } from '../utils'

const STATUS_BADGE = {
  submitted:      'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  graded:         'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  pending_review: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  unsubmitted:    'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
}

const inputClass = "border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-700 dark:text-gray-100"

export default function AssignmentList({ assignments, courses, onOverride }) {
  const [overrideId, setOverrideId] = useState(null)
  const [overrideVal, setOverrideVal] = useState('')
  const [retrying, setRetrying] = useState(new Set())
  const [filter, setFilter] = useState('all')
  const [courseFilter, setCourseFilter] = useState('all')
  const [noteId, setNoteId] = useState(null)
  const [noteVal, setNoteVal] = useState('')
  const [notes, setNotes] = useState({})

  const courseNames = [...new Set(assignments.map(a => a.course_name))].sort()

  async function loadNote(id) {
    if (notes[id] !== undefined) { setNoteId(id); setNoteVal(notes[id]); return }
    const resp = await fetch(`/api/assignments/${id}/note`)
    const data = resp.ok ? await resp.json() : { note: '' }
    setNotes(n => ({ ...n, [id]: data.note || '' }))
    setNoteId(id)
    setNoteVal(data.note || '')
  }

  async function saveNote(id) {
    await fetch(`/api/assignments/${id}/note`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: noteVal }),
    })
    setNotes(n => ({ ...n, [id]: noteVal }))
    setNoteId(null)
  }

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
    const h = parseFloat(overrideVal)
    if (isNaN(h) || h <= 0) return
    await onOverride(id, h)
    setOverrideId(null); setOverrideVal('')
  }

  async function retryEstimate(a) {
    setRetrying(r => new Set([...r, a.id]))
    try { const resp = await fetch('/api/sync', { method: 'POST' }); if (resp.ok) window.location.reload() }
    finally { setRetrying(r => { const s = new Set(r); s.delete(a.id); return s }) }
  }

  const btnBase = "px-3 py-1.5 text-sm capitalize"
  const btnActive = `${btnBase} bg-canvas-dark dark:bg-gray-600 text-white`
  const btnInactive = `${btnBase} bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700`

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
          {['all', 'upcoming', 'submitted'].map(f => (
            <button key={f} onClick={() => setFilter(f)} className={filter === f ? btnActive : btnInactive}>{f}</button>
          ))}
        </div>
        <select value={courseFilter} onChange={e => setCourseFilter(e.target.value)}
          className="text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 dark:text-gray-200">
          <option value="all">All Courses</option>
          {courseNames.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>

      {sorted.length === 0 && <p className="text-center text-gray-400 py-10">No assignments found.</p>}

      <div className="space-y-3">
        {sorted.map(a => {
          const overdue = a.due_at && isPast(parseISO(a.due_at)) && !a.submitted
          const hasNote = notes[a.id]
          return (
            <div key={a.id}
              className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border p-4 ${overdue ? 'border-red-300 dark:border-red-700' : 'border-gray-200 dark:border-gray-700'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <a href={a.html_url} target="_blank" rel="noreferrer"
                      className="font-semibold text-gray-800 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 hover:underline truncate">
                      {a.name}
                    </a>
                    <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${STATUS_BADGE[a.submission_state] || STATUS_BADGE.unsubmitted}`}>
                      {a.submission_state || 'unsubmitted'}
                    </span>
                    {overdue && <span className="text-xs bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 rounded-full px-2 py-0.5 font-medium">Overdue</span>}
                    {hasNote && <span className="text-xs text-yellow-600 dark:text-yellow-400" title="Has note">📝</span>}
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{a.course_name}</p>
                  {a.description && <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 line-clamp-2">{a.description}</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                    {a.due_at ? format(parseISO(a.due_at), 'MMM d, h:mm a') : 'No due date'}
                  </p>
                  <p className="text-xs text-gray-400">{a.points_possible != null ? `${a.points_possible} pts` : ''}</p>
                </div>
              </div>

              {/* Estimate + override row */}
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Time estimate:</span>
                  {a.estimated_hours != null ? (
                    <span className={`text-sm font-semibold ${a.estimate_source === 'manual' ? 'text-purple-600 dark:text-purple-400' : 'text-blue-600 dark:text-blue-400'}`}>
                      {formatDuration(a.estimated_hours)}
                      {a.estimate_source === 'manual' && <span className="text-xs font-normal ml-1 opacity-60">(manual)</span>}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400 italic">
                      Unknown
                      <button onClick={() => retryEstimate(a)} disabled={retrying.has(a.id)}
                        className="ml-2 text-blue-500 hover:underline text-xs">
                        {retrying.has(a.id) ? 'Retrying…' : 'Retry'}
                      </button>
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {/* Note toggle */}
                  <button onClick={() => noteId === a.id ? setNoteId(null) : loadNote(a.id)}
                    className="text-xs text-gray-400 dark:text-gray-500 hover:text-yellow-500 dark:hover:text-yellow-400">
                    {noteId === a.id ? 'Close note' : hasNote ? '📝 Edit note' : '+ Add note'}
                  </button>
                  {/* Override */}
                  {overrideId === a.id ? (
                    <div className="flex items-center gap-2">
                      <input type="number" min="0.1" step="0.5" value={overrideVal}
                        onChange={e => setOverrideVal(e.target.value)} placeholder="Hours"
                        className={`w-20 ${inputClass}`} autoFocus />
                      <button onClick={() => submitOverride(a.id)}
                        className="text-xs bg-purple-600 text-white px-2 py-1 rounded hover:bg-purple-700">Save</button>
                      <button onClick={() => { setOverrideId(null); setOverrideVal('') }}
                        className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => { setOverrideId(a.id); setOverrideVal(a.estimated_hours ?? '') }}
                      className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 underline">
                      Set custom estimate
                    </button>
                  )}
                </div>
              </div>

              {/* Inline note editor */}
              {noteId === a.id && (
                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                  <textarea
                    value={noteVal}
                    onChange={e => setNoteVal(e.target.value)}
                    placeholder="Add a private note for this assignment…"
                    rows={3}
                    className={`w-full ${inputClass} resize-none`}
                    autoFocus
                  />
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => saveNote(a.id)}
                      className="text-xs bg-yellow-500 text-white px-3 py-1 rounded hover:bg-yellow-600">Save note</button>
                    <button onClick={() => setNoteId(null)}
                      className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
