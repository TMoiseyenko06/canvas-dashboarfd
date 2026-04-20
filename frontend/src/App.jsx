import { useState, useEffect, useCallback, useRef } from 'react'
import CourseCard from './components/CourseCard'
import AssignmentList from './components/AssignmentList'
import CalendarView from './components/CalendarView'
import AlertBanner from './components/AlertBanner'
import Settings from './components/Settings'

const TABS = ['Courses', 'Assignments', 'Calendar', 'Settings']

function useApi(path, intervalMs = 60000) {
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
    const id = setInterval(load, intervalMs)
    return () => clearInterval(id)
  }, [load, intervalMs])

  return { data, error, loading, reload: load }
}

function useSyncPoller() {
  const [syncing, setSyncing] = useState(true)
  const [syncError, setSyncError] = useState('')
  const timerRef = useRef(null)

  const poll = useCallback(async () => {
    try {
      const resp = await fetch('/api/status')
      if (!resp.ok) return
      const s = await resp.json()
      setSyncing(s.syncing)
      setSyncError(s.last_sync_error || '')
      if (s.syncing) {
        timerRef.current = setTimeout(poll, 1500)
      }
    } catch {
      timerRef.current = setTimeout(poll, 2000)
    }
  }, [])

  useEffect(() => {
    poll()
    return () => clearTimeout(timerRef.current)
  }, [poll])

  return { syncing, syncError }
}

export default function App() {
  const [tab, setTab] = useState('Courses')
  const { syncing, syncError } = useSyncPoller()
  const { data: courses, error: coursesError, loading: coursesLoading, reload: reloadCourses } = useApi('/api/courses')
  const { data: assignments, error: assignmentsError, loading: assignmentsLoading, reload: reloadAssignments } = useApi('/api/assignments')
  const { data: alerts, reload: reloadAlerts } = useApi('/api/alerts', 30000)

  // Re-fetch data once the background sync finishes
  const prevSyncing = useRef(true)
  useEffect(() => {
    if (prevSyncing.current && !syncing) {
      reloadCourses()
      reloadAssignments()
      reloadAlerts()
    }
    prevSyncing.current = syncing
  }, [syncing, reloadCourses, reloadAssignments, reloadAlerts])

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
        {alerts && alerts.length > 0 && <AlertBanner alerts={alerts} />}

        {/* Sync in progress banner */}
        {syncing && (
          <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-4 text-blue-800 text-sm">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin shrink-0" />
            Syncing your Canvas data — this may take a moment…
          </div>
        )}

        {/* Sync error (bad token / wrong URL) */}
        {!syncing && syncError && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4 text-red-800 text-sm">
            <span className="font-semibold">Canvas sync failed: </span>{syncError}
            <span className="ml-1">— check your token and base URL in Settings.</span>
          </div>
        )}

        {isLoading && !syncing && (
          <div className="flex items-center justify-center py-20">
            <div className="w-10 h-10 border-4 border-canvas-red border-t-transparent rounded-full animate-spin" />
          </div>
        )}

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
                {!syncing && courses?.length === 0 && (
                  <div className="text-center py-10 text-gray-400">
                    <p>No active courses found.</p>
                    <p className="text-sm mt-1">Check that your Canvas token and base URL are correct in Settings.</p>
                  </div>
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
