import { useEffect, useState, useCallback } from 'react'
import { io } from 'socket.io-client'
import axios from 'axios'
import {
    AreaChart, Area, XAxis, YAxis, Tooltip,
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
    light_lux: 'Gün Işığı (lux)',
}

function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
}

type IconProps = { size?: number }

function IconLeaf({ size = 20 }: IconProps) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-11 10Z" />
            <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 9" />
        </svg>
    )
}

function IconChart({ size = 20 }: IconProps) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3v18h18" />
            <path d="M18 17V9" /><path d="M13 17V5" /><path d="M8 17v-3" />
        </svg>
    )
}

function IconThermometer({ size = 20 }: IconProps) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z" />
        </svg>
    )
}

function IconDroplet({ size = 20 }: IconProps) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
        </svg>
    )
}

function IconSprout({ size = 20 }: IconProps) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20V10" />
            <path d="M12 10C12 10 7 10 7 5C12 5 12 10 12 10Z" />
            <path d="M12 10C12 10 17 10 17 5C12 5 12 10 12 10Z" />
        </svg>
    )
}

function IconSun({ size = 20 }: IconProps) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2" /><path d="M12 20v2" />
            <path d="m4.93 4.93 1.41 1.41" /><path d="m17.66 17.66 1.41 1.41" />
            <path d="M2 12h2" /><path d="M20 12h2" />
            <path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" />
        </svg>
    )
}

function IconWaves({ size = 20 }: IconProps) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 8c.6.5 1.2 1 2.5 1C7 9 7 7 9.5 7c2.5 0 2.5 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
            <path d="M2 14c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.5 0 2.5 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
            <path d="M2 20c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.5 0 2.5 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
        </svg>
    )
}

function IconFan({ size = 20 }: IconProps) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="1.5" />
            <path d="M12 12c0-3 1.5-6 4-7 1.5 2 1 5-1 7" />
            <path d="M12 12c-3 0-6-1.5-7-4 2-1.5 5-1 7 1" />
            <path d="M12 12c0 3-1.5 6-4 7-1.5-2-1-5 1-7" />
            <path d="M12 12c3 0 6 1.5 7 4-2 1.5-5 1-7-1" />
        </svg>
    )
}

