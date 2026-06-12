import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001
app.set('trust proxy', 1)

// Clients
export const supabase = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_SERVICE_KEY || '')

// Middleware
app.use(helmet())
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  'http://localhost:5173',
  /\.vercel\.app$/,
]
app.use(cors({ origin: allowedOrigins, credentials: true }))

// Stripe webhook needs raw body BEFORE express.json()
app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }))
app.use(express.json())
app.use(rateLimit({ windowMs: 60000, max: 100, message: { error: 'Too many requests' } }))

// Routes
import generateRouter from './routes/generate.js'
import youtubeRouter from './routes/youtube.js'
import billingRouter from './routes/billing.js'
import analyticsRouter from './routes/analytics.js'
import scheduleRouter from './routes/schedule.js'
import voiceRouter from './routes/voice.js'
import publishRouter from './routes/publish.js'
import videoRouter from './routes/video.js'

app.get('/health', (_, res) => res.json({ status: 'ok', version: '1.0.0', time: new Date().toISOString() }))
app.use('/api/generate', generateRouter)
app.use('/api/youtube', youtubeRouter)
app.use('/api/billing', billingRouter)
app.use('/api/analytics', analyticsRouter)
app.use('/api/schedule', scheduleRouter)
app.use('/api/voice', voiceRouter)
app.use('/api/publish', publishRouter)
app.use('/api/video', videoRouter)

// 404
app.use((req, res) => res.status(404).json({ error: 'Route not found' }))

// Error handler
app.use((err, req, res, next) => {
  console.error(err)
  res.status(500).json({ error: err.message || 'Internal server error' })
})

app.listen(PORT, () => console.log(`🚀 ShortFlow API on port ${PORT}`))
export default app
