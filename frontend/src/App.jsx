import { useState, useEffect, useCallback } from 'react'
import CourseCard from './components/CourseCard'
import AssignmentList from './components/AssignmentList'
import CalendarView from './components/CalendarView'
import AlertBanner from './components/AlertBanner'
import Settings from './components/Settings'

const TABS = ['Courses', 'Assignments', 'Calendar', 'Settings']

function useApi(path, interval = 60000) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const resp = await fetch(path)
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      setData(await resp.json())
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [path])

  useEffect(() => {
    load()
    const id = setInterval(load, interval)
    return () => clearInterval(id)
  }, [load, interval])

  return { data, error, loading, reload: load }
}

export default function App() {
  const [tab, setTab] = useState('Courses')
  const { data: courses, error: coursesError, loading: coursesLoading } = useApi('/api/courses')
  const { data: assignments, error: assignmentsError, loading: assignmentsLoading, reload: reloadAssignments } = useApi('/api/assignments')
  const { data: alerts, reload: reloadAlerts } = useApi('/api/alerts', 30000)

  async function handleOverride(assignmentId, hours) {
    await fetch('/api/estimates/override', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignment_id: assignmentId, hours }),
    })
    await reloadAssignments()
    await reloadAlerts()
  }

  const isLoading = coursesLoading || assignmentsLoading
  const hasError = coursesError || assignmentsError

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-canvas-dark text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-canvas-red rounded-lg flex items-center justify-center font-bold text-sm">C</div>
            <div>
              <h1 className="text-lg font-bold leading-none">Canvas Dashboard</h1>
              <p className="text-xs text-gray-400 leading-none mt-0.5">Student Portal</p>
            </div>
          </div>
          <nav className="flex gap-1">
            {TABS.map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  tab === t ? 'bg-white/20 text-white' : 'text-gray-300 hover:text-white hover:bg-white/10'
                }`}
              >
                {t}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Alert banners */}
        {alerts && alerts.length > 0 && (
          <AlertBanner alerts={alerts} />
        )}

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="w-10 h-10 border-4 border-canvas-red border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="mt-3 text-sm text-gray-500">Loading Canvas data…</p>
            </div>
          </div>
        )}

        {/* Error */}
        {!isLoading && hasError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-red-700">
            <p className="font-semibold">Failed to load data</p>
            <p className="text-sm mt-1">{coursesError || assignmentsError}</p>
            <p className="text-sm mt-2 text-red-500">
              Make sure your Canvas API token and base URL are configured in Settings, and the backend is running.
            </p>
          </div>
        )}

        {!isLoading && !hasError && (
          <>
            {tab === 'Courses' && (
              <div>
                <h2 className="text-xl font-bold text-gray-800 mb-4">
                  Your Courses
                  <span className="ml-2 text-sm font-normal text-gray-400">({courses?.length ?? 0})</span>
                </h2>
                {courses?.length === 0 && (
                  <p className="text-gray-400 text-center py-10">No active courses found.</p>
                )}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {courses?.map((c, i) => <CourseCard key={c.id} course={c} index={i} />)}
                </div>
              </div>
            )}

            {tab === 'Assignments' && (
              <div>
                <h2 className="text-xl font-bold text-gray-800 mb-4">
                  Assignments
                  <span className="ml-2 text-sm font-normal text-gray-400">({assignments?.length ?? 0})</span>
                </h2>
                <AssignmentList
                  assignments={assignments ?? []}
                  courses={courses ?? []}
                  onOverride={handleOverride}
                />
              </div>
            )}

            {tab === 'Calendar' && (
              <div>
                <h2 className="text-xl font-bold text-gray-800 mb-4">Calendar</h2>
                <CalendarView assignments={assignments ?? []} />
              </div>
            )}

            {tab === 'Settings' && (
              <div>
                <h2 className="text-xl font-bold text-gray-800 mb-4">Settings</h2>
                <Settings />
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
