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

// ── Visual design system ───────────────────────────────────────────────────

const ACCENTS = ['#FF3B3B', '#00D4FF', '#00F5A0', '#C084FC', '#FBD38D', '#FF6B6B', '#38BDF8']

function drawBackground(ctx, accent, index) {
  // Rich gradient that shifts slightly per scene
  const hueShift = index * 8
  const bg = ctx.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, `hsl(${240 + hueShift}, 40%, 8%)`)
  bg.addColorStop(0.5, `hsl(${250 + hueShift}, 35%, 12%)`)
  bg.addColorStop(1, `hsl(${230 + hueShift}, 45%, 6%)`)
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  // Large accent glow — top right
  const g1 = ctx.createRadialGradient(W * 0.8, H * 0.15, 0, W * 0.8, H * 0.15, 500)
  g1.addColorStop(0, accent + '22')
  g1.addColorStop(0.6, accent + '08')
  g1.addColorStop(1, 'transparent')
  ctx.fillStyle = g1
  ctx.fillRect(0, 0, W, H)

  // Second glow — bottom left
  const g2 = ctx.createRadialGradient(W * 0.2, H * 0.85, 0, W * 0.2, H * 0.85, 450)
  g2.addColorStop(0, accent + '18')
  g2.addColorStop(1, 'transparent')
  ctx.fillStyle = g2
  ctx.fillRect(0, 0, W, H)

  // Scattered particles (small dots for texture)
  ctx.fillStyle = 'rgba(255,255,255,0.03)'
  const seed = index * 1000
  for (let i = 0; i < 40; i++) {
    const px = ((seed + i * 137) % W)
    const py = ((seed + i * 271) % H)
    const pr = 2 + (i % 4)
    ctx.beginPath()
    ctx.arc(px, py, pr, 0, Math.PI * 2)
    ctx.fill()
  }

  // Horizontal grid lines (very subtle)
  ctx.strokeStyle = 'rgba(255,255,255,0.015)'
  ctx.lineWidth = 1
  for (let y = 200; y < H; y += 120) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(W, y)
    ctx.stroke()
  }
}

function drawProgressBar(ctx, index, total, accent) {
  // Segmented progress bar at very top
  const barY = 55
  const pad = 60
  const gap = 6
  const totalW = W - pad * 2
  const segW = (totalW - (total - 1) * gap) / total

  for (let i = 0; i < total; i++) {
    const x = pad + i * (segW + gap)
    roundRect(ctx, x, barY, segW, 6, 3)
    ctx.fillStyle = i <= index ? accent : 'rgba(255,255,255,0.12)'
    ctx.fill()
  }
}

