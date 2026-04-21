import { useEffect, useState } from 'react'
import { formatDistanceToNow, parseISO } from 'date-fns'

const URGENCY_STYLES = {
  alert_active: 'bg-orange-500 text-white',
  within_24h:   'bg-yellow-400 text-gray-900',
  within_72h:   'bg-blue-100 dark:bg-blue-900/50 text-blue-900 dark:text-blue-200 border border-blue-300 dark:border-blue-700',
}

const URGENCY_LABEL = {
  alert_active: '🟠 Start now — due soon',
  within_24h:   '🟡 Due within 24h',
  within_72h:   '🔵 Due within 3 days',
}

export default function AlertBanner({ alerts }) {
  const [dismissed, setDismissed] = useState(new Set())
  const [notifGranted, setNotifGranted] = useState(false)

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(p => { if (p === 'granted') setNotifGranted(true) })
    }
    if ('Notification' in window && Notification.permission === 'granted') setNotifGranted(true)
  }, [])

  useEffect(() => {
    if (!notifGranted) return
    alerts
      .filter(a => !dismissed.has(a.id) && a.urgency === 'alert_active')
      .forEach(a => new Notification(`Canvas Alert: ${a.name}`, {
        body: `Due soon — ${a.course_name}`, tag: String(a.id),
      }))
  }, [alerts, notifGranted])

  const visible = alerts.filter(a => !dismissed.has(a.id))
  if (visible.length === 0) return null

  return (
    <div className="space-y-2 mb-4">
      {visible.map(a => (
        <div key={a.id} className={`flex items-start justify-between rounded-lg px-4 py-3 shadow ${URGENCY_STYLES[a.urgency] || 'bg-gray-200'}`}>
          <div>
            <span className="font-bold mr-2">{URGENCY_LABEL[a.urgency]}</span>
            <span className="font-medium">{a.name}</span>
            <span className="ml-2 text-sm opacity-80">— {a.course_name}</span>
            {a.due_at && (
              <span className="ml-2 text-xs opacity-70">
                ({formatDistanceToNow(parseISO(a.due_at), { addSuffix: true })})
              </span>
            )}
          </div>
          <button onClick={() => setDismissed(d => new Set([...d, a.id]))}
            className="ml-4 text-lg leading-none opacity-70 hover:opacity-100" aria-label="Dismiss">×</button>
        </div>
      ))}
    </div>
  )
}
