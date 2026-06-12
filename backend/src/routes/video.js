/**
 * Video Generation Pipeline
 *
 * POST /api/video/generate/:shortId
 *   1. Generate voiceover via ElevenLabs
 *   2. Upload audio to Supabase Storage
 *   3. Assemble video via Creatomate (text + audio + background)
 *   4. Save video_url + voiceover_url to shorts table
 *   5. Update short status → 'ready'
 */

import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

// ── helpers ────────────────────────────────────────────────────────────────

async function generateVoiceover(script, voiceId = '21m00Tcm4TlvDq8ikWAM') {
  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY not set')

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: script,
      model_id: 'eleven_monolingual_v1',
      voice_settings: { stability: 0.5, similarity_boost: 0.75 }
    })
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail?.message || `ElevenLabs error ${res.status}`)
  }
  return Buffer.from(await res.arrayBuffer())
}

async function uploadToSupabase(supabase, buffer, filename, contentType) {
  const { data, error } = await supabase.storage
    .from('shorts-media')
    .upload(filename, buffer, { contentType, upsert: true })
  if (error) throw new Error(`Storage upload failed: ${error.message}`)
  const { data: { publicUrl } } = supabase.storage
    .from('shorts-media')
    .getPublicUrl(filename)
  return publicUrl
}

async function assembleVideoCreatomate(short, audioUrl) {
  const apiKey = process.env.CREATOMATE_API_KEY
  if (!apiKey) throw new Error('CREATOMATE_API_KEY not set')

  // Split script into chunks for text overlay (max ~200 chars each)
  const script = short.script || short.hook || short.title
  const chunks = script.match(/.{1,180}(\s|$)/g) || [script]
  const duration = 60 // seconds

  const res = await fetch('https://api.creatomate.com/v1/renders', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      template_id: process.env.CREATOMATE_TEMPLATE_ID || undefined,
      // If no template, use a dynamic composition
      source: process.env.CREATOMATE_TEMPLATE_ID ? undefined : {
        output_format: 'mp4',
        width: 1080,
        height: 1920,
        duration,
        elements: [
          // Black background
          {
            type: 'rectangle',
            width: '100%',
            height: '100%',
            fill_color: '#0A0A0F',
            x: '50%',
            y: '50%',
          },
          // Title text
          {
            type: 'text',
            text: short.title || short.topic,
            font_family: 'Montserrat',
            font_weight: '800',
            font_size: '52px',
            fill_color: '#FFFFFF',
            width: '85%',
            x: '50%',
            y: '18%',
            x_alignment: '50%',
            y_alignment: '50%',
          },
          // Script / hook text
          {
            type: 'text',
            text: chunks[0] || '',
            font_family: 'Montserrat',
            font_weight: '500',
            font_size: '38px',
            fill_color: '#F0F0F0',
            width: '85%',
            x: '50%',
            y: '50%',
            x_alignment: '50%',
            y_alignment: '50%',
          },
          // Accent bar
          {
            type: 'rectangle',
            width: '120px',
            height: '8px',
            fill_color: '#FF3B3B',
            x: '50%',
            y: '75%',
            x_alignment: '50%',
          },
          // CTA text
          {
            type: 'text',
            text: short.cta || 'Follow for more!',
            font_family: 'Montserrat',
            font_weight: '700',
            font_size: '36px',
            fill_color: '#FF3B3B',
            width: '85%',
            x: '50%',
            y: '85%',
            x_alignment: '50%',
            y_alignment: '50%',
          },
          // Audio track
          {
            type: 'audio',
            source: audioUrl,
            duration,
          }
        ]
      },
      modifications: process.env.CREATOMATE_TEMPLATE_ID ? {
        'Title.text': short.title,
        'Script.text': short.script || short.hook,
        'CTA.text': short.cta || 'Follow for more!',
        'Audio.source': audioUrl,
      } : undefined
    })
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || `Creatomate error ${res.status}`)
  }

  const renders = await res.json()
  const render = Array.isArray(renders) ? renders[0] : renders

  // Poll for completion (max 5 min)
  return await pollCreatomate(apiKey, render.id)
}

async function pollCreatomate(apiKey, renderId, maxWait = 300000) {
  const start = Date.now()
  while (Date.now() - start < maxWait) {
    await new Promise(r => setTimeout(r, 5000))
    const res = await fetch(`https://api.creatomate.com/v1/renders/${renderId}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    })
    const render = await res.json()
    if (render.status === 'succeeded') return render.url
    if (render.status === 'failed') throw new Error(`Creatomate render failed: ${render.error_message}`)
  }
  throw new Error('Video render timed out after 5 minutes')
}

// ── route ──────────────────────────────────────────────────────────────────

router.post('/generate/:shortId', requireAuth, async (req, res) => {
  const { shortId } = req.params
  const { voice_id } = req.body

  // Get the short
  const { data: short, error } = await req.supabase
    .from('shorts')
    .select('*')
    .eq('id', shortId)
    .eq('user_id', req.user.id)
    .single()

  if (error || !short) return res.status(404).json({ error: 'Short not found' })

  // Update status to 'generating'
  await req.supabase.from('shorts').update({ status: 'generating' }).eq('id', shortId)

  // Run pipeline async so the request doesn't time out
  res.json({ message: 'Video generation started', short_id: shortId, status: 'generating' })

  ;(async () => {
    try {
      // Step 1: Generate voiceover
      console.log(`[video] Generating voiceover for short ${shortId}`)
      const scriptText = short.script || short.hook || short.title
      const audioBuffer = await generateVoiceover(scriptText, voice_id)

      // Step 2: Upload audio to Supabase Storage
      console.log(`[video] Uploading audio for short ${shortId}`)
      const audioFilename = `${req.user.id}/${shortId}/voiceover.mp3`
      const voiceoverUrl = await uploadToSupabase(req.supabase, audioBuffer, audioFilename, 'audio/mpeg')

      // Save voiceover_url
      await req.supabase.from('shorts').update({ voiceover_url: voiceoverUrl }).eq('id', shortId)

      // Step 3: Assemble video
      console.log(`[video] Assembling video for short ${shortId}`)
      const videoUrl = await assembleVideoCreatomate(short, voiceoverUrl)

      // Step 4: Save video_url and mark ready
      await req.supabase.from('shorts').update({
        video_url: videoUrl,
        voiceover_url: voiceoverUrl,
        status: 'ready'
      }).eq('id', shortId)

      console.log(`[video] Done! Short ${shortId} → ${videoUrl}`)
    } catch (err) {
      console.error(`[video] Pipeline failed for ${shortId}:`, err.message)
      await req.supabase.from('shorts').update({
        status: 'failed'
      }).eq('id', shortId)
    }
  })()
})

// GET /api/video/status/:shortId — poll for completion
router.get('/status/:shortId', requireAuth, async (req, res) => {
  const { data: short } = await req.supabase
    .from('shorts')
    .select('id, status, video_url, voiceover_url')
    .eq('id', req.params.shortId)
    .eq('user_id', req.user.id)
    .single()

  if (!short) return res.status(404).json({ error: 'Short not found' })
  res.json(short)
})

export default router
