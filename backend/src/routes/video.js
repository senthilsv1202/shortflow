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
import { createCanvas, GlobalFonts } from '@napi-rs/canvas'
import { promises as fs } from 'fs'
import { execSync } from 'child_process'
import path from 'path'
import os from 'os'

ffmpeg.setFfmpegPath(ffmpegInstaller.path)

const router = Router()
const W = 1080
const H = 1920
const FONT_NAME = 'ShortFlowFont'
let fontLoaded = false

async function ensureFont() {
  if (fontLoaded) return
  const fontFile = '/tmp/shortflow-font.ttf'
  // Check if already downloaded
  try {
    await fs.access(fontFile)
    GlobalFonts.registerFromPath(fontFile, FONT_NAME)
    fontLoaded = true
    console.log('[video] Font registered from cache')
    return
  } catch {}
  // Download font
  const urls = [
    'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiJ-Ek-_EeA.woff2',
    'https://raw.githubusercontent.com/rsms/inter/master/docs/font-files/Inter-Regular.ttf',
    'https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxK.woff2',
  ]
  for (const url of urls) {
    try {
      console.log('[video] Downloading font from', url)
      const res = await fetch(url)
      if (!res.ok) continue
      const buf = Buffer.from(await res.arrayBuffer())
      if (buf.length < 5000) continue
      await fs.writeFile(fontFile, buf)
      GlobalFonts.registerFromPath(fontFile, FONT_NAME)
      fontLoaded = true
      console.log('[video] Font downloaded and registered:', buf.length, 'bytes')
      return
    } catch(e) { console.warn('[video] Font URL failed:', e.message) }
  }
  console.warn('[video] Could not load font — text may be invisible')
}

// Pre-load font on startup
ensureFont().catch(() => {})

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
  const scenes = []

  // ── Scene 1: Hook ──
  const hook = short.hook || short.title || 'Watch this!'
  scenes.push({ text: hook.slice(0, 90), isHook: true, isCta: false, stepNum: null })

  // ── Scenes 2+: Extract numbered tips/steps from script ──
  // Match patterns like: "Number one —", "1.", "1)", "Tip 1:", "Step 1:", "First —"
  const tipPatterns = [
    /(?:Number\s+(?:one|two|three|four|five|six|seven|eight|nine|ten))\s*[—–\-:.]?\s*(.*?)(?=(?:Number\s+(?:one|two|three|four|five|six|seven|eight|nine|ten))|$)/gi,
    /(?:^|\n)\s*(\d+)\s*[.):\-—–]\s*(.*?)(?=(?:\n\s*\d+\s*[.):\-—–])|$)/gs,
    /(?:^|\n)\s*(?:Step|Tip|Trick|Point|Rule)\s*(\d+)\s*[.:—–\-]?\s*(.*?)(?=(?:Step|Tip|Trick|Point|Rule)\s*\d+|$)/gi,
  ]

  let tips = []

  // Try "Number one" pattern first
  const numberWords = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 }
  const numWordPattern = 'one|two|three|four|five|six|seven|eight|nine|ten'
  const wordMatches = [...rawScript.matchAll(new RegExp(
    `Number\\s+(${numWordPattern})\\s*[—–\\-:.]?\\s*(.*?)(?=Number\\s+(?:${numWordPattern})|If you|These aren|These are|Drop a|Follow for|$)`, 'gi'
  ))]
  if (wordMatches.length >= 2) {
    tips = wordMatches.map(m => ({
      num: numberWords[m[1].toLowerCase()] || 0,
      text: m[2].replace(/\.\s*$/, '').trim()
    }))
  }

  // Try "1." or "1)" pattern
  if (tips.length < 2) {
    const digitMatches = [...rawScript.matchAll(/(\d+)\s*[.):\-—–]\s*(.*?)(?=\d+\s*[.):\-—–]|If you|These|Drop|Follow|$)/gs)]
    if (digitMatches.length >= 2) {
      tips = digitMatches.map(m => ({
        num: parseInt(m[1]),
        text: m[2].replace(/\.\s*$/, '').trim()
      }))
    }
  }

  // Try key_points from Claude's structured output
  if (tips.length < 2 && short.key_points && short.key_points.length >= 2) {
    tips = short.key_points
      .filter(p => p && p.trim().length > 5)
      .map((p, i) => ({ num: i + 1, text: p.trim() }))
  }

  // Fallback: split by sentences and take the meatiest ones
  if (tips.length < 2) {
    const sentences = rawScript
      .replace(/\[.*?\]/g, '')
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 20 && s.length < 120)
      .slice(1, 5) // skip first (usually the hook)
    tips = sentences.map((s, i) => ({ num: i + 1, text: s }))
  }

  // Add ALL tip scenes (up to 10)
  console.log(`[video] Parsed ${tips.length} tips from script`)
  tips.slice(0, 10).forEach(tip => {
    let text = tip.text.trim()
    // Remove trailing incomplete sentences
    if (text.length > 200) text = text.slice(0, 200)
    // Keep it clean but don't over-truncate
    if (text.length > 10) {
      console.log(`[video]   Tip ${tip.num}: ${text.slice(0, 60)}...`)
      scenes.push({ text, isHook: false, isCta: false, stepNum: tip.num })
    }
  })

  // ── Last scene: CTA ──
  const cta = short.cta || 'Follow for more tips!'
  scenes.push({ text: cta.slice(0, 120), isHook: false, isCta: true, stepNum: null })

  console.log(`[video] Total scenes: ${scenes.length} (1 hook + ${scenes.length - 2} steps + 1 CTA)`)

  // Calculate timing — scale to fit all steps
  const hookDur = 4
  const ctaDur = 5
  const stepCount = scenes.length - 2
  const stepDur = Math.max(7, Math.min(10, 50 / stepCount)) // 7-10s per step
  const totalDuration = hookDur + (stepCount * stepDur) + ctaDur

  let time = 0
  return scenes.map((scene, i) => {
    const dur = scene.isHook ? hookDur : scene.isCta ? ctaDur : stepDur
    const s = { ...scene, time, duration: dur }
    time += dur
    return s
  })
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

