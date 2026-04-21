import { useState, useEffect } from 'react'

const GP_COLOR = gp =>
  gp === null ? 'text-gray-400' :
  gp >= 3.7 ? 'text-green-500' :
  gp >= 3.0 ? 'text-blue-500' :
  gp >= 2.0 ? 'text-yellow-500' :
  'text-red-500'

const inputClass = "w-20 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm text-center bg-white dark:bg-gray-700 dark:text-gray-100"

export default function GpaCalculator({ courses }) {
  const [data, setData] = useState(null)
  const [editing, setEditing] = useState({})
  const [saving, setSaving] = useState(new Set())

  async function load() {
    const resp = await fetch('/api/gpa')
    if (resp.ok) setData(await resp.json())
  }

  useEffect(() => { load() }, [courses])

  async function saveCredits(courseId, val) {
    const credits = parseFloat(val)
    if (isNaN(credits) || credits < 0) return
    setSaving(s => new Set([...s, courseId]))
    await fetch(`/api/courses/${courseId}/credits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credits }),
    })
    setSaving(s => { const n = new Set(s); n.delete(courseId); return n })
    setEditing(e => { const n = { ...e }; delete n[courseId]; return n })
    await load()
  }

  if (!data) return <div className="text-gray-400 text-sm">Loading…</div>

  const { courses: rows, gpa, total_credits } = data

  return (
    <div className="max-w-2xl">
      {/* GPA summary */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6 flex items-center gap-8">
        <div className="text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Cumulative GPA</p>
          <p className={`text-5xl font-bold ${GP_COLOR(gpa)}`}>
            {gpa != null ? gpa.toFixed(2) : '—'}
          </p>
          {total_credits > 0 && (
            <p className="text-xs text-gray-400 mt-1">{total_credits} credit hours entered</p>
          )}
        </div>
        <div className="flex-1 text-sm text-gray-500 dark:text-gray-400">
          {total_credits === 0 ? (
            <p>Enter credit hours for each course to calculate your weighted GPA.</p>
          ) : gpa === null ? (
            <p>Add grades in Canvas to see your GPA.</p>
          ) : (
            <div className="space-y-1">
              <p className="font-medium text-gray-700 dark:text-gray-200">Scale reference</p>
              {[['A / A+', '4.0'], ['A-', '3.7'], ['B+', '3.3'], ['B', '3.0'], ['B-', '2.7'], ['C', '2.0']].map(([l, p]) => (
                <div key={l} className="flex gap-3">
                  <span className="w-12">{l}</span><span>{p}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Per-course table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              <th className="text-left px-4 py-3">Course</th>
              <th className="text-center px-4 py-3">Grade</th>
              <th className="text-center px-4 py-3">Points</th>
              <th className="text-center px-4 py-3">Credits</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(c => {
              const editVal = editing[c.id]
              return (
                <tr key={c.id} className="border-b border-gray-50 dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-800 dark:text-gray-100 leading-tight">{c.name}</p>
                    <p className="text-xs text-gray-400">{c.course_code}</p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {c.letter ? (
                      <span className={`font-semibold ${GP_COLOR(c.grade_points)}`}>{c.letter}</span>
                    ) : (
                      <span className="text-gray-300 dark:text-gray-600">—</span>
                    )}
                    {c.score != null && (
                      <p className="text-xs text-gray-400">{Number(c.score).toFixed(1)}%</p>
                    )}
                  </td>
                  <td className={`px-4 py-3 text-center font-semibold ${GP_COLOR(c.grade_points)}`}>
                    {c.grade_points != null ? c.grade_points.toFixed(1) : '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {editVal !== undefined ? (
                      <div className="flex items-center justify-center gap-1">
                        <input
                          type="number" min="0" step="0.5"
                          value={editVal}
                          onChange={e => setEditing(ed => ({ ...ed, [c.id]: e.target.value }))}
                          className={inputClass}
                          autoFocus
                          onKeyDown={e => { if (e.key === 'Enter') saveCredits(c.id, editVal); if (e.key === 'Escape') setEditing(ed => { const n = {...ed}; delete n[c.id]; return n }) }}
                        />
                        <button onClick={() => saveCredits(c.id, editVal)} disabled={saving.has(c.id)}
                          className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 disabled:opacity-50">
                          {saving.has(c.id) ? '…' : '✓'}
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setEditing(e => ({ ...e, [c.id]: c.credits ?? '' }))}
                        className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 font-medium">
                        {c.credits != null ? c.credits : <span className="text-gray-300 dark:text-gray-600 text-xs">+ add</span>}
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-400 mt-3">Click any credit value to edit. GPA updates instantly.</p>
    </div>
  )
}
