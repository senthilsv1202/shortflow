import { Router } from 'express'
import { google } from 'googleapis'
import { requireAuth } from '../middleware/auth.js'
const router = Router()

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.YOUTUBE_CLIENT_ID,
    process.env.YOUTUBE_CLIENT_SECRET,
    process.env.YOUTUBE_REDIRECT_URI
  )
}

router.get('/auth-url', requireAuth, (req, res) => {
  const client = getOAuth2Client()
  const url = client.generateAuthUrl({
    access_type:'offline', prompt:'consent',
    scope:['https://www.googleapis.com/auth/youtube.upload','https://www.googleapis.com/auth/youtube.readonly','https://www.googleapis.com/auth/yt-analytics.readonly'],
    state:req.user.id
  })
  res.json({ url })
})

// OAuth callback (redirect from Google)
router.get('/callback', async (req, res) => {
  const { code, state:userId } = req.query
  if (!code||!userId) return res.redirect(`${process.env.FRONTEND_URL}/channels?error=auth_failed`)
  try {
    const client = getOAuth2Client()
    const { tokens } = await client.getToken(code)
    client.setCredentials(tokens)
    const yt = google.youtube({ version:'v3', auth:client })
    const { data } = await yt.channels.list({ part:'snippet,statistics', mine:true })
    const ch = data.items?.[0]
    if (!ch) throw new Error('No channel found')
    const { createClient } = await import('@supabase/supabase-js')
    const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
    await sb.from('channels').upsert({
      user_id:userId, youtube_channel_id:ch.id,
      name:ch.snippet.title, handle:ch.snippet.customUrl,
      thumbnail:ch.snippet.thumbnails?.default?.url,
      subscribers:parseInt(ch.statistics.subscriberCount||0),
      total_views:parseInt(ch.statistics.viewCount||0),
      video_count:parseInt(ch.statistics.videoCount||0),
      access_token:tokens.access_token, refresh_token:tokens.refresh_token,
      token_expiry:tokens.expiry_date?new Date(tokens.expiry_date).toISOString():null,
      ypp_eligible:parseInt(ch.statistics.subscriberCount||0)>=1000
    })
    res.redirect(`${process.env.FRONTEND_URL}/channels?connected=true`)
  } catch(err) {
    console.error('YouTube callback error:',err)
    res.redirect(`${process.env.FRONTEND_URL}/channels?error=${encodeURIComponent(err.message)}`)
  }
})

router.post('/exchange', requireAuth, async (req, res) => {
  const { code } = req.body
  try {
    const client = getOAuth2Client()
    const { tokens } = await client.getToken(code)
    client.setCredentials(tokens)
    const yt = google.youtube({ version:'v3', auth:client })
    const { data } = await yt.channels.list({ part:'snippet,statistics', mine:true })
    const ch = data.items?.[0]
    if (!ch) return res.status(400).json({ error:'No YouTube channel found' })
    const { data:saved } = await req.supabase.from('channels').upsert({
      user_id:req.user.id, youtube_channel_id:ch.id,
      name:ch.snippet.title, handle:ch.snippet.customUrl,
      thumbnail:ch.snippet.thumbnails?.default?.url,
      subscribers:parseInt(ch.statistics.subscriberCount||0),
      total_views:parseInt(ch.statistics.viewCount||0),
      access_token:tokens.access_token, refresh_token:tokens.refresh_token,
      token_expiry:tokens.expiry_date?new Date(tokens.expiry_date).toISOString():null,
    }).select().single()
    res.json({ channel:saved })
  } catch(err) { res.status(500).json({ error:err.message }) }
})

router.get('/stats/:channelId', requireAuth, async (req, res) => {
  const { data:ch } = await req.supabase.from('channels').select('*').eq('id',req.params.channelId).eq('user_id',req.user.id).single()
  if (!ch) return res.status(404).json({ error:'Channel not found' })
  try {
    const client = getOAuth2Client()
    client.setCredentials({ access_token:ch.access_token, refresh_token:ch.refresh_token })
    const yt = google.youtube({ version:'v3', auth:client })
    const { data } = await yt.channels.list({ part:'statistics', id:ch.youtube_channel_id })
    const stats = data.items?.[0]?.statistics
    if (stats) {
      await req.supabase.from('channels').update({ subscribers:parseInt(stats.subscriberCount||0), total_views:parseInt(stats.viewCount||0), video_count:parseInt(stats.videoCount||0) }).eq('id',ch.id)
    }
    res.json({ stats })
  } catch(err) { res.status(500).json({ error:err.message }) }
})

export default router
