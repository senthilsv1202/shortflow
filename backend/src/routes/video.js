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
  const numberWords = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7 }
  const wordMatches = [...rawScript.matchAll(/Number\s+(one|two|three|four|five|six|seven)\s*[—–\-:.]?\s*(.*?)(?=Number\s+(?:one|two|three|four|five|six|seven)|If you|These|Drop|Follow|$)/gi)]
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

  // Add tip scenes (max 5 tips)
  tips.slice(0, 5).forEach(tip => {
    // Clean up the text — take first 1-2 sentences, max 80 chars
    let text = tip.text
      .split(/[.!?]/)
      .filter(s => s.trim().length > 5)
      .slice(0, 2)
      .join('. ')
      .trim()
    if (text.length > 80) text = text.slice(0, 77) + '...'
    if (text.length > 10) {
      scenes.push({ text, isHook: false, isCta: false, stepNum: tip.num })
    }
  })

  // ── Last scene: CTA ──
  const cta = short.cta || 'Follow for more tips!'
  scenes.push({ text: cta.slice(0, 80), isHook: false, isCta: true, stepNum: null })

  // Calculate timing — more time for steps, less for hook/CTA
  const totalDuration = 58
  const hookDur = 5
  const ctaDur = 5
  const stepCount = scenes.length - 2
  const stepDur = stepCount > 0 ? Math.max((totalDuration - hookDur - ctaDur) / stepCount, 6) : 10

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
const SCENE_PALETTES = [
  { bg1: '#0F0C29', bg2: '#302B63', bg3: '#24243E', accent: '#FF3B3B' }, // Hook — deep purple
  { bg1: '#000428', bg2: '#004E92', bg3: '#001F3F', accent: '#00D4FF' }, // Step 1 — ocean blue
  { bg1: '#0F2027', bg2: '#203A43', bg3: '#2C5364', accent: '#00F5A0' }, // Step 2 — teal green
  { bg1: '#1A0033', bg2: '#4A0072', bg3: '#2D004F', accent: '#C084FC' }, // Step 3 — purple
  { bg1: '#0C1220', bg2: '#1E3A5F', bg3: '#0A1628', accent: '#FBD38D' }, // Step 4 — gold/navy
  { bg1: '#200122', bg2: '#6F0000', bg3: '#3D0000', accent: '#FF6B6B' }, // Step 5 — deep red
  { bg1: '#FF3B3B', bg2: '#FF6B6B', bg3: '#CC0000', accent: '#FFFFFF' }, // CTA — solid red
]

