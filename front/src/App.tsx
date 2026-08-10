import { useQuery } from '@tanstack/react-query'
import type { HealthResponse } from '@flatnik/shared'

async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch('/api/health')
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export function App() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
    refetchInterval: 10_000,
  })

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', maxWidth: 640 }}>
      <h1>flatnik</h1>

      <section>
        <h2 style={{ fontSize: '1rem', color: '#666' }}>Состояние бэкенда</h2>

        {isLoading && <p>Проверяем…</p>}

        {error && (
          <p style={{ color: '#c00' }}>
            Бэкенд недоступен: {(error as Error).message}
          </p>
        )}

        {data && (
          <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.25rem 1rem' }}>
            <dt>status</dt>
            <dd style={{ color: data.status === 'ok' ? '#0a0' : '#c80' }}>{data.status}</dd>
            <dt>service</dt>
            <dd>{data.service}</dd>
            <dt>uptime</dt>
            <dd>{data.uptime}s</dd>
          </dl>
        )}
      </section>
    </main>
  )
}
