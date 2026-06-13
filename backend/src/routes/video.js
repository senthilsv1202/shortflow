/**
 * Video Generation Pipeline — Canvas + FFmpeg
 *
 * For each scene, generates a PNG frame using canvas (no system fonts needed),
 * then uses FFmpeg to combine frames + audio into a 1080x1920 MP4.
 */

import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import ffmpeg from 'fluent-ffmpeg'
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg'
import { createCanvas } from '@napi-rs/canvas'
import { promises as fs } from 'fs'
import { execSync } from 'child_process'
import path from 'path'
import os from 'os'

ffmpeg.setFfmpegPath(ffmpegInstaller.path)

const router = Router()
const W = 1080
const H = 1920

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

// ── Supabase Storage ───────────────────────────────────────────────────────

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
  const sceneDuration = Math.max(55 / finalScenes.length, 8)

  return finalScenes.map((text, i) => ({
    time: i * sceneDuration,
    duration: sceneDuration,
    text,
    isHook: i === 0,
    isCta: i === finalScenes.length - 1,
    stepNum: i > 0 && i < finalScenes.length - 1 ? i : null
  }))
}

// ── Canvas frame generator ─────────────────────────────────────────────────

function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ')
  const lines = []
  let line = ''
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = word
    } else {
      line = test
    }
  }
  if (line) lines.push(line)
  return lines
}

function drawScene(scene, title, index) {
  const canvas = createCanvas(W, H)
  const ctx = canvas.getContext('2d')

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, 0, H)
  grad.addColorStop(0, '#1A0A2E')
  grad.addColorStop(0.5, '#0D0D1A')
  grad.addColorStop(1, '#0A0A0F')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, H)

  // Red accent bar at top
  ctx.fillStyle = '#FF3B3B'
  ctx.fillRect(W / 2 - 100, 90, 200, 8)

  // Title at top
  ctx.fillStyle = '#FFFFFF'
  ctx.font = 'bold 52px sans-serif'
  ctx.textAlign = 'center'
  const titleLines = wrapText(ctx, title.toUpperCase(), W - 120)
  titleLines.slice(0, 2).forEach((line, i) => {
    ctx.fillText(line, W / 2, 160 + i * 65)
  })

  // Scene card
  const cardY = Math.round(H * 0.36)
  const cardH = 380
  const cardPad = 60

  // Card background
  ctx.fillStyle = scene.isHook ? 'rgba(255,59,59,0.18)' : 'rgba(255,255,255,0.07)'
  roundRect(ctx, cardPad, cardY, W - cardPad * 2, cardH, 24)
  ctx.fill()

  // Card border
  ctx.strokeStyle = scene.isHook ? '#FF3B3B' : 'rgba(255,255,255,0.15)'
  ctx.lineWidth = 2
  roundRect(ctx, cardPad, cardY, W - cardPad * 2, cardH, 24)
  ctx.stroke()

  // Step number
  if (scene.stepNum !== null) {
    ctx.fillStyle = '#FF3B3B'
    ctx.font = 'bold 120px sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText(`${scene.stepNum}`, cardPad + 40, cardY + 140)
  }

  // Scene text
  const textSize = scene.isHook ? 58 : 52
  ctx.font = `${scene.isHook ? 'bold' : 'normal'} ${textSize}px sans-serif`
  ctx.fillStyle = '#FFFFFF'
  ctx.textAlign = scene.stepNum !== null ? 'left' : 'center'
  const textX = scene.stepNum !== null ? cardPad + 200 : W / 2
  const textMaxW = scene.stepNum !== null ? W - cardPad * 2 - 200 : W - cardPad * 2 - 40
  const textLines = wrapText(ctx, scene.text, textMaxW)
  const lineH = textSize + 14
  const totalTextH = textLines.length * lineH
  const textStartY = cardY + (cardH - totalTextH) / 2 + textSize / 2
  textLines.forEach((line, i) => {
    ctx.fillText(line, textX, textStartY + i * lineH)
  })

  // CTA bar at bottom
  if (scene.isCta) {
    ctx.fillStyle = '#FF3B3B'
    ctx.fillRect(0, H - 180, W, 180)
    ctx.fillStyle = '#FFFFFF'
    ctx.font = 'bold 52px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(scene.text, W / 2, H - 95)
  }

  // Scene indicator dots at bottom
  return canvas.toBuffer('image/png')
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

