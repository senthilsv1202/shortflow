import { supabase } from './supabase.js'
const BASE = import.meta.env.VITE_API_URL || '/api'

async function req(path, opts={}) {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { 'Content-Type':'application/json', ...(token?{Authorization:`Bearer ${token}`}:{}), ...opts.headers }
  })
  if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.error||`HTTP ${res.status}`) }
  return res.json()
}

export const api = {
  generateShort:   (p) => req('/generate/short',   { method:'POST', body:JSON.stringify(p) }),
  generateScript:  (p) => req('/generate/script',  { method:'POST', body:JSON.stringify(p) }),
  getTrends:       (niche) => req(`/trends?niche=${encodeURIComponent(niche)}`),
  publishNow:      (id, p) => req(`/publish/${id}`, { method:'POST', body:JSON.stringify(p) }),
  schedulePost:    (p) => req('/schedule',   { method:'POST', body:JSON.stringify(p) }),
  cancelSchedule:  (id) => req(`/schedule/${id}`, { method:'DELETE' }),
  getYouTubeAuthUrl: () => req('/youtube/auth-url'),
  exchangeYouTubeCode: (code) => req('/youtube/exchange', { method:'POST', body:JSON.stringify({code}) }),
  syncChannelStats: (id) => req(`/youtube/stats/${id}`),
  createCheckout:  (plan) => req('/billing/checkout', { method:'POST', body:JSON.stringify({plan}) }),
  createPortal:    () => req('/billing/portal', { method:'POST' }),
  generateVoice:   (p) => req('/voice/generate', { method:'POST', body:JSON.stringify(p) }),
  listVoices:      () => req('/voice/list'),
  syncAnalytics:   () => req('/analytics/sync', { method:'POST' }),
  generateVideo:   (shortId, p) => req(`/video/generate/${shortId}`, { method:'POST', body:JSON.stringify(p||{}) }),
  getVideoStatus:  (shortId) => req(`/video/status/${shortId}`),
}