function IconBulb({ size = 20 }: IconProps) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18h6" /><path d="M10 22h4" />
            <path d="M12 2a7 7 0 0 0-4 12.7c.5.4.8 1 .9 1.6l.1.7h6l.1-.7c.1-.6.4-1.2.9-1.6A7 7 0 0 0 12 2Z" />
        </svg>
    )
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
        }).catch(() => { })
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
    const toggleFan = () => { const n = !fan; setFan(n); sendCommand('fan', n) }
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
    const humStatus = live ? (live.humidity < 30 ? 'danger' : live.humidity < 40 ? 'warn' : '') : ''
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
                    <IconLeaf size={21} />
                    Sera·001
                </div>
                <div className="tab-nav">
                    <button className={`tab-btn ${tab === 'sensors' ? 'active' : ''}`} onClick={() => setTab('sensors')}>
                        <IconChart size={15} /> Sensörler
                    </button>
                    <button className={`tab-btn ${tab === 'profiles' ? 'active' : ''}`} onClick={() => setTab('profiles')}>
                        <IconLeaf size={15} /> Bitki Profilleri
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
                            <div className="card-icon"><IconThermometer /></div>
                            <div className="card-label">Sıcaklık</div>
                            <div className={`card-value ${tempStatus}`}>{live ? live.temperature.toFixed(1) : '--'}</div>
                            <div className="card-unit">°C</div>
                            <div className="card-bar"><div className="card-bar-fill" style={{ width: `${Math.min(live ? (live.temperature / 50) * 100 : 0, 100)}%` }} /></div>
                        </div>
                        <div className={`sensor-card ${humStatus}`}>
                            <div className="card-icon"><IconDroplet /></div>
                            <div className="card-label">Nem</div>
                            <div className={`card-value ${humStatus}`}>{live ? live.humidity.toFixed(1) : '--'}</div>
                            <div className="card-unit">%</div>
                            <div className="card-bar"><div className="card-bar-fill" style={{ width: `${live ? live.humidity : 0}%` }} /></div>
                        </div>
                        <div className={`sensor-card ${soilStatus}`}>
                            <div className="card-icon"><IconSprout /></div>
                            <div className="card-label">Toprak Nemi</div>
                            <div className={`card-value ${soilStatus}`}>{live ? live.soil : '--'}</div>
                            <div className="card-unit">%</div>
                            <div className="card-bar"><div className="card-bar-fill" style={{ width: `${live ? live.soil : 0}%` }} /></div>
                        </div>
                        <div className="sensor-card">
                            <div className="card-icon"><IconSun /></div>
                            <div className="card-label">Gün ışığı</div>
                            <div className="card-value">{live ? live.light_lux.toFixed(0) : '--'}</div>
                            <div className="card-unit">lux</div>
                            <div className="card-bar"><div className="card-bar-fill" style={{ width: `${Math.min(live ? (live.light_lux / 2000) * 100 : 0, 100)}%` }} /></div>
                        </div>
                        <div className="sensor-card">
                            <div className="card-icon"><IconWaves /></div>
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
                                            {k === 'temperature' ? 'SICAK' : k === 'humidity' ? 'NEM' : k === 'soil' ? 'TOPRAK' : 'GÜN IŞIĞI'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <ResponsiveContainer width="100%" height={220}>
                                <AreaChart data={chartData}>
                                    <defs>
                                        <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#5b9669" stopOpacity={0.32} />
                                            <stop offset="100%" stopColor="#5b9669" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 5" stroke="#e0e7d8" vertical={false} />
                                    <XAxis dataKey="time" tick={{ fill: '#94a092', fontSize: 11, fontFamily: 'Manrope' }} axisLine={{ stroke: '#e0e7d8' }} tickLine={false} />
                                    <YAxis tick={{ fill: '#94a092', fontSize: 11, fontFamily: 'Manrope' }} axisLine={false} tickLine={false} width={36} />
                                    <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid #e0e7d8', borderRadius: 12, fontFamily: 'Manrope', fontSize: 12.5, boxShadow: '0 8px 24px rgba(23,48,31,0.12)' }} labelStyle={{ color: '#708070', fontWeight: 600 }} itemStyle={{ color: '#2c5b3a', fontWeight: 600 }} />
                                    <Area type="monotone" dataKey="value" stroke="#3c7a4d" strokeWidth={2.5} fill="url(#chartFill)" dot={false} name={CHART_LABELS[chartKey]} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="actuator-card">
                            <div className="section-label" style={{ marginBottom: 0 }}>Aktuatör Kontrolü</div>
                            {automationActive && (
                                <div className="auto-badge">Otomasyon aktif — manuel kontrol devre dışı</div>
                            )}
                            <div className="actuator-row">
                                <div className="act-label">
                                    <span>Peristaltik Pompa</span>
                                    <span className={`act-status ${pump ? '' : 'off'}`}>{pump ? 'AÇIK' : 'KAPALI'}</span>
                                </div>
                                <button className={`toggle-btn ${pump ? 'on' : ''} ${automationActive ? 'disabled' : ''}`} onClick={!automationActive ? togglePump : undefined}>
                                    <IconDroplet size={15} /> {pump ? 'Pompayı Durdur' : 'Pompayı Çalıştır'}
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
                                    <IconFan size={15} /> {fan ? 'Fanı Durdur' : 'Fanı Çalıştır'}
                                    <div className="switch" />
                                </button>
                            </div>
                            <div className="divider" />
                            <div className="light-row">
                                <div className="act-label">
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><IconBulb size={14} /> Grow Light</span>
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
                                    <div className="card-icon"><IconThermometer /></div>
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
                                    <div className="card-icon"><IconDroplet /></div>
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
                                    <div className="card-icon"><IconSprout /></div>
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
                                    <div className="card-icon"><IconSun /></div>
                                    <div className="card-label">Gün ışığı</div>
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
                                    <span><IconThermometer size={14} /> {p.temp_min}–{p.temp_max}°C</span>
                                    <span><IconDroplet size={14} /> {p.humidity_min}–{p.humidity_max}%</span>
                                    <span><IconSprout size={14} /> {p.soil_min}–{p.soil_max}%</span>
                                    <span><IconSun size={14} /> {p.light_min}–{p.light_max} lux</span>
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