function drawScene(scene, title, index, totalScenes) {
  const canvas = createCanvas(W, H)
  const ctx = canvas.getContext('2d')
  // CTA always gets the last palette (red), other scenes cycle through
  const palette = scene.isCta
    ? SCENE_PALETTES[SCENE_PALETTES.length - 1]
    : SCENE_PALETTES[Math.min(index, SCENE_PALETTES.length - 2)]
  const font = `"${FONT_NAME}", sans-serif`

  // ── Background: rich gradient ──
  const bgGrad = ctx.createLinearGradient(0, 0, W * 0.5, H)
  bgGrad.addColorStop(0, palette.bg1)
  bgGrad.addColorStop(0.5, palette.bg2)
  bgGrad.addColorStop(1, palette.bg3)
  ctx.fillStyle = bgGrad
  ctx.fillRect(0, 0, W, H)

  // ── Decorative glow circle (top-right) ──
  const glowGrad = ctx.createRadialGradient(W * 0.85, H * 0.12, 0, W * 0.85, H * 0.12, 350)
  glowGrad.addColorStop(0, palette.accent + '30')
  glowGrad.addColorStop(1, 'transparent')
  ctx.fillStyle = glowGrad
  ctx.fillRect(0, 0, W, H)

  // ── Decorative glow circle (bottom-left) ──
  const glow2 = ctx.createRadialGradient(W * 0.15, H * 0.88, 0, W * 0.15, H * 0.88, 300)
  glow2.addColorStop(0, palette.accent + '20')
  glow2.addColorStop(1, 'transparent')
  ctx.fillStyle = glow2
  ctx.fillRect(0, 0, W, H)

  // ── Scene progress bar at very top ──
  const barY = 60
  const barW = W - 160
  const barX = 80
  ctx.fillStyle = 'rgba(255,255,255,0.1)'
  roundRect(ctx, barX, barY, barW, 8, 4)
  ctx.fill()
  const progress = (index + 1) / totalScenes
  ctx.fillStyle = palette.accent
  roundRect(ctx, barX, barY, barW * progress, 8, 4)
  ctx.fill()

  // ── Scene counter (01 / 05) ──
  ctx.font = `bold 28px ${font}`
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.textAlign = 'right'
  ctx.fillText(`${String(index + 1).padStart(2, '0')} / ${String(totalScenes).padStart(2, '0')}`, W - 80, barY + 55)

  if (scene.isCta) {
    // ── CTA scene — big bold centered ──
    // Large accent circle behind text
    const ctaGlow = ctx.createRadialGradient(W / 2, H * 0.45, 0, W / 2, H * 0.45, 400)
    ctaGlow.addColorStop(0, 'rgba(255,255,255,0.15)')
    ctaGlow.addColorStop(1, 'transparent')
    ctx.fillStyle = ctaGlow
    ctx.fillRect(0, 0, W, H)

    ctx.font = `bold 72px ${font}`
    ctx.fillStyle = '#FFFFFF'
    ctx.textAlign = 'center'
    const ctaLines = wrapText(ctx, scene.text, W - 160)
    const ctaStartY = H * 0.4
    ctaLines.forEach((line, i) => {
      ctx.fillText(line, W / 2, ctaStartY + i * 90)
    })

    // Arrow / subscribe hint
    ctx.font = `bold 36px ${font}`
    ctx.fillStyle = 'rgba(255,255,255,0.7)'
    ctx.fillText('SUBSCRIBE', W / 2, H * 0.72)

    // Underline
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(W / 2 - 80, H * 0.72 + 12, 160, 4)

  } else {
    // ── Title at top ──
    ctx.font = `bold 44px ${font}`
    ctx.fillStyle = 'rgba(255,255,255,0.6)'
    ctx.textAlign = 'center'
    const titleLines = wrapText(ctx, title.toUpperCase(), W - 160)
    titleLines.slice(0, 2).forEach((line, i) => {
      ctx.fillText(line, W / 2, 160 + i * 56)
    })

    // ── Accent divider line under title ──
    ctx.fillStyle = palette.accent
    roundRect(ctx, W / 2 - 50, 170 + titleLines.slice(0, 2).length * 56, 100, 5, 3)
    ctx.fill()

    // ── Main content area ──
    const contentY = H * 0.30
    const contentH = H * 0.45
    const pad = 70

    if (scene.isHook) {
      // Hook: large bold centered text
      ctx.font = `bold 64px ${font}`
      ctx.fillStyle = '#FFFFFF'
      ctx.textAlign = 'center'
      const hookLines = wrapText(ctx, scene.text, W - pad * 2)
      const hookLineH = 80
      const hookTotalH = hookLines.length * hookLineH
      const hookStartY = contentY + (contentH - hookTotalH) / 2 + 50
      hookLines.forEach((line, i) => {
        ctx.fillText(line, W / 2, hookStartY + i * hookLineH)
      })

      // Accent underline under hook
      const lastLineY = hookStartY + (hookLines.length - 1) * hookLineH + 20
      ctx.fillStyle = palette.accent
      ctx.fillRect(W / 2 - 60, lastLineY, 120, 6)

    } else {
      // Step scenes: number badge + text

      // Big number badge (circle)
      const badgeX = W / 2
      const badgeY = contentY + 80
      const badgeR = 65

      // Circle background
      ctx.beginPath()
      ctx.arc(badgeX, badgeY, badgeR, 0, Math.PI * 2)
      ctx.fillStyle = palette.accent
      ctx.fill()

      // Number in circle
      ctx.font = `bold 72px ${font}`
      ctx.fillStyle = '#FFFFFF'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(`${scene.stepNum}`, badgeX, badgeY)
      ctx.textBaseline = 'alphabetic'

      // Step text below badge
      const textY = badgeY + badgeR + 60
      ctx.font = `bold 52px ${font}`
      ctx.fillStyle = '#FFFFFF'
      ctx.textAlign = 'center'
      const stepLines = wrapText(ctx, scene.text, W - pad * 2)
      stepLines.forEach((line, i) => {
        ctx.fillText(line, W / 2, textY + i * 68)
      })
    }

    // ── Bottom branding bar ──
    ctx.fillStyle = 'rgba(255,255,255,0.04)'
    ctx.fillRect(0, H - 120, W, 120)
    ctx.font = `bold 26px ${font}`
    ctx.fillStyle = 'rgba(255,255,255,0.3)'
    ctx.textAlign = 'center'
    ctx.fillText('SHORTFLOW', W / 2, H - 50)
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
