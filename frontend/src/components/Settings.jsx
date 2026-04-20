import { useState, useEffect } from 'react'

export default function Settings() {
  const [form, setForm] = useState({
    canvas_base_url: '',
    canvas_api_token: '',
    openrouter_api_key: '',
    wiggle_room_hours: 2,
  })
  const [status, setStatus] = useState(null)
  const [clearing, setClearing] = useState(false)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(d => {
        setForm(f => ({
          ...f,
          canvas_base_url: d.canvas_base_url || '',
          wiggle_room_hours: d.wiggle_room_hours ?? 2,
        }))
      })
  }, [])

  async function saveSettings(e) {
    e.preventDefault()
    setStatus(null)
    const body = { ...form }
    if (!body.canvas_api_token) delete body.canvas_api_token
    if (!body.openrouter_api_key) delete body.openrouter_api_key
    const resp = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (resp.ok) {
      setStatus({ ok: true, msg: 'Settings saved!' })
      setForm(f => ({ ...f, canvas_api_token: '', openrouter_api_key: '' }))
    } else {
      setStatus({ ok: false, msg: 'Failed to save settings.' })
    }
  }

  async function clearCache() {
    setClearing(true)
    setStatus(null)
    const resp = await fetch('/api/cache', { method: 'DELETE' })
    setClearing(false)
    if (resp.ok) setStatus({ ok: true, msg: 'Cache cleared and re-sync triggered.' })
    else setStatus({ ok: false, msg: 'Failed to clear cache.' })
  }

  async function syncNow() {
    setSyncing(true)
    setStatus(null)
    const resp = await fetch('/api/sync', { method: 'POST' })
    const data = await resp.json()
    setSyncing(false)
    if (resp.ok) setStatus({ ok: true, msg: `Synced ${data.courses} courses, ${data.assignments} assignments.` })
    else setStatus({ ok: false, msg: 'Sync failed.' })
  }

  return (
    <div className="max-w-lg">
      <form onSubmit={saveSettings} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Canvas Base URL</label>
          <input
            type="url"
            value={form.canvas_base_url}
            onChange={e => setForm(f => ({ ...f, canvas_base_url: e.target.value }))}
            placeholder="https://school.instructure.com"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Canvas API Token</label>
          <input
            type="password"
            value={form.canvas_api_token}
            onChange={e => setForm(f => ({ ...f, canvas_api_token: e.target.value }))}
            placeholder="Leave blank to keep existing"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">OpenRouter API Key</label>
          <input
            type="password"
            value={form.openrouter_api_key}
            onChange={e => setForm(f => ({ ...f, openrouter_api_key: e.target.value }))}
            placeholder="Leave blank to keep existing"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Wiggle Room Buffer (hours)
          </label>
          <input
            type="number"
            min="0"
            step="0.5"
            value={form.wiggle_room_hours}
            onChange={e => setForm(f => ({ ...f, wiggle_room_hours: parseFloat(e.target.value) || 0 }))}
            className="w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-400 mt-1">
            Alert starts this many hours before (estimated time + buffer) before due date.
          </p>
        </div>

        <button
          type="submit"
          className="bg-canvas-dark text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-700"
        >
          Save Settings
        </button>
      </form>

      <div className="mt-6 pt-6 border-t border-gray-200 space-y-3">
        <h3 className="text-sm font-medium text-gray-700">Actions</h3>
        <div className="flex gap-3">
          <button
            onClick={syncNow}
            disabled={syncing}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {syncing ? 'Syncing…' : 'Sync Now'}
          </button>
          <button
            onClick={clearCache}
            disabled={clearing}
            className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
          >
            {clearing ? 'Clearing…' : 'Clear Cache & Re-fetch'}
          </button>
        </div>
      </div>

      {status && (
        <div className={`mt-4 p-3 rounded-lg text-sm ${status.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
          {status.msg}
        </div>
      )}
    </div>
  )
}
