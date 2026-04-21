import { useState, useEffect } from 'react'

const inputClass = "w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"

export default function Settings() {
  const [form, setForm] = useState({
    canvas_base_url: '',
    canvas_api_token: '',
    openrouter_api_key: '',
    wiggle_room_hours: 2,
    telegram_bot_token: '',
    telegram_chat_id: '',
  })
  const [status, setStatus] = useState(null)
  const [clearing, setClearing] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [testingTelegram, setTestingTelegram] = useState(false)
  const [hiddenCourses, setHiddenCourses] = useState([])
  const [telegramConfigured, setTelegramConfigured] = useState(false)

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(d => {
      setForm(f => ({ ...f, canvas_base_url: d.canvas_base_url || '', wiggle_room_hours: d.wiggle_room_hours ?? 2 }))
      setTelegramConfigured(d.telegram_configured || false)
    })
    fetch('/api/courses/hidden').then(r => r.json()).then(setHiddenCourses).catch(() => {})
  }, [])

  async function saveSettings(e) {
    e.preventDefault()
    setStatus(null)
    const body = { ...form }
    if (!body.canvas_api_token) delete body.canvas_api_token
    if (!body.openrouter_api_key) delete body.openrouter_api_key
    if (!body.telegram_bot_token) delete body.telegram_bot_token
    if (!body.telegram_chat_id) delete body.telegram_chat_id
    const resp = await fetch('/api/settings', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    if (resp.ok) {
      setStatus({ ok: true, msg: 'Settings saved!' })
      setForm(f => ({ ...f, canvas_api_token: '', openrouter_api_key: '', telegram_bot_token: '', telegram_chat_id: '' }))
      const s = await fetch('/api/settings').then(r => r.json())
      setTelegramConfigured(s.telegram_configured || false)
    } else {
      setStatus({ ok: false, msg: 'Failed to save settings.' })
    }
  }

  async function clearCache() {
    setClearing(true); setStatus(null)
    const resp = await fetch('/api/cache', { method: 'DELETE' })
    setClearing(false)
    setStatus(resp.ok ? { ok: true, msg: 'Cache cleared.' } : { ok: false, msg: 'Failed to clear cache.' })
  }

  async function syncNow() {
    setSyncing(true); setStatus(null)
    await fetch('/api/sync', { method: 'POST' })
    setSyncing(false)
    setStatus({ ok: true, msg: 'Sync started in background.' })
  }

  async function testTelegram() {
    setTestingTelegram(true); setStatus(null)
    const resp = await fetch('/api/telegram/test', { method: 'POST' })
    setTestingTelegram(false)
    if (resp.ok) {
      setStatus({ ok: true, msg: 'Test message sent! Check your Telegram.' })
    } else {
      const data = await resp.json().catch(() => ({}))
      setStatus({ ok: false, msg: `Telegram test failed: ${data.detail || resp.status}` })
    }
  }

  async function unhide(courseId) {
    await fetch(`/api/courses/${courseId}/hide`, { method: 'DELETE' })
    setHiddenCourses(h => h.filter(c => c.id !== courseId))
  }

  const sectionHead = "text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3"

  return (
    <div className="max-w-lg space-y-8">
      <form onSubmit={saveSettings} className="space-y-4">
        <h3 className={sectionHead}>API Keys</h3>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Canvas Base URL</label>
          <input type="url" value={form.canvas_base_url}
            onChange={e => setForm(f => ({ ...f, canvas_base_url: e.target.value }))}
            placeholder="https://school.instructure.com" className={inputClass} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Canvas API Token</label>
          <input type="password" value={form.canvas_api_token}
            onChange={e => setForm(f => ({ ...f, canvas_api_token: e.target.value }))}
            placeholder="Leave blank to keep existing" className={inputClass} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">OpenRouter API Key</label>
          <input type="password" value={form.openrouter_api_key}
            onChange={e => setForm(f => ({ ...f, openrouter_api_key: e.target.value }))}
            placeholder="Leave blank to keep existing" className={inputClass} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Wiggle Room Buffer (hours)</label>
          <input type="number" min="0" step="0.5" value={form.wiggle_room_hours}
            onChange={e => setForm(f => ({ ...f, wiggle_room_hours: parseFloat(e.target.value) || 0 }))}
            className="w-32 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <p className="text-xs text-gray-400 mt-1">Alert fires this many hours before (estimate + buffer) of the due date.</p>
        </div>

        <div className="pt-4 border-t border-gray-100 dark:border-gray-700 space-y-4">
          <div className="flex items-center gap-2">
            <h3 className={sectionHead + ' mb-0'}>Telegram Notifications</h3>
            {telegramConfigured && <span className="text-xs bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 rounded-full px-2 py-0.5 font-medium">Configured</span>}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Get notified when an assignment is due within 3 days.{' '}
            <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">Create a bot with @BotFather</a>
            {' · '}
            <a href="https://t.me/userinfobot" target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">Get Chat ID from @userinfobot</a>
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Bot Token</label>
            <input type="password" value={form.telegram_bot_token}
              onChange={e => setForm(f => ({ ...f, telegram_bot_token: e.target.value }))}
              placeholder={telegramConfigured ? 'Leave blank to keep existing' : '123456:ABCdef…'} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Chat ID</label>
            <input type="text" value={form.telegram_chat_id}
              onChange={e => setForm(f => ({ ...f, telegram_chat_id: e.target.value }))}
              placeholder={telegramConfigured ? 'Leave blank to keep existing' : '123456789'} className={inputClass} />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" className="bg-canvas-dark dark:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90">Save Settings</button>
          {telegramConfigured && (
            <button type="button" onClick={testTelegram} disabled={testingTelegram}
              className="bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-600 disabled:opacity-50">
              {testingTelegram ? 'Sending…' : 'Send Test Message'}
            </button>
          )}
        </div>
      </form>

      <div className="pt-2 border-t border-gray-200 dark:border-gray-700 space-y-3">
        <h3 className={sectionHead}>Actions</h3>
        <div className="flex gap-3">
          <button onClick={syncNow} disabled={syncing}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {syncing ? 'Syncing…' : 'Sync Now'}
          </button>
          <button onClick={clearCache} disabled={clearing}
            className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50">
            {clearing ? 'Clearing…' : 'Clear Cache & Re-fetch'}
          </button>
        </div>
      </div>

      {hiddenCourses.length > 0 && (
        <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
          <h3 className={sectionHead}>Hidden Courses</h3>
          <div className="space-y-2">
            {hiddenCourses.map(c => (
              <div key={c.id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 rounded-lg px-3 py-2">
                <span className="text-sm text-gray-700 dark:text-gray-200">{c.name}</span>
                <button onClick={() => unhide(c.id)} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">Unhide</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {status && (
        <div className={`p-3 rounded-lg text-sm ${status.ok ? 'bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-300' : 'bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-300'}`}>
          {status.msg}
        </div>
      )}
    </div>
  )
}
