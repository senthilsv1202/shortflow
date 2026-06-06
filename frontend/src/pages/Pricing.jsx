import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.jsx'
import { api } from '../lib/api.js'

const PLANS = [
  { id:'free', name:'Free', price:0, period:'Forever free', color:'var(--text)', features:['10 AI Shorts / month','1 YouTube channel','Basic video styles','Manual posting only','Community support'], missing:['Auto-publishing','Full analytics','Custom branding','API access'] },
  { id:'creator', name:'Creator', price:19, period:'per month', color:'var(--accent)', featured:true, features:['Unlimited AI Shorts','3 YouTube channels','All 6 video styles','Auto-publishing & scheduling','Full analytics dashboard','Custom watermark & branding','Priority AI generation','Email support'], missing:['White-label','API access','Team seats'] },
  { id:'agency', name:'Agency', price:79, period:'per month', color:'var(--blue)', features:['Everything in Creator','20+ YouTube channels','White-label dashboard','Team collaboration (5 seats)','API access','Bulk generation','Dedicated account manager','Priority support + SLA'] },
]

export default function Pricing() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const currentPlan = profile?.plan || 'free'

  async function upgrade(planId) {
    if (planId === 'free') return
    try {
      const { url } = await api.createCheckout(planId)
      window.location.href = url
    } catch {
      alert('Connect Stripe in backend .env to enable payments. See LAUNCH_GUIDE.md.')
    }
  }

  return (
    <div className="fade-in">
      <div style={{textAlign:'center',marginBottom:36}}>
        <div style={{fontFamily:'var(--font-head)',fontSize:26,fontWeight:800,marginBottom:8}}>Choose Your Plan</div>
        <div style={{fontSize:14,color:'var(--text3)'}}>Start free. Scale as you grow. No credit card required.</div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:18,maxWidth:880,margin:'0 auto',marginBottom:32}}>
        {PLANS.map(plan=>(
          <div key={plan.id} style={{background:'var(--bg2)',border:`1px solid ${plan.featured?'var(--accent)':'var(--border)'}`,borderRadius:16,padding:28,position:'relative'}}>
            {plan.featured && <div style={{position:'absolute',top:-12,left:'50%',transform:'translateX(-50%)',background:'var(--accent)',color:'var(--bg)',fontSize:11,padding:'4px 16px',borderRadius:20,fontWeight:700,fontFamily:'var(--font-head)',whiteSpace:'nowrap'}}>🔥 Most Popular</div>}
            {currentPlan===plan.id && <div style={{position:'absolute',top:-12,right:16,background:'var(--green)',color:'var(--bg)',fontSize:11,padding:'4px 12px',borderRadius:20,fontWeight:700}}>✓ Current</div>}
            <div style={{fontFamily:'var(--font-head)',fontSize:18,fontWeight:700,marginBottom:4,color:plan.color}}>{plan.name}</div>
            <div style={{fontSize:34,fontWeight:800,fontFamily:'var(--font-head)',marginBottom:2}}>${plan.price}<span style={{fontSize:14,color:'var(--text2)',fontWeight:400}}>/{plan.price===0?'mo':plan.period.split(' ')[0]}</span></div>
            <div style={{fontSize:12,color:'var(--text3)',marginBottom:22}}>{plan.period}</div>
            <div style={{marginBottom:22}}>
              {plan.features.map(f=><div key={f} style={{fontSize:13,padding:'6px 0',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',gap:8,color:'var(--text2)'}}>
                <span style={{color:'var(--green)',flexShrink:0}}>✓</span>{f}
              </div>)}
              {(plan.missing||[]).map(f=><div key={f} style={{fontSize:13,padding:'6px 0',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',gap:8,color:'var(--text3)'}}>
                <span style={{color:'var(--text3)',flexShrink:0}}>✗</span>{f}
              </div>)}
            </div>
            <button
              className={`btn ${plan.featured?'btn-accent':'btn-ghost'} btn-full`}
              style={{padding:12}}
              onClick={()=>upgrade(plan.id)}
              disabled={currentPlan===plan.id}
            >
              {currentPlan===plan.id?'Current Plan':plan.price===0?'Get Started Free':`Upgrade to ${plan.name}`}
            </button>
          </div>
        ))}
      </div>

      <div style={{maxWidth:880,margin:'0 auto'}}>
        <div style={{textAlign:'center',marginBottom:24,fontSize:12,color:'var(--text3)'}}>💳 Secure payments via Stripe · 🔒 SSL encrypted · 30-day money back guarantee</div>
        <div className="card card-pad">
          <div style={{fontWeight:700,fontFamily:'var(--font-head)',fontSize:15,marginBottom:16,textAlign:'center'}}>Frequently Asked Questions</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
            {[
              ['Can I cancel anytime?','Yes — cancel from your billing settings anytime. No lock-in periods.'],
              ['What counts as a "short"?','Each AI generation = 1 short. Edits and republishing are free.'],
              ['Do you support multiple channels?','Creator supports 3, Agency supports 20+ channels.'],
              ['How does auto-publishing work?','We use YouTube\'s official API. You authorize your channel once.'],
            ].map(([q,a])=>(
              <div key={q} style={{padding:'14px 16px',background:'var(--bg3)',borderRadius:10}}>
                <div style={{fontWeight:600,fontSize:13,marginBottom:5}}>{q}</div>
                <div style={{fontSize:12,color:'var(--text3)',lineHeight:1.6}}>{a}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
