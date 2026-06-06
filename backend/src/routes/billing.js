import { Router } from 'express'
import Stripe from 'stripe'
import { requireAuth } from '../middleware/auth.js'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()
const router = Router()
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY||'')
const PLANS = {
  creator:{ priceId:process.env.STRIPE_CREATOR_PRICE_ID, shorts_limit:999999 },
  agency:{ priceId:process.env.STRIPE_AGENCY_PRICE_ID, shorts_limit:999999 }
}

router.post('/checkout', requireAuth, async (req, res) => {
  const { plan } = req.body
  if (!PLANS[plan]) return res.status(400).json({ error:'Invalid plan' })
  try {
    let customerId = req.profile.stripe_customer_id
    if (!customerId) {
      const customer = await stripe.customers.create({ email:req.user.email, metadata:{ user_id:req.user.id } })
      customerId = customer.id
      await req.supabase.from('profiles').update({ stripe_customer_id:customerId }).eq('id',req.user.id)
    }
    const session = await stripe.checkout.sessions.create({
      customer:customerId, mode:'subscription', payment_method_types:['card'],
      line_items:[{ price:PLANS[plan].priceId, quantity:1 }],
      success_url:`${process.env.FRONTEND_URL}/settings?upgraded=true`,
      cancel_url:`${process.env.FRONTEND_URL}/pricing`,
      metadata:{ user_id:req.user.id, plan }
    })
    res.json({ url:session.url })
  } catch(err) { res.status(500).json({ error:err.message }) }
})

router.post('/portal', requireAuth, async (req, res) => {
  try {
    if (!req.profile.stripe_customer_id) return res.status(400).json({ error:'No billing account found' })
    const session = await stripe.billingPortal.sessions.create({ customer:req.profile.stripe_customer_id, return_url:`${process.env.FRONTEND_URL}/settings` })
    res.json({ url:session.url })
  } catch(err) { res.status(500).json({ error:err.message }) }
})

router.get('/subscription', requireAuth, async (req, res) => {
  if (!req.profile.stripe_subscription_id) return res.json({ subscription:null, plan:req.profile.plan })
  try {
    const sub = await stripe.subscriptions.retrieve(req.profile.stripe_subscription_id)
    res.json({ subscription:sub, plan:req.profile.plan })
  } catch(err) { res.status(500).json({ error:err.message }) }
})

// Stripe Webhook
router.post('/webhook', express_raw_middleware, async (req, res) => {
  const sig = req.headers['stripe-signature']
  let event
  try { event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET) }
  catch(err) { return res.status(400).send(`Webhook error: ${err.message}`) }
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
  if (event.type==='checkout.session.completed') {
    const s = event.data.object
    const { user_id, plan } = s.metadata
    await sb.from('profiles').update({ plan, shorts_limit:PLANS[plan]?.shorts_limit||999999, stripe_subscription_id:s.subscription }).eq('id',user_id)
  }
  if (event.type==='customer.subscription.deleted') {
    const sub = event.data.object
    const { data:p } = await sb.from('profiles').select('id').eq('stripe_subscription_id',sub.id).single()
    if (p) await sb.from('profiles').update({ plan:'free', shorts_limit:10, stripe_subscription_id:null }).eq('id',p.id)
  }
  res.json({ received:true })
})

function express_raw_middleware(req,res,next) { next() } // placeholder, handled at server level
export default router