function drawScene(scene, title, index, totalScenes) {
  const canvas = createCanvas(W, H)
  const ctx = canvas.getContext('2d')
  const font = `"${FONT_NAME}", sans-serif`
  const accent = scene.isCta ? '#FF3B3B' : ACCENTS[index % ACCENTS.length]

  // ── Background with glows + particles ──
  drawBackground(ctx, accent, index)

  // ── Progress bar ──
  drawProgressBar(ctx, index, totalScenes, accent)

  if (scene.isCta) {
    // ════════════════════════════════════════
    // CTA SCENE — Full screen impact
    // ════════════════════════════════════════

    // Big glow behind center
    const ctaGlow = ctx.createRadialGradient(W / 2, H * 0.42, 0, W / 2, H * 0.42, 500)
    ctaGlow.addColorStop(0, '#FF3B3B30')
    ctaGlow.addColorStop(1, 'transparent')
    ctx.fillStyle = ctaGlow
    ctx.fillRect(0, 0, W, H)

    // Main CTA text — huge and bold
    ctx.font = `bold 72px ${font}`
    ctx.fillStyle = '#FFFFFF'
    ctx.textAlign = 'center'
    const ctaLines = wrapText(ctx, scene.text, W - 120)
    const lineH = 92
    const totalH = ctaLines.length * lineH
    const startY = H * 0.32
    ctaLines.slice(0, 4).forEach((line, i) => {
      ctx.fillText(line, W / 2, startY + i * lineH)
    })

    // Accent underline
    ctx.fillStyle = '#FF3B3B'
    const underY = startY + Math.min(ctaLines.length, 4) * lineH + 15
    ctx.fillRect(W / 2 - 60, underY, 120, 5)

    // Subscribe button
    const btnY = H * 0.70
    roundRect(ctx, W / 2 - 200, btnY, 400, 80, 40)
    ctx.fillStyle = '#FF3B3B'
    ctx.fill()
    ctx.font = `bold 36px ${font}`
    ctx.fillStyle = '#FFFFFF'
    ctx.fillText('SUBSCRIBE', W / 2, btnY + 52)

    // Bottom hint
    ctx.font = `bold 28px ${font}`
    ctx.fillStyle = 'rgba(255,255,255,0.35)'
    ctx.fillText('Like & Share if this helped!', W / 2, H - 120)

  } else if (scene.isHook) {
    // ════════════════════════════════════════
    // HOOK SCENE — Attention grabber, fills screen
    // ════════════════════════════════════════

    // Title badge at top
    const badgeW = Math.min(ctx.measureText(title).width + 60, W - 80)
    roundRect(ctx, (W - badgeW) / 2, 100, badgeW, 50, 25)
    ctx.fillStyle = accent + '30'
    ctx.fill()
    ctx.strokeStyle = accent + '60'
    ctx.lineWidth = 1.5
    roundRect(ctx, (W - badgeW) / 2, 100, badgeW, 50, 25)
    ctx.stroke()
    ctx.font = `bold 26px ${font}`
    ctx.fillStyle = accent
    ctx.textAlign = 'center'
    ctx.fillText(title.length > 35 ? title.slice(0, 32) + '...' : title, W / 2, 133)

    // Hook text — BIG, centered, fills the middle
    ctx.font = `bold 64px ${font}`
    ctx.fillStyle = '#FFFFFF'
    ctx.textAlign = 'center'
    const hookLines = wrapText(ctx, scene.text, W - 100)
    const lineH = 82
    const totalH = hookLines.length * lineH
    const startY = (H - totalH) / 2 + 20
    hookLines.slice(0, 7).forEach((line, i) => {
      ctx.fillText(line, W / 2, startY + i * lineH)
    })

    // Animated-looking pulse ring at bottom
    ctx.beginPath()
    ctx.arc(W / 2, H - 180, 30, 0, Math.PI * 2)
    ctx.strokeStyle = accent + '60'
    ctx.lineWidth = 3
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(W / 2, H - 180, 50, 0, Math.PI * 2)
    ctx.strokeStyle = accent + '25'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.font = `bold 22px ${font}`
    ctx.fillStyle = 'rgba(255,255,255,0.4)'
    ctx.textAlign = 'center'
    ctx.fillText('WATCH TILL THE END', W / 2, H - 110)

  } else {
    // ════════════════════════════════════════
    // STEP SCENE — Number + content, fills screen
    // ════════════════════════════════════════
    const pad = 65

    // Top section: Step label + number
    const topY = 120

    // "STEP" label
    ctx.font = `bold 24px ${font}`
    ctx.fillStyle = accent
    ctx.textAlign = 'left'
    ctx.fillText('STEP', pad, topY)

    // Big number right next to STEP
    ctx.font = `bold 120px ${font}`
    ctx.fillStyle = accent
    ctx.textAlign = 'left'
    const stepLabelW = ctx.measureText('STEP ').width
    ctx.fillText(`${scene.stepNum}`, pad - 5, topY + 120)

    // Accent line
    ctx.fillStyle = accent
    ctx.fillRect(pad, topY + 140, 80, 4)

    // Giant ghost number in background (right side)
    ctx.font = `bold 350px ${font}`
    ctx.fillStyle = accent + '08'
    ctx.textAlign = 'right'
    ctx.fillText(`${scene.stepNum}`, W + 30, H * 0.55)

    // Content card — glass morphism style
    const cardY = topY + 180
    const cardH = H - cardY - 160
    const cardPad = 20

    // Card background
    roundRect(ctx, pad - cardPad, cardY, W - (pad - cardPad) * 2, cardH, 20)
    ctx.fillStyle = 'rgba(255,255,255,0.04)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'
    ctx.lineWidth = 1
    roundRect(ctx, pad - cardPad, cardY, W - (pad - cardPad) * 2, cardH, 20)
    ctx.stroke()

    // Step text inside card — large, fills space
    ctx.font = `bold 46px ${font}`
    ctx.fillStyle = '#FFFFFF'
    ctx.textAlign = 'left'
    const stepLines = wrapText(ctx, scene.text, W - pad * 2 - 20)
    const stepLineH = 62
    const textAreaH = cardH - 60
    const maxLines = Math.floor(textAreaH / stepLineH)
    const textStartY = cardY + 55
    stepLines.slice(0, maxLines).forEach((line, i) => {
      ctx.fillText(line, pad + 10, textStartY + i * stepLineH)
    })

    // Bottom accent bar
    ctx.fillStyle = accent
    ctx.fillRect(pad, cardY + cardH - 6, 60, 4)
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

// ── Get audio duration via FFmpeg ───────────────────────────────────────────

function getAudioDuration(filePath) {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err || !metadata) { resolve(5) } // fallback 5s
      else { resolve(metadata.format.duration || 5) }
    })
  })
}

