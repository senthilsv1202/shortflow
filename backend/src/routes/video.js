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
      model_id: 'eleven_turbo_v2',
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

function buildScenes(short) {
  const scenes = []

  // Scene 1: Hook
  if (short.hook) scenes.push(short.hook.slice(0, 100))

  // Scenes 2-4: Key points (cleanest content from Claude)
  if (short.key_points && short.key_points.length > 0) {
    short.key_points
      .filter(p => p && p.trim().length > 5)
      .slice(0, 3)
      .forEach(p => scenes.push(p.slice(0, 100)))
  } else {
    // Fallback: parse script lines, skip markers and numbered items
    const rawScript = short.script || ''
    const lines = rawScript
      .split(/\n+/)
      .map(l => l
        .replace(/\[.*?\]/g, '')   // remove [HOOK] etc
        .replace(/^\d+\.\s*/, '')  // remove "1. "
        .replace(/^[-•*]\s*/, '')  // remove bullet points
        .trim()
      )
      .filter(l => l.length > 20 && l.length < 120)
      .slice(0, 3)
    scenes.push(...lines)
  }

  // Scene 5: CTA
  if (short.cta) scenes.push(short.cta.slice(0, 100))
  else scenes.push('Follow for more! 🔥')

  // Deduplicate and limit
  const finalScenes = [...new Set(scenes)].filter(Boolean).slice(0, 5)
  if (finalScenes.length === 0) finalScenes.push(short.title || 'Watch this!')

  const totalDuration = 55
  const minSceneDuration = 8 // minimum 8 seconds per scene so text is readable
  const sceneDuration = Math.max(totalDuration / finalScenes.length, minSceneDuration)

  return finalScenes.map((text, i) => ({
    time: i * sceneDuration,
    duration: sceneDuration,
    text
  }))
}