// ── FFmpeg video assembler ─────────────────────────────────────────────────

async function buildVideo(scenes, title, audioPath, outputPath, tmpDir) {
  const FPS = 30

  // Generate PNG for each scene
  const framePaths = []
  for (let i = 0; i < scenes.length; i++) {
    const png = drawScene(scenes[i], title, i)
    const framePath = path.join(tmpDir, `scene_${i}.png`)
    await fs.writeFile(framePath, png)
    framePaths.push({ path: framePath, duration: scenes[i].duration })
  }

  // Write concat file for FFmpeg
  const concatFile = path.join(tmpDir, 'concat.txt')
  const concatContent = framePaths.map(f =>
    `file '${f.path}'\nduration ${f.duration}`
  ).join('\n') + `\nfile '${framePaths[framePaths.length-1].path}'`
  await fs.writeFile(concatFile, concatContent)

  return new Promise((resolve, reject) => {
    const cmd = ffmpeg()
      .input(concatFile)
      .inputOptions(['-f concat', '-safe 0'])

    if (audioPath) cmd.input(audioPath)

    cmd
      .outputOptions([
        '-c:v libx264',
        '-preset fast',
        '-crf 18',
        '-pix_fmt yuv420p',
        '-r 30',
        '-movflags +faststart',
        ...(audioPath ? ['-c:a aac', '-b:a 192k', '-shortest'] : []),
      ])
      .output(outputPath)
      .on('start', c => console.log('[ffmpeg] started:', c.slice(0, 100)))
      .on('progress', p => console.log(`[ffmpeg] ${Math.round(p.percent || 0)}%`))
      .on('end', () => { console.log('[ffmpeg] done'); resolve() })
      .on('error', (err, stdout, stderr) => {
        console.error('[ffmpeg] error:', err.message)
        console.error('[ffmpeg] stderr:', stderr?.slice(-500))
        reject(err)
      })
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
          voiceoverUrl = await uploadToSupabase(
            req.supabase, audioBuffer,
            `${req.user.id}/${shortId}/voiceover.mp3`, 'audio/mpeg'
          )
          await req.supabase.from('shorts').update({ voiceover_url: voiceoverUrl }).eq('id', shortId)
          console.log(`[video] Voiceover ready`)
        } catch (err) {
          console.warn(`[video] Voiceover skipped: ${err.message}`)
        }
      }

      // Step 2: Build video frames + assemble
      console.log(`[video] Building 1080x1920 video for ${shortId}`)
      const scenes = buildScenes(short)
      const title = short.title || short.topic || ''
      await buildVideo(scenes, title, localAudioPath, videoPath, tmpDir)

      // Step 3: Upload video
      console.log(`[video] Uploading video`)
      const videoBuffer = await fs.readFile(videoPath)
      const videoUrl = await uploadToSupabase(
        req.supabase, videoBuffer,
        `${req.user.id}/${shortId}/video.mp4`, 'video/mp4'
      )

      await req.supabase.from('shorts').update({
        video_url: videoUrl,
        ...(voiceoverUrl ? { voiceover_url: voiceoverUrl } : {}),
        status: 'ready'
      }).eq('id', shortId)

      console.log(`[video] Done! ${shortId}`)
    } catch (err) {
      console.error(`[video] Pipeline failed for ${shortId}:`, err.message)
      await req.supabase.from('shorts').update({ status: 'failed' }).eq('id', shortId)
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
    }
  })()
})

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
