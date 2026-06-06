import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
const router = Router()

router.get('/list', requireAuth, async (req, res) => {
  // Fetch voices from ElevenLabs
  try {
    const r = await fetch('https://api.elevenlabs.io/v1/voices', { headers:{ 'xi-api-key':process.env.ELEVENLABS_API_KEY||'' } })
    const data = await r.json()
    res.json({ voices:data.voices||[] })
  } catch(err) { res.status(500).json({ error:err.message }) }
})

router.post('/generate', requireAuth, async (req, res) => {
  const { text, voice_id='21m00Tcm4TlvDq8ikWAM', stability=0.5, similarity_boost=0.75 } = req.body
  if (!text) return res.status(400).json({ error:'text required' })
  try {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice_id}`, {
      method:'POST',
      headers:{ 'xi-api-key':process.env.ELEVENLABS_API_KEY||'', 'Content-Type':'application/json' },
      body:JSON.stringify({ text, model_id:'eleven_monolingual_v1', voice_settings:{ stability, similarity_boost } })
    })
    if (!r.ok) { const e = await r.json(); throw new Error(e.detail?.message||'ElevenLabs error') }
    const buffer = await r.arrayBuffer()
    res.set({ 'Content-Type':'audio/mpeg', 'Content-Length':buffer.byteLength })
    res.send(Buffer.from(buffer))
  } catch(err) { res.status(500).json({ error:err.message }) }
})

export default router
