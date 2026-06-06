import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()
const supabase = createClient(process.env.SUPABASE_URL||'', process.env.SUPABASE_SERVICE_KEY||'')

export async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ','')
  if (!token) return res.status(401).json({ error:'Unauthorized' })
  const { data:{ user }, error } = await supabase.auth.getUser(token)
  if (error||!user) return res.status(401).json({ error:'Invalid token' })
  req.user = user
  const { data:profile } = await supabase.from('profiles').select('*').eq('id',user.id).single()
  req.profile = profile||{}
  req.supabase = supabase
  next()
}

export function requirePlan(...plans) {
  return (req,res,next) => {
    if (!plans.includes(req.profile?.plan||'free')) return res.status(403).json({ error:`Requires ${plans.join(' or ')} plan` })
    next()
  }
}
