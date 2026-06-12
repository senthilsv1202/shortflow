import { Router } from 'express'
import Anthropic from '@anthropic-ai/sdk'
import { requireAuth } from '../middleware/auth.js'
const router = Router()
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

router.post('/short', requireAuth, async (req, res) => {
  const { plan, shorts_used=0, shorts_limit=10 } = req.profile
  if (plan==='free' && shorts_used>=shorts_limit) return res.status(403).json({ error:'Free limit reached. Please upgrade.' })

  const { topic, niche='General', style='talking', tone='Energetic & Engaging', hook='', notes='', duration='45-60', language='English' } = req.body
  if (!topic) return res.status(400).json({ error:'Topic required' })

  try {
    const prompt = `Create a complete YouTube Short for this brief:
Topic: ${topic}
Niche: ${niche}
Style: ${style}
Tone: ${tone}
Duration: ${duration} seconds
Language: ${language}
${hook?`Custom Hook: ${hook}`:''}
${notes?`Notes: ${notes}`:''}

Return ONLY valid JSON, no markdown fences:
{
  "title": "YouTube title under 60 chars",
  "hook": "First 3 seconds attention grabber",
  "script": "Full word-for-word script",
  "description": "YouTube description with keywords ~400 chars",
  "tags": ["#tag1","#tag2","#tag3","#tag4","#tag5","#tag6","#tag7","#tag8","#tag9","#tag10"],
  "thumbnail_prompt": "Detailed image generation prompt for thumbnail",
  "seo_score": 84,
  "viral_score": 78,
  "duration": "~55s",
  "cta": "Call to action text",
  "key_points": ["point 1","point 2","point 3"]
}`

    const msg = await anthropic.messages.create({
      model:'claude-3-5-sonnet-20241022', max_tokens:2000,
      system:'You are an expert YouTube Shorts creator. Return ONLY valid JSON, no markdown.',
      messages:[{ role:'user', content:prompt }]
    })

    let result
    try { result = JSON.parse(msg.content[0].text.replace(/```json|```/g,'').trim()) }
    catch { return res.status(500).json({ error:'AI returned invalid JSON' }) }

    // Increment usage
    await req.supabase.from('profiles').update({ shorts_used:shorts_used+1 }).eq('id',req.user.id)
    res.json(result)
  } catch(err) {
    console.error('Generate error:',err)
    res.status(500).json({ error:err.message })
  }
})

router.post('/script', requireAuth, async (req, res) => {
  const { topic, tone='Engaging', duration='60' } = req.body
  try {
    const msg = await anthropic.messages.create({
      model:'claude-3-5-sonnet-20241022', max_tokens:800,
      messages:[{ role:'user', content:`Write a ${duration} second YouTube Shorts script about: ${topic}. Tone: ${tone}. Return only the script.` }]
    })
    res.json({ script:msg.content[0].text })
  } catch(err) { res.status(500).json({ error:err.message }) }
})

router.get('/trends', requireAuth, async (req, res) => {
  const { niche='General' } = req.query
  try {
    const msg = await anthropic.messages.create({
      model:'claude-3-5-sonnet-20241022', max_tokens:600,
      messages:[{ role:'user', content:`List 8 trending YouTube Shorts topics for the "${niche}" niche right now in 2025. Return ONLY JSON array: [{"topic":"...","viral_potential":"high","reason":"..."}]` }]
    })
    const data = JSON.parse(msg.content[0].text.replace(/```json|```/g,'').trim())
    res.json({ trends:data })
  } catch(err) { res.status(500).json({ error:err.message }) }
})

export default router
