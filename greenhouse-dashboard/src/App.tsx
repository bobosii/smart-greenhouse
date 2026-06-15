import { useEffect, useState, useCallback } from 'react'
import { io } from 'socket.io-client'
import axios from 'axios'
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid
} from 'recharts'
import './index.css'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const DEVICE_ID = 'sera_001'

interface SensorData {
  device_id: string
  temperature: number
  humidity: number
  soil: number
  light_lux: number
  flow_lpm: number
  recorded_at?: string
}

interface Profile {
  id: number
  name: string
  temp_min: number; temp_max: number
  humidity_min: number; humidity_max: number
  soil_min: number; soil_max: number
  light_min: number; light_max: number
}

interface AutomationRule {
  profile_id: number
  active: boolean
  profile_name: string
}

type ChartKey = 'temperature' | 'humidity' | 'soil' | 'light_lux'
type Tab = 'sensors' | 'profiles'

const CHART_LABELS: Record<ChartKey, string> = {
  temperature: 'Sıcaklık (°C)',
  humidity: 'Nem (%)',
  soil: 'Toprak (%)',
  light_lux: 'Işık (lux)',
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
}

export default function App() {
  const [tab, setTab] = useState<Tab>('sensors')
  const [live, setLive] = useState<SensorData | null>(null)
  const [history, setHistory] = useState<SensorData[]>([])
  const [connected, setConnected] = useState(false)
  const [lastUpdated, setLastUpdated] = useState('')
  const [chartKey, setChartKey] = useState<ChartKey>('temperature')
  const [pump, setPump] = useState(true)
  const [fan, setFan] = useState(true)
  const [lightPct, setLightPct] = useState(0)

  // Profil state
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [automation, setAutomation] = useState<AutomationRule | null>(null)
  const [selectedProfile, setSelectedProfile] = useState<number>(1)
  const [automationActive, setAutomationActive] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [newProfile, setNewProfile] = useState({
    name: '', temp_min: 15, temp_max: 30,
    humidity_min: 40, humidity_max: 80,
    soil_min: 30, soil_max: 70,
    light_min: 200, light_max: 2000,
  })

  const fetchHistory = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/sensors/history?hours=6`)
      setHistory(res.data)
    } catch (e) { console.error(e) }
  }, [])

  const fetchProfiles = useCallback(async () => {
    try {
      const [profRes, autoRes] = await Promise.all([
        axios.get(`${API}/api/profiles`),
        axios.get(`${API}/api/profiles/automation/${DEVICE_ID}`),
      ])
      setProfiles(profRes.data)
      if (autoRes.data) {
        setAutomation(autoRes.data)
        setSelectedProfile(autoRes.data.profile_id)
        setAutomationActive(autoRes.data.active)
      }
    } catch (e) { console.error(e) }
  }, [])

  useEffect(() => {
    axios.get(`${API}/api/sensors/latest`).then(res => {
      if (res.data?.device_id) setLive(res.data)
    }).catch(() => {})
    fetchHistory()
    fetchProfiles()
  }, [fetchHistory, fetchProfiles])

  useEffect(() => {
    const socket = io(API)
    socket.on('connect', () => setConnected(true))
    socket.on('disconnect', () => setConnected(false))
    socket.on('sensor_data', (data: SensorData) => {
      setLive(data)
      setLastUpdated(new Date().toLocaleTimeString('tr-TR'))
      setHistory(prev => [...prev, { ...data, recorded_at: new Date().toISOString() }].slice(-120))
    })
    return () => { socket.disconnect() }
  }, [])

  const sendCommand = async (actuator: string, state: boolean | number) => {
    try { await axios.post(`${API}/api/actuators/command`, { actuator, state }) }
    catch (e) { console.error(e) }
  }

  const togglePump = () => { const n = !pump; setPump(n); sendCommand('pump', n) }
  const toggleFan  = () => { const n = !fan;  setFan(n);  sendCommand('fan', n)  }
  const handleLight = (v: number) => { setLightPct(v); sendCommand('light', v > 0) }

  const saveProfile = async () => {
    if (!newProfile.name.trim()) return
    try {
      await axios.post(`${API}/api/profiles`, newProfile)
      setShowForm(false)
      setNewProfile({ name: '', temp_min: 15, temp_max: 30, humidity_min: 40, humidity_max: 80, soil_min: 30, soil_max: 70, light_min: 200, light_max: 2000 })
      fetchProfiles()
    } catch (e) { console.error(e) }
  }

  const saveAutomation = async () => {
    try {
      await axios.post(`${API}/api/profiles/automation`, {
        device_id: DEVICE_ID,
        profile_id: selectedProfile,
        active: automationActive,
      })
      fetchProfiles()
    } catch (e) { console.error(e) }
  }

  const tempStatus = live ? (live.temperature > 35 ? 'danger' : live.temperature > 30 ? 'warn' : '') : ''
  const humStatus  = live ? (live.humidity < 30 ? 'danger' : live.humidity < 40 ? 'warn' : '') : ''
  const soilStatus = live ? (live.soil < 20 ? 'danger' : live.soil < 30 ? 'warn' : '') : ''

  const chartData = history.map(d => ({
    time: d.recorded_at ? formatTime(d.recorded_at) : '',
    value: Number((d[chartKey] ?? 0).toFixed(1)),
  }))

  const activeProfile = profiles.find(p => p.id === selectedProfile)

  return (
    <>
      <header className="topbar">
        <div className="topbar-logo">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
            <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10"/>
            <path d="M12 6v6l4 2"/><path d="M17 3l4 4-4 4"/>
          </svg>
          SERA-001
        </div>
        <div className="tab-nav">
          <button className={`tab-btn ${tab === 'sensors' ? 'active' : ''}`} onClick={() => setTab('sensors')}>
            📊 Sensörler
          </button>
          <button className={`tab-btn ${tab === 'profiles' ? 'active' : ''}`} onClick={() => setTab('profiles')}>
            🌿 Bitki Profilleri
          </button>
        </div>
        <div className="topbar-meta">
          <span>{new Date().toLocaleDateString('tr-TR')}</span>
          <div className="live-badge">
            <div className={`live-dot ${connected ? '' : 'offline'}`} />
            {connected ? 'CANLI' : 'BAĞLANTI YOK'}
          </div>
        </div>
      </header>

      <main className="main">

        {/* ── SENSORS TAB ── */}
        {tab === 'sensors' && <>
          <div className="section-label">Sensör Verileri</div>
          <div className="sensor-grid">
            <div className={`sensor-card ${tempStatus}`}>
              <div className="card-icon">🌡️</div>
              <div className="card-label">Sıcaklık</div>
              <div className={`card-value ${tempStatus}`}>{live ? live.temperature.toFixed(1) : '--'}</div>
              <div className="card-unit">°C</div>
              <div className="card-bar"><div className="card-bar-fill" style={{ width: `${Math.min(live ? (live.temperature / 50) * 100 : 0, 100)}%` }} /></div>
            </div>
            <div className={`sensor-card ${humStatus}`}>
              <div className="card-icon">💧</div>
              <div className="card-label">Nem</div>
              <div className={`card-value ${humStatus}`}>{live ? live.humidity.toFixed(1) : '--'}</div>
              <div className="card-unit">%</div>
              <div className="card-bar"><div className="card-bar-fill" style={{ width: `${live ? live.humidity : 0}%` }} /></div>
            </div>
            <div className={`sensor-card ${soilStatus}`}>
              <div className="card-icon">🌱</div>
              <div className="card-label">Toprak Nemi</div>
              <div className={`card-value ${soilStatus}`}>{live ? live.soil : '--'}</div>
              <div className="card-unit">%</div>
              <div className="card-bar"><div className="card-bar-fill" style={{ width: `${live ? live.soil : 0}%` }} /></div>
            </div>
            <div className="sensor-card">
              <div className="card-icon">☀️</div>
              <div className="card-label">Işık</div>
              <div className="card-value">{live ? live.light_lux.toFixed(0) : '--'}</div>
              <div className="card-unit">lux</div>
              <div className="card-bar"><div className="card-bar-fill" style={{ width: `${Math.min(live ? (live.light_lux / 2000) * 100 : 0, 100)}%` }} /></div>
            </div>
            <div className="sensor-card">
              <div className="card-icon">🚿</div>
              <div className="card-label">Su Akışı</div>
              <div className="card-value">{live ? live.flow_lpm.toFixed(2) : '--'}</div>
              <div className="card-unit">L/dak</div>
              <div className="card-bar"><div className="card-bar-fill" style={{ width: `${Math.min(live ? live.flow_lpm * 20 : 0, 100)}%` }} /></div>
            </div>
          </div>

          <div className="bottom-grid">
            <div className="chart-card">
              <div className="chart-header">
                <div className="section-label" style={{ marginBottom: 0 }}>Geçmiş (6 saat)</div>
                <div className="chart-tabs">
                  {(Object.keys(CHART_LABELS) as ChartKey[]).map(k => (
                    <button key={k} className={`chart-tab ${chartKey === k ? 'active' : ''}`} onClick={() => setChartKey(k)}>
                      {k === 'temperature' ? 'SICAK' : k === 'humidity' ? 'NEM' : k === 'soil' ? 'TOPRAK' : 'IŞIK'}
                    </button>
                  ))}
                </div>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2e1e" />
                  <XAxis dataKey="time" tick={{ fill: '#5a7a5a', fontSize: 10, fontFamily: 'Space Mono' }} />
                  <YAxis tick={{ fill: '#5a7a5a', fontSize: 10, fontFamily: 'Space Mono' }} />
                  <Tooltip contentStyle={{ background: '#0e160e', border: '1px solid #1e2e1e', borderRadius: 8, fontFamily: 'Space Mono', fontSize: 12 }} labelStyle={{ color: '#5a7a5a' }} itemStyle={{ color: '#4ade80' }} />
                  <Line type="monotone" dataKey="value" stroke="#4ade80" strokeWidth={2} dot={false} name={CHART_LABELS[chartKey]} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="actuator-card">
              <div className="section-label" style={{ marginBottom: 0 }}>Aktuatör Kontrolü</div>
              {automationActive && (
                <div className="auto-badge">🤖 Otomasyon aktif — manuel kontrol devre dışı</div>
              )}
              <div className="actuator-row">
                <div className="act-label">
                  <span>Peristaltik Pompa</span>
                  <span className={`act-status ${pump ? '' : 'off'}`}>{pump ? 'AÇIK' : 'KAPALI'}</span>
                </div>
                <button className={`toggle-btn ${pump ? 'on' : ''} ${automationActive ? 'disabled' : ''}`} onClick={!automationActive ? togglePump : undefined}>
                  💧 {pump ? 'Pompayı Durdur' : 'Pompayı Çalıştır'}
                  <div className="switch" />
                </button>
              </div>
              <div className="divider" />
              <div className="actuator-row">
                <div className="act-label">
                  <span>Fan</span>
                  <span className={`act-status ${fan ? '' : 'off'}`}>{fan ? 'AÇIK' : 'KAPALI'}</span>
                </div>
                <button className={`toggle-btn ${fan ? 'on' : ''} ${automationActive ? 'disabled' : ''}`} onClick={!automationActive ? toggleFan : undefined}>
                  🌀 {fan ? 'Fanı Durdur' : 'Fanı Çalıştır'}
                  <div className="switch" />
                </button>
              </div>
              <div className="divider" />
              <div className="light-row">
                <div className="act-label">
                  <span>Grow Light</span>
                  <span className={`act-status ${lightPct > 0 ? '' : 'off'}`}>{lightPct}%</span>
                </div>
                <div className="light-value">{'▮'.repeat(Math.round(lightPct / 10))}{'▯'.repeat(10 - Math.round(lightPct / 10))}</div>
                <input type="range" min={0} max={100} step={5} value={lightPct} className="slider" disabled={automationActive} onChange={e => handleLight(Number(e.target.value))} />
              </div>
            </div>
          </div>

          <div className="footer-note">
            {lastUpdated ? `Son güncelleme: ${lastUpdated}` : 'Veri bekleniyor...'}
            {' · '} SERA-001 · Smart Greenhouse v1.0
          </div>
        </>}

        {/* ── PROFILES TAB ── */}
        {tab === 'profiles' && <>
          <div className="section-label">Otomasyon Ayarları</div>

          {/* Otomasyon kontrol */}
          <div className="auto-control-card">
            <div className="auto-control-row">
              <div>
                <div className="auto-control-title">Otomasyon</div>
                <div className="auto-control-sub">Aktif profil eşiklerine göre aktuatörler otomatik kontrol edilir</div>
              </div>
              <button className={`toggle-btn ${automationActive ? 'on' : ''}`} style={{ width: 'auto', padding: '10px 20px' }}
                onClick={() => setAutomationActive(v => !v)}>
                {automationActive ? 'AÇIK' : 'KAPALI'}
                <div className="switch" />
              </button>
            </div>

            <div className="divider" />

            <div className="auto-control-row">
              <div className="act-label" style={{ margin: 0 }}>
                <span>Aktif Profil</span>
              </div>
              <select className="profile-select" value={selectedProfile} onChange={e => setSelectedProfile(Number(e.target.value))}>
                {profiles.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <button className="save-btn" onClick={saveAutomation}>Kaydet</button>
          </div>

          {/* Aktif profil eşikleri */}
          {activeProfile && (
            <>
              <div className="section-label" style={{ marginTop: 28 }}>
                {activeProfile.name} — Eşik Değerleri
              </div>
              <div className="threshold-grid">
                <div className="threshold-card">
                  <div className="card-icon">🌡️</div>
                  <div className="card-label">Sıcaklık</div>
                  <div className="threshold-range">
                    <span>{activeProfile.temp_min}°C</span>
                    <div className="threshold-bar">
                      <div className="threshold-fill" style={{ left: `${(activeProfile.temp_min / 50) * 100}%`, right: `${100 - (activeProfile.temp_max / 50) * 100}%` }} />
                      {live && <div className="threshold-marker" style={{ left: `${Math.min((live.temperature / 50) * 100, 100)}%` }} />}
                    </div>
                    <span>{activeProfile.temp_max}°C</span>
                  </div>
                  {live && <div className="threshold-current">Şu an: {live.temperature.toFixed(1)}°C</div>}
                </div>

                <div className="threshold-card">
                  <div className="card-icon">💧</div>
                  <div className="card-label">Nem</div>
                  <div className="threshold-range">
                    <span>{activeProfile.humidity_min}%</span>
                    <div className="threshold-bar">
                      <div className="threshold-fill" style={{ left: `${activeProfile.humidity_min}%`, right: `${100 - activeProfile.humidity_max}%` }} />
                      {live && <div className="threshold-marker" style={{ left: `${Math.min(live.humidity, 100)}%` }} />}
                    </div>
                    <span>{activeProfile.humidity_max}%</span>
                  </div>
                  {live && <div className="threshold-current">Şu an: {live.humidity.toFixed(1)}%</div>}
                </div>

                <div className="threshold-card">
                  <div className="card-icon">🌱</div>
                  <div className="card-label">Toprak Nemi</div>
                  <div className="threshold-range">
                    <span>{activeProfile.soil_min}%</span>
                    <div className="threshold-bar">
                      <div className="threshold-fill" style={{ left: `${activeProfile.soil_min}%`, right: `${100 - activeProfile.soil_max}%` }} />
                      {live && <div className="threshold-marker" style={{ left: `${Math.min(live.soil, 100)}%` }} />}
                    </div>
                    <span>{activeProfile.soil_max}%</span>
                  </div>
                  {live && <div className="threshold-current">Şu an: {live.soil}%</div>}
                </div>

                <div className="threshold-card">
                  <div className="card-icon">☀️</div>
                  <div className="card-label">Işık</div>
                  <div className="threshold-range">
                    <span>{activeProfile.light_min}</span>
                    <div className="threshold-bar">
                      <div className="threshold-fill" style={{ left: `${(activeProfile.light_min / 2000) * 100}%`, right: `${100 - Math.min((activeProfile.light_max / 2000) * 100, 100)}%` }} />
                      {live && <div className="threshold-marker" style={{ left: `${Math.min((live.light_lux / 2000) * 100, 100)}%` }} />}
                    </div>
                    <span>{activeProfile.light_max}</span>
                  </div>
                  {live && <div className="threshold-current">Şu an: {live.light_lux.toFixed(0)} lux</div>}
                </div>
              </div>
            </>
          )}

          {/* Tüm profiller listesi */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 28, marginBottom: 14 }}>
            <div className="section-label" style={{ margin: 0 }}>Tüm Profiller</div>
            <button className="save-btn" onClick={() => setShowForm(v => !v)}>
              {showForm ? '✕ İptal' : '+ Yeni Profil'}
            </button>
          </div>

          {showForm && (
            <div className="auto-control-card" style={{ marginBottom: 16 }}>
              <div className="auto-control-title">Yeni Bitki Profili</div>
              <div className="form-grid">
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Profil Adı</label>
                  <input className="form-input" placeholder="ör. Salatalık" value={newProfile.name}
                    onChange={e => setNewProfile(p => ({ ...p, name: e.target.value }))} />
                </div>
                {([
                  ['temp_min', 'Sıcaklık Min (°C)'], ['temp_max', 'Sıcaklık Max (°C)'],
                  ['humidity_min', 'Nem Min (%)'], ['humidity_max', 'Nem Max (%)'],
                  ['soil_min', 'Toprak Min (%)'], ['soil_max', 'Toprak Max (%)'],
                  ['light_min', 'Işık Min (lux)'], ['light_max', 'Işık Max (lux)'],
                ] as [keyof typeof newProfile, string][]).map(([key, label]) => (
                  <div key={key} className="form-group">
                    <label className="form-label">{label}</label>
                    <input className="form-input" type="number" value={newProfile[key]}
                      onChange={e => setNewProfile(p => ({ ...p, [key]: Number(e.target.value) }))} />
                  </div>
                ))}
              </div>
              <button className="save-btn" onClick={saveProfile}>Profili Kaydet</button>
            </div>
          )}

          <div className="profiles-list">
            {profiles.map(p => (
              <div key={p.id} className={`profile-row ${p.id === selectedProfile ? 'active' : ''}`}>
                <div className="profile-name">{p.name}</div>
                <div className="profile-specs">
                  <span>🌡️ {p.temp_min}–{p.temp_max}°C</span>
                  <span>💧 {p.humidity_min}–{p.humidity_max}%</span>
                  <span>🌱 {p.soil_min}–{p.soil_max}%</span>
                  <span>☀️ {p.light_min}–{p.light_max} lux</span>
                </div>
                <button className="select-profile-btn" onClick={() => setSelectedProfile(p.id)}>
                  {p.id === selectedProfile ? '✓ Seçili' : 'Seç'}
                </button>
              </div>
            ))}
          </div>
        </>}
      </main>
    </>
  )
}