async function assembleVideoCreatomate(short, audioUrl) {
  const apiKey = process.env.CREATOMATE_API_KEY
  if (!apiKey) throw new Error('CREATOMATE_API_KEY not set')

  const scenes = buildScenes(short)
  const duration = Math.max(scenes[scenes.length-1].time + scenes[scenes.length-1].duration + 6, 30)

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
        frame_rate: 30,
        duration,
        fill_color: '#0D0D1A',
        elements: [
          // Gradient background — top
          {
            type: 'shape',
            shape: 'rect',
            width: '100%',
            height: '55%',
            fill_color: [
              { position: '0%', value: '#1A0A2E' },
              { position: '100%', value: '#0D0D1A' }
            ],
            x: '50%',
            y: '0%',
            x_alignment: '50%',
            y_alignment: '0%',
            gradient_direction: '180°',
          },
          // Red accent bar at top
          {
            type: 'shape',
            shape: 'rect',
            width: '15%',
            height: '0.6%',
            fill_color: '#FF3B3B',
            x: '50%',
            y: '6%',
            x_alignment: '50%',
            y_alignment: '50%',
            time: 0,
            duration,
          },
          // Title — always visible at top
          {
            type: 'text',
            text: (short.title || short.topic || '').toUpperCase(),
            font_family: 'Montserrat',
            font_weight: '900',
            font_size: '6.5 vmin',
            fill_color: '#FFFFFF',
            width: '85%',
            x: '50%',
            y: '10%',
            x_alignment: '50%',
            y_alignment: '50%',
            time: 0,
            duration,
            animations: [{ time: 'start', duration: 0.6, type: 'fade' }]
          },
          // Scene card background + text for each scene
          ...scenes.flatMap((scene, i) => [
            // Card background behind text
            {
              type: 'shape',
              shape: 'rect',
              width: '88%',
              height: '22%',
              fill_color: i === 0 ? 'rgba(255,59,59,0.15)' : 'rgba(255,255,255,0.07)',
              border_radius: '20px',
              x: '50%',
              y: '48%',
              x_alignment: '50%',
              y_alignment: '50%',
              time: scene.time,
              duration: scene.duration - 0.3,
              animations: [
                { time: 'start', duration: 0.4, easing: 'quadratic-out', type: 'scale', start_scale: '80%' },
                { time: 'end', duration: 0.3, type: 'fade' }
              ]
            },
            // Step number (for key points, not hook/cta)
            ...(i > 0 && i < scenes.length - 1 ? [{
              type: 'text',
              text: `${i}`,
              font_family: 'Montserrat',
              font_weight: '900',
              font_size: '9 vmin',
              fill_color: '#FF3B3B',
              x: '12%',
              y: '37%',
              x_alignment: '50%',
              y_alignment: '50%',
              time: scene.time,
              duration: scene.duration - 0.3,
              animations: [
                { time: 'start', duration: 0.4, type: 'fade' },
                { time: 'end', duration: 0.3, type: 'fade' }
              ]
            }] : []),
            // Scene text
            {
              type: 'text',
              text: scene.text,
              font_family: 'Montserrat',
              font_weight: i === 0 ? '700' : '600',
              font_size: i === 0 ? '7.5 vmin' : '6 vmin',
              fill_color: '#FFFFFF',
              width: i > 0 && i < scenes.length - 1 ? '68%' : '80%',
              x: i > 0 && i < scenes.length - 1 ? '57%' : '50%',
              y: '48%',
              x_alignment: '50%',
              y_alignment: '50%',
              time: scene.time,
              duration: scene.duration - 0.3,
              animations: [
                { time: 'start', duration: 0.4, easing: 'quadratic-out', type: 'slide', direction: '270°' },
                { time: 'end', duration: 0.3, type: 'fade' }
              ]
            },
          ]),
          // Bottom CTA bar
          {
            type: 'shape',
            shape: 'rect',
            width: '100%',
            height: '12%',
            fill_color: '#FF3B3B',
            x: '50%',
            y: '100%',
            x_alignment: '50%',
            y_alignment: '100%',
            time: duration - 6,
            duration: 6,
            animations: [{ time: 'start', duration: 0.5, type: 'slide', direction: '90°' }]
          },
          {
            type: 'text',
            text: short.cta || 'Follow for more! 🔥',
            font_family: 'Montserrat',
            font_weight: '800',
            font_size: '6 vmin',
            fill_color: '#FFFFFF',
            width: '85%',
            x: '50%',
            y: '94%',
            x_alignment: '50%',
            y_alignment: '50%',
            time: duration - 6,
            duration: 6,
            animations: [{ time: 'start', duration: 0.5, type: 'fade' }]
          },
          // Audio track
          ...(audioUrl ? [{
            type: 'audio',
            source: audioUrl,
            time: 0,
          }] : []),
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
      // Step 1: Generate voiceover (optional — skip if no API key)
      let voiceoverUrl = null
      if (process.env.ELEVENLABS_API_KEY) {
        try {
          console.log(`[video] Generating voiceover for short ${shortId}`)
          const scriptText = short.script || short.hook || short.title
          const audioBuffer = await generateVoiceover(scriptText, voice_id)
          const audioFilename = `${req.user.id}/${shortId}/voiceover.mp3`
          voiceoverUrl = await uploadToSupabase(req.supabase, audioBuffer, audioFilename, 'audio/mpeg')
          await req.supabase.from('shorts').update({ voiceover_url: voiceoverUrl }).eq('id', shortId)
        } catch(err) {
          console.warn(`[video] Voiceover skipped: ${err.message}`)
        }
      }

      // Step 2: Assemble video
      console.log(`[video] Assembling video for short ${shortId}`)
      const videoUrl = await assembleVideoCreatomate(short, voiceoverUrl)

      // Step 3: Save video_url and mark ready
      await req.supabase.from('shorts').update({
        video_url: videoUrl,
        ...(voiceoverUrl ? { voiceover_url: voiceoverUrl } : {}),
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
