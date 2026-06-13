/**
 * Video Generation Pipeline — FFmpeg based
 *
 * POST /api/video/generate/:shortId
 *   1. Generate voiceover via ElevenLabs
 *   2. Upload audio to Supabase Storage
 *   3. Assemble 1080x1920 MP4 via FFmpeg (text scenes + audio)
 *   4. Upload video to Supabase Storage
 *   5. Save video_url + voiceover_url, status → 'ready'
 */

import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import ffmpeg from 'fluent-ffmpeg'
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg'
import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'

ffmpeg.setFfmpegPath(ffmpegInstaller.path)

const router = Router()

// ── ElevenLabs voiceover ───────────────────────────────────────────────────

async function generateVoiceover(script, voiceId = 'TxGEqnHWrfWFTfGW9XjX') {
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

// ── Supabase Storage upload ────────────────────────────────────────────────

async function uploadToSupabase(supabase, buffer, filename, contentType) {
  const { error } = await supabase.storage
    .from('shorts-media')
    .upload(filename, buffer, { contentType, upsert: true })
  if (error) throw new Error(`Storage upload failed: ${error.message}`)
  const { data: { publicUrl } } = supabase.storage
    .from('shorts-media')
    .getPublicUrl(filename)
  return publicUrl
}

// ── Scene builder ──────────────────────────────────────────────────────────

function buildScenes(short) {
  const rawScript = short.script || short.hook || short.title || ''

  const lines = rawScript
    .split(/\n+/)
    .map(l => l.replace(/\[.*?\]/g, '').trim())
    .filter(l => l.length > 15)
    .map(l => l.length > 80 ? l.slice(0, 77) + '...' : l)
    .slice(0, 4)

  if (lines.length === 0) lines.push(short.hook || short.title || 'Watch this!')

  const allScenes = []
  if (short.hook && short.hook.length > 10) allScenes.push(short.hook.slice(0, 80))
  allScenes.push(...lines)
  if (short.cta) allScenes.push(short.cta.slice(0, 80))
  else allScenes.push('Follow for more! 🔥')

  const finalScenes = [...new Set(allScenes)].filter(Boolean).slice(0, 5)
  const minDuration = 8
  const sceneDuration = Math.max(55 / finalScenes.length, minDuration)

  return finalScenes.map((text, i) => ({
    time: i * sceneDuration,
    duration: sceneDuration,
    text,
    isHook: i === 0,
    isCta: i === finalScenes.length - 1,
    stepNum: i > 0 && i < finalScenes.length - 1 ? i : null
  }))
}

// ── FFmpeg video builder ───────────────────────────────────────────────────

function escapeFFmpegText(text) {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/:/g, '\\:')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
    .replace(/\n/g, ' ')
}

function wrapText(text, maxChars = 28) {
  const words = text.split(' ')
  const lines = []
  let current = ''
  for (const word of words) {
    if ((current + ' ' + word).trim().length > maxChars) {
      if (current) lines.push(current.trim())
      current = word
    } else {
      current = (current + ' ' + word).trim()
    }
  }
  if (current) lines.push(current.trim())
  return lines.join('\n')
}

