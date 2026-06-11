import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.jsx'

export default function Auth() {
  const [mode, setMode] = useState('signin')
  const [form, setForm] = useState({ email:'', password:'', name:'' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()

  async function handle(e) {
    e.preventDefault(); setError(''); setLoading(true)
    try {
      if (mode === 'signin') await signIn(form.email, form.password)
      else await signUp(form.email, form.password, form.name)
      navigate('/')
    } catch(err) { setError(err.message) }
    finally { setLoading(false) }
  }

  return (
    <div style={{
      minHeight:'100vh',
      background:'#F0F4F8',
      display:'flex',
      alignItems:'center',
      justifyContent:'center',
      fontFamily:"'DM Sans',system-ui,sans-serif",
      padding:'20px'
    }}>
      {/* Left branding panel */}
      <div style={{
        display:'flex',
        width:'100%',
        maxWidth:900,
        borderRadius:20,
        overflow:'hidden',
        boxShadow:'0 20px 60px rgba(0,0,0,0.15)'
      }}>
        {/* Left side - brand */}
        <div style={{
          flex:1,
          background:'linear-gradient(135deg,#FF3B3B 0%,#FF6060 100%)',
          padding:'48px 40px',
          display:'flex',
          flexDirection:'column',
          justifyContent:'space-between',
          minWidth:280
        }}>
          <div>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:40}}>
              <div style={{width:12,height:12,borderRadius:'50%',background:'#fff'}} />
              <span style={{fontFamily:"'Syne',system-ui,sans-serif",fontSize:22,fontWeight:800,color:'#fff'}}>ShortFlow</span>
            </div>
            <div style={{fontSize:28,fontWeight:800,color:'#fff',lineHeight:1.3,marginBottom:16,fontFamily:"'Syne',system-ui,sans-serif"}}>
              Go viral on YouTube Shorts
            </div>
            <div style={{fontSize:15,color:'rgba(255,255,255,0.85)',lineHeight:1.7}}>
              AI writes your scripts, voices them, and auto-publishes to YouTube. All on autopilot.
            </div>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:12,marginTop:40}}>
            {['✨ AI script generation in seconds','📅 Auto-schedule & publish','📈 Analytics & viral scoring','🆓 Start free — 10 shorts/month'].map(f=>(
              <div key={f} style={{display:'flex',alignItems:'center',gap:10,color:'#fff',fontSize:14}}>
                {f}
              </div>
            ))}
          </div>
        </div>

        {/* Right side - form */}
        <div style={{
          width:400,
          background:'#fff',
          padding:'48px 40px',
          display:'flex',
          flexDirection:'column',
          justifyContent:'center'
        }}>
          <div style={{marginBottom:32}}>
            <div style={{fontSize:24,fontWeight:700,color:'#1A1A2E',marginBottom:6,fontFamily:"'Syne',system-ui,sans-serif"}}>
              {mode==='signin'?'Welcome back 👋':'Create account 🚀'}
            </div>
            <div style={{fontSize:14,color:'#666'}}>
              {mode==='signin'?'Sign in to your ShortFlow account':'Start free — no credit card needed'}
            </div>
          </div>

          <form onSubmit={handle}>
            {mode==='signup' && (
              <div style={{marginBottom:18}}>
                <label style={{display:'block',fontSize:12,fontWeight:600,color:'#444',marginBottom:6,textTransform:'uppercase',letterSpacing:.5}}>Full Name</label>
                <input
                  style={{width:'100%',padding:'11px 14px',border:'1.5px solid #E0E0E0',borderRadius:8,fontSize:14,color:'#1A1A2E',outline:'none',boxSizing:'border-box',background:'#FAFAFA'}}
                  placeholder="Your full name"
                  value={form.name}
                  onChange={e=>setForm(f=>({...f,name:e.target.value}))}
                  onFocus={e=>e.target.style.borderColor='#FF3B3B'}
                  onBlur={e=>e.target.style.borderColor='#E0E0E0'}
                  required
                />
              </div>
            )}

            <div style={{marginBottom:18}}>
              <label style={{display:'block',fontSize:12,fontWeight:600,color:'#444',marginBottom:6,textTransform:'uppercase',letterSpacing:.5}}>Email Address</label>
              <input
                type="email"
                style={{width:'100%',padding:'11px 14px',border:'1.5px solid #E0E0E0',borderRadius:8,fontSize:14,color:'#1A1A2E',outline:'none',boxSizing:'border-box',background:'#FAFAFA'}}
                placeholder="you@example.com"
                value={form.email}
                onChange={e=>setForm(f=>({...f,email:e.target.value}))}
                onFocus={e=>e.target.style.borderColor='#FF3B3B'}
                onBlur={e=>e.target.style.borderColor='#E0E0E0'}
                required
              />
            </div>

            <div style={{marginBottom:24}}>
              <label style={{display:'block',fontSize:12,fontWeight:600,color:'#444',marginBottom:6,textTransform:'uppercase',letterSpacing:.5}}>Password</label>
              <input
                type="password"
                style={{width:'100%',padding:'11px 14px',border:'1.5px solid #E0E0E0',borderRadius:8,fontSize:14,color:'#1A1A2E',outline:'none',boxSizing:'border-box',background:'#FAFAFA'}}
                placeholder="Min 6 characters"
                value={form.password}
                onChange={e=>setForm(f=>({...f,password:e.target.value}))}
                onFocus={e=>e.target.style.borderColor='#FF3B3B'}
                onBlur={e=>e.target.style.borderColor='#E0E0E0'}
                required
                minLength={6}
              />
            </div>

            {error && (
              <div style={{background:'#FFF0F0',border:'1.5px solid #FFD0D0',borderRadius:8,padding:'10px 14px',fontSize:13,color:'#CC0000',marginBottom:16}}>
                ⚠️ {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width:'100%',padding:'13px',background:loading?'#ccc':'#FF3B3B',
                color:'#fff',border:'none',borderRadius:8,fontSize:15,fontWeight:700,
                cursor:loading?'not-allowed':'pointer',
                fontFamily:"'Syne',system-ui,sans-serif",
                transition:'opacity .2s'
              }}
              onMouseEnter={e=>{ if(!loading) e.target.style.opacity='.88' }}
              onMouseLeave={e=>e.target.style.opacity='1'}
            >
              {loading ? 'Please wait...' : mode==='signin' ? 'Sign In →' : 'Create Account →'}
            </button>
          </form>

          <div style={{textAlign:'center',marginTop:20,fontSize:14,color:'#666'}}>
            {mode==='signin'
              ? <>No account? <span style={{color:'#FF3B3B',cursor:'pointer',fontWeight:600}} onClick={()=>setMode('signup')}>Sign up free</span></>
              : <>Have an account? <span style={{color:'#FF3B3B',cursor:'pointer',fontWeight:600}} onClick={()=>setMode('signin')}>Sign in</span></>
            }
          </div>

          <div style={{textAlign:'center',marginTop:24,fontSize:11,color:'#AAA',borderTop:'1px solid #F0F0F0',paddingTop:16}}>
            🔒 Secure · Free plan · No credit card required
          </div>
        </div>
      </div>
    </div>
  )


  console.log('URL:', import.meta.env.VITE_SUPABASE_URL)
 console.log('KEY:', import.meta.env.VITE_SUPABASE_ANON_KEY)
}