// ── Generate per-scene voiceovers ──────────────────────────────────────────

async function generateSceneAudios(scenes, voiceId, tmpDir) {
  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) return scenes.map(s => ({ ...s, audioPath: null }))

  const results = []
  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i]
    const audioFile = path.join(tmpDir, `scene_audio_${i}.mp3`)
    try {
      const buffer = await generateVoiceover(scene.text, voiceId)
      await fs.writeFile(audioFile, buffer)
      const duration = await getAudioDuration(audioFile)
      console.log(`[video] Scene ${i} audio: ${duration.toFixed(1)}s — "${scene.text.slice(0, 40)}..."`)
      results.push({ ...scene, audioPath: audioFile, duration: duration + 0.5 }) // +0.5s breathing room
    } catch (err) {
      console.warn(`[video] Scene ${i} audio failed: ${err.message}`)
      results.push({ ...scene, audioPath: null }) // keep original fallback duration
    }
  }
  return results
}

// ── FFmpeg: concat per-scene audios into one track ─────────────────────────

async function concatAudios(scenes, outputPath, tmpDir) {
  const audioScenes = scenes.filter(s => s.audioPath)
  if (audioScenes.length === 0) return null

  const listFile = path.join(tmpDir, 'audio_list.txt')
  const listContent = audioScenes.map(s => `file '${s.audioPath}'`).join('\n')
  await fs.writeFile(listFile, listContent)

  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(listFile)
      .inputOptions(['-f concat', '-safe 0'])
      .outputOptions(['-c:a libmp3lame', '-b:a 192k'])
      .output(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', (err) => { console.warn('[ffmpeg] audio concat error:', err.message); resolve(null) })
      .run()
  })
}

// ── FFmpeg video assembler ─────────────────────────────────────────────────

async function buildVideo(scenes, title, combinedAudioPath, outputPath, tmpDir) {
  // Generate PNG for each scene
  const framePaths = []
  for (let i = 0; i < scenes.length; i++) {
    const png = drawScene(scenes[i], title, i, scenes.length)
    const framePath = path.join(tmpDir, `scene_${i}.png`)
    await fs.writeFile(framePath, png)
    framePaths.push({ path: framePath, duration: scenes[i].duration })
  }

  // Write concat file — each frame shown for its scene duration
  const concatFile = path.join(tmpDir, 'concat.txt')
  const concatContent = framePaths.map(f =>
    `file '${f.path}'\nduration ${f.duration.toFixed(2)}`
  ).join('\n') + `\nfile '${framePaths[framePaths.length - 1].path}'`
  await fs.writeFile(concatFile, concatContent)

  const totalDur = framePaths.reduce((sum, f) => sum + f.duration, 0)
  console.log(`[video] Total video duration: ${totalDur.toFixed(1)}s`)

  return new Promise((resolve, reject) => {
    const cmd = ffmpeg()
      .input(concatFile)
      .inputOptions(['-f concat', '-safe 0'])

    if (combinedAudioPath) cmd.input(combinedAudioPath)

    cmd
      .outputOptions([
        '-c:v libx264',
        '-preset fast',
        '-crf 18',
        '-pix_fmt yuv420p',
        '-r 30',
        '-movflags +faststart',
        ...(combinedAudioPath ? ['-c:a aac', '-b:a 192k', '-shortest'] : []),
      ])
      .output(outputPath)
      .on('start', c => console.log('[ffmpeg] started:', c.slice(0, 120)))
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
      await ensureFont()
      let scenes = buildScenes(short)
      const title = short.title || short.topic || ''

      // Step 1: Generate per-scene voiceovers and measure durations
      console.log(`[video] Generating ${scenes.length} scene voiceovers for ${shortId}`)
      scenes = await generateSceneAudios(scenes, voice_id, tmpDir)

      // Step 2: Concat all scene audios into one track
      const combinedAudioPath = path.join(tmpDir, 'combined.mp3')
      let voiceoverUrl = null
      const audioResult = await concatAudios(scenes, combinedAudioPath, tmpDir)
      if (audioResult) {
        const audioBuffer = await fs.readFile(combinedAudioPath)
        voiceoverUrl = await uploadToSupabase(
          req.supabase, audioBuffer,
          `${req.user.id}/${shortId}/voiceover.mp3`, 'audio/mpeg'
        )
        await req.supabase.from('shorts').update({ voiceover_url: voiceoverUrl }).eq('id', shortId)
        console.log(`[video] Combined voiceover uploaded`)
      }

      // Step 3: Build video — each frame duration matches its audio
      console.log(`[video] Building 1080x1920 video for ${shortId}`)
      await buildVideo(scenes, title, audioResult, videoPath, tmpDir)

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
