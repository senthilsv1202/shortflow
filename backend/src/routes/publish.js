import { Router } from 'express'
import { google } from 'googleapis'
import { requireAuth } from '../middleware/auth.js'
import { Readable } from 'stream'

const router = Router()

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.YOUTUBE_CLIENT_ID,
    process.env.YOUTUBE_CLIENT_SECRET,
    process.env.YOUTUBE_REDIRECT_URI
  )
}

// POST /api/publish/:shortId
router.post('/:shortId', requireAuth, async (req, res) => {
  const { shortId } = req.params
  const { channel_id, privacy = 'public' } = req.body

  try {
    // 1. Get the short
    const { data: short, error: shortErr } = await req.supabase
      .from('shorts')
      .select('*')
      .eq('id', shortId)
      .eq('user_id', req.user.id)
      .single()

    if (shortErr || !short) return res.status(404).json({ error: 'Short not found' })

    // 2. Get the channel with tokens
    const { data: channel, error: chErr } = await req.supabase
      .from('channels')
      .select('*')
      .eq('id', channel_id)
      .eq('user_id', req.user.id)
      .single()

    if (chErr || !channel) return res.status(404).json({ error: 'Channel not found' })
    if (!channel.access_token) return res.status(400).json({ error: 'Channel not connected via OAuth' })

    // 3. Set up YouTube OAuth
    const auth = getOAuth2Client()
    auth.setCredentials({
      access_token: channel.access_token,
      refresh_token: channel.refresh_token,
    })

    // Auto-refresh token if needed
    auth.on('tokens', async (tokens) => {
      if (tokens.access_token) {
        await req.supabase.from('channels').update({
          access_token: tokens.access_token,
          token_expiry: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null
        }).eq('id', channel_id)
      }
    })

    const youtube = google.youtube({ version: 'v3', auth })

    // 4. Build video metadata
    const title = short.title?.slice(0, 100) || 'My Short'
    const description = short.description || `${short.topic}\n\n${(short.tags || []).join(' ')}`
    const tags = short.tags || []

    // 5. Upload video (or create placeholder if no video file)
    let videoId

    if (short.video_url) {
      // Upload actual video file
      const videoRes = await fetch(short.video_url)
      const videoBuffer = await videoRes.buffer()
      const videoStream = Readable.from(videoBuffer)

      const uploadRes = await youtube.videos.insert({
        part: ['snippet', 'status'],
        requestBody: {
          snippet: {
            title,
            description,
            tags,
            categoryId: '28', // Science & Technology
          },
          status: {
            privacyStatus: privacy,
            selfDeclaredMadeForKids: false,
          }
        },
        media: {
          mimeType: 'video/mp4',
          body: videoStream
        }
      })
      videoId = uploadRes.data.id
    } else {
      // No video file yet — update status to 'ready' and return error
      return res.status(400).json({
        error: 'No video file attached to this short. Generate a video first before publishing.',
        short_id: shortId
      })
    }

    // 6. Update short status in Supabase
    await req.supabase.from('shorts').update({
      status: 'published',
      youtube_video_id: videoId,
      published_at: new Date().toISOString()
    }).eq('id', shortId)

    res.json({
      success: true,
      youtube_video_id: videoId,
      youtube_url: `https://youtube.com/shorts/${videoId}`
    })

  } catch (err) {
    console.error('Publish error:', err)
    // Update short status to failed
    await req.supabase.from('shorts').update({ status: 'failed' }).eq('id', shortId).catch(() => {})
    res.status(500).json({ error: err.message || 'Failed to publish' })
  }
})

export default router