async function buildVideoFFmpeg(short, audioPath, outputPath) {
  const scenes = buildScenes(short)
  const totalDuration = scenes[scenes.length - 1].time + scenes[scenes.length - 1].duration + 1
  const W = 1080
  const H = 1920
  const title = escapeFFmpegText((short.title || short.topic || '').toUpperCase())

  // Build drawtext filters for all scenes
  const filters = []

  // Dark gradient background (using solid color, FFmpeg doesn't do gradients natively)
  // We use lavfi color source

  // Title — always visible
  filters.push(
    `drawtext=text='${title}':` +
    `fontsize=52:fontcolor=white:fontweight=bold:` +
    `x=(w-text_w)/2:y=120:` +
    `enable='between(t,0,${totalDuration})'`
  )

  // Red accent line under title
  filters.push(
    `drawbox=x=(w-200)/2:y=200:w=200:h=6:color=0xFF3B3B:t=fill:` +
    `enable='between(t,0,${totalDuration})'`
  )

  // Each scene
  scenes.forEach((scene, i) => {
    const t0 = scene.time.toFixed(2)
    const t1 = (scene.time + scene.duration - 0.3).toFixed(2)
    const wrapped = wrapText(scene.text, 26)
    const escapedText = escapeFFmpegText(wrapped)

    // Card background box
    const cardY = H * 0.38
    const cardH = 280
    filters.push(
      `drawbox=x=60:y=${cardY}:w=${W - 120}:h=${cardH}:` +
      `color=${scene.isHook ? '0xFF3B3B@0.2' : '0xFFFFFF@0.08'}:t=fill:` +
      `enable='between(t,${t0},${t1})'`
    )

    // Step number (for middle scenes only)
    if (scene.stepNum !== null) {
      filters.push(
        `drawtext=text='${scene.stepNum}':` +
        `fontsize=100:fontcolor=0xFF3B3B:fontweight=bold:` +
        `x=100:y=${cardY + 80}:` +
        `enable='between(t,${t0},${t1})'`
      )
    }

    // Scene text
    const textX = scene.stepNum !== null ? 220 : `(w-text_w)/2`
    filters.push(
      `drawtext=text='${escapedText}':` +
      `fontsize=${scene.isHook ? 58 : 52}:fontcolor=white:fontweight=${scene.isHook ? 'bold' : 'normal'}:` +
      `x=${textX}:y=${cardY + 50}:line_spacing=12:` +
      `enable='between(t,${t0},${t1})'`
    )
  })

  // CTA bar at bottom (last 6 seconds)
  const ctaStart = (totalDuration - 6).toFixed(2)
  filters.push(
    `drawbox=x=0:y=${H - 180}:w=${W}:h=180:color=0xFF3B3B:t=fill:` +
    `enable='between(t,${ctaStart},${totalDuration})'`
  )
  filters.push(
    `drawtext=text='${escapeFFmpegText(short.cta || 'Follow for more!')}':` +
    `fontsize=52:fontcolor=white:fontweight=bold:` +
    `x=(w-text_w)/2:y=${H - 110}:` +
    `enable='between(t,${ctaStart},${totalDuration})'`
  )

  const vf = filters.join(',')

  return new Promise((resolve, reject) => {
    const cmd = ffmpeg()
      // Background: solid dark color
      .input(`color=c=0x0D0D1A:size=${W}x${H}:rate=30:duration=${totalDuration}`)
      .inputFormat('lavfi')

    // Add audio if available
    if (audioPath) {
      cmd.input(audioPath)
    }

    cmd
      .videoFilter(vf)
      .outputOptions([
        '-c:v libx264',
        '-preset fast',
        '-crf 18',          // high quality (0=lossless, 51=worst)
        '-pix_fmt yuv420p',
        '-movflags +faststart',
        ...(audioPath ? ['-c:a aac', '-b:a 192k', '-shortest'] : []),
      ])
      .output(outputPath)
      .on('start', cmd => console.log('[ffmpeg] started:', cmd.slice(0, 120)))
      .on('progress', p => console.log(`[ffmpeg] progress: ${Math.round(p.percent || 0)}%`))
      .on('end', () => { console.log('[ffmpeg] done'); resolve() })
      .on('error', (err) => { console.error('[ffmpeg] error:', err.message); reject(err) })
      .run()
  })
}

// ── Route ──────────────────────────────────────────────────────────────────

router.post('/generate/:shortId', requireAuth, async (req, res) => {
  const { shortId } = req.params
  const { voice_id } = req.body

  const { data: short, error } = await req.supabase
    .from('shorts')
    .select('*')
    .eq('id', shortId)
    .eq('user_id', req.user.id)
    .single()

  if (error || !short) return res.status(404).json({ error: 'Short not found' })

  await req.supabase.from('shorts').update({ status: 'generating' }).eq('id', shortId)

  res.json({ message: 'Video generation started', short_id: shortId, status: 'generating' })

  ;(async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'shortflow-'))
    const audioPath = path.join(tmpDir, 'voiceover.mp3')
    const videoPath = path.join(tmpDir, 'output.mp4')

    try {
      // Step 1: Voiceover
      let voiceoverUrl = null
      let localAudioPath = null

      if (process.env.ELEVENLABS_API_KEY) {
        try {
          console.log(`[video] Generating voiceover for ${shortId}`)
          const scriptText = short.script || short.hook || short.title
          const audioBuffer = await generateVoiceover(scriptText, voice_id)
          await fs.writeFile(audioPath, audioBuffer)
          localAudioPath = audioPath

          // Upload to Supabase
          voiceoverUrl = await uploadToSupabase(
            req.supabase, audioBuffer,
            `${req.user.id}/${shortId}/voiceover.mp3`, 'audio/mpeg'
          )
          await req.supabase.from('shorts').update({ voiceover_url: voiceoverUrl }).eq('id', shortId)
          console.log(`[video] Voiceover ready: ${voiceoverUrl}`)
        } catch (err) {
          console.warn(`[video] Voiceover skipped: ${err.message}`)
        }
      }

      // Step 2: Build video with FFmpeg
      console.log(`[video] Building 1080x1920 video for ${shortId}`)
      await buildVideoFFmpeg(short, localAudioPath, videoPath)

      // Step 3: Upload video to Supabase Storage
      console.log(`[video] Uploading video for ${shortId}`)
      const videoBuffer = await fs.readFile(videoPath)
      const videoUrl = await uploadToSupabase(
        req.supabase, videoBuffer,
        `${req.user.id}/${shortId}/video.mp4`, 'video/mp4'
      )

      // Step 4: Save and mark ready
      await req.supabase.from('shorts').update({
        video_url: videoUrl,
        ...(voiceoverUrl ? { voiceover_url: voiceoverUrl } : {}),
        status: 'ready'
      }).eq('id', shortId)

      console.log(`[video] Done! ${shortId} → ${videoUrl}`)
    } catch (err) {
      console.error(`[video] Pipeline failed for ${shortId}:`, err.message)
      await req.supabase.from('shorts').update({ status: 'failed' }).eq('id', shortId)
    } finally {
      // Cleanup temp files
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
    }
  })()
})

// GET /api/video/status/:shortId
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