// Color palettes per scene for visual variety
// ── Accent colors that cycle per step ──
const STEP_ACCENTS = ['#FF3B3B', '#00D4FF', '#00F5A0', '#C084FC', '#FBD38D', '#FF6B6B', '#38BDF8']

function drawScene(scene, title, index, totalScenes) {
  const canvas = createCanvas(W, H)
  const ctx = canvas.getContext('2d')
  const font = `"${FONT_NAME}", sans-serif`
  const accent = scene.isCta ? '#FF3B3B' : STEP_ACCENTS[index % STEP_ACCENTS.length]

  // ── Same consistent background for all scenes ──
  const bg = ctx.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, '#0f0f1a')
  bg.addColorStop(0.5, '#141428')
  bg.addColorStop(1, '#0a0a14')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  // Subtle radial glow behind center content
  const glow = ctx.createRadialGradient(W / 2, H * 0.45, 0, W / 2, H * 0.45, 500)
  glow.addColorStop(0, accent + '18')
  glow.addColorStop(1, 'transparent')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)

  // ── Progress dots at top ──
  const dotY = 80
  const dotR = 8
  const dotGap = 28
  const totalDotsW = totalScenes * dotGap
  const dotStartX = (W - totalDotsW) / 2 + dotR
  for (let i = 0; i < totalScenes; i++) {
    ctx.beginPath()
    ctx.arc(dotStartX + i * dotGap, dotY, dotR, 0, Math.PI * 2)
    ctx.fillStyle = i === index ? accent : 'rgba(255,255,255,0.15)'
    ctx.fill()
  }

  // ── Title always at top (smaller, muted) ──
  ctx.font = `bold 36px ${font}`
  ctx.fillStyle = 'rgba(255,255,255,0.4)'
  ctx.textAlign = 'center'
  const shortTitle = title.length > 40 ? title.slice(0, 37) + '...' : title
  ctx.fillText(shortTitle, W / 2, 160)

  // ── Thin accent line under title ──
  ctx.fillStyle = accent
  ctx.fillRect(W / 2 - 40, 180, 80, 3)

  if (scene.isCta) {
    // ── CTA: Big centered text + subscribe prompt ──
    ctx.font = `bold 68px ${font}`
    ctx.fillStyle = '#FFFFFF'
    ctx.textAlign = 'center'
    const ctaLines = wrapText(ctx, scene.text, W - 140)
    const ctaH = ctaLines.length * 85
    const ctaY = (H - ctaH) / 2 + 40
    ctaLines.forEach((line, i) => {
      ctx.fillText(line, W / 2, ctaY + i * 85)
    })

    // Subscribe button shape
    const btnY = ctaY + ctaH + 50
    roundRect(ctx, W / 2 - 180, btnY, 360, 70, 35)
    ctx.fillStyle = '#FF3B3B'
    ctx.fill()
    ctx.font = `bold 32px ${font}`
    ctx.fillStyle = '#FFFFFF'
    ctx.textAlign = 'center'
    ctx.fillText('SUBSCRIBE', W / 2, btnY + 46)

  } else if (scene.isHook) {
    // ── Hook: Large white text, vertically centered ──
    const pad = 80
    ctx.font = `bold 58px ${font}`
    ctx.fillStyle = '#FFFFFF'
    ctx.textAlign = 'center'
    const hookLines = wrapText(ctx, scene.text, W - pad * 2)
    const lineH = 76
    const totalH = hookLines.length * lineH
    const startY = (H - totalH) / 2
    hookLines.slice(0, 6).forEach((line, i) => {
      ctx.fillText(line, W / 2, startY + i * lineH)
    })

    // Accent line below hook text
    ctx.fillStyle = accent
    ctx.fillRect(W / 2 - 50, startY + Math.min(hookLines.length, 6) * lineH + 15, 100, 5)

  } else {
    // ── Step: Number on left + text fills the space ──
    const pad = 80

    // Step label at top of content area
    ctx.font = `bold 28px ${font}`
    ctx.fillStyle = accent
    ctx.textAlign = 'left'
    ctx.fillText(`STEP ${scene.stepNum}`, pad, 280)

    // Big accent number
    ctx.font = `bold 160px ${font}`
    ctx.fillStyle = accent + '25'  // ghost number in background
    ctx.textAlign = 'right'
    ctx.fillText(`${scene.stepNum}`, W - 40, 420)

    // Accent line under step label
    ctx.fillStyle = accent
    ctx.fillRect(pad, 295, 60, 4)

    // Step text — large, left-aligned, wraps naturally
    ctx.font = `bold 48px ${font}`
    ctx.fillStyle = '#FFFFFF'
    ctx.textAlign = 'left'
    const stepLines = wrapText(ctx, scene.text, W - pad * 2)
    const stepLineH = 64
    const stepStartY = 380
    stepLines.slice(0, 8).forEach((line, i) => {
      ctx.fillText(line, pad, stepStartY + i * stepLineH)
    })
  }

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
    const png = drawScene(scenes[i], title, i, scenes.length)
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
      await ensureFont()
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
