import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
const router = Router()

router.get('/', requireAuth, async (req, res) => {
  const { data, error } = await req.supabase.from('scheduled_posts')
    .select('*, shorts(*), channels(*)').eq('user_id',req.user.id)
    .gte('scheduled_at',new Date().toISOString()).order('scheduled_at')
  if (error) return res.status(500).json({ error:error.message })
  res.json({ posts:data||[] })
})

router.post('/', requireAuth, async (req, res) => {
  const { short_id, channel_id, scheduled_at, privacy='public' } = req.body
  if (!short_id||!scheduled_at) return res.status(400).json({ error:'short_id and scheduled_at required' })
  const { data, error } = await req.supabase.from('scheduled_posts').insert({ user_id:req.user.id, short_id, channel_id, scheduled_at, privacy, status:'pending' }).select().single()
  if (error) return res.status(500).json({ error:error.message })
  await req.supabase.from('shorts').update({ status:'scheduled', scheduled_at }).eq('id',short_id)
  res.json({ post:data })
})

router.delete('/:id', requireAuth, async (req, res) => {
  const { error } = await req.supabase.from('scheduled_posts').delete().eq('id',req.params.id).eq('user_id',req.user.id)
  if (error) return res.status(500).json({ error:error.message })
  res.json({ success:true })
})

export default router
