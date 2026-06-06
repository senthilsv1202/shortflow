import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
const router = Router()

router.get('/', requireAuth, async (req, res) => {
  const { days='30' } = req.query
  const from = new Date(Date.now()-parseInt(days)*86400000).toISOString().split('T')[0]
  const { data, error } = await req.supabase.from('analytics').select('*').eq('user_id',req.user.id).gte('date',from).order('date')
  if (error) return res.status(500).json({ error:error.message })
  res.json({ analytics:data||[] })
})

router.post('/sync', requireAuth, async (req, res) => {
  // In production: fetch from YouTube Analytics API and upsert per-day rows
  // This is a placeholder — wire up googleapis yt-analytics-readonly scope
  res.json({ message:'Analytics sync queued. Wire up YouTube Analytics API for live data.' })
})

export default router
