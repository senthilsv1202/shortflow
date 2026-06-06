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
    <div style={{minHeight:'100vh',background:'#0A0A0F',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'DM Sans',sans-serif"}}>
      <div style={{width:400,padding:'40px',background:'#111118',border:'1px solid #2A2A38',borderRadius:16}}>
        <div style={{textAlign:'center',marginBottom:32}}>
          <div style={{fontFamily:"'Syne',sans-serif",fontSize:26,fontWeight:800,color:'#F0F0F8',display:'flex',alignItems:'center',justifyContent:'center',gap:10,marginBottom:8}}>
            <span style={{width:10,height:10,borderRadius:'50%',background:'#FF3B3B',display:'inline-block'}}/>ShortFlow
          </div>
          <div style={{fontSize:13,color:'#60607A'}}>
            {mode==='signin'?'Sign in to your account':'Create your free account'}
          </div>
        </div>
        <form onSubmit={handle}>
          {mode==='signup' && (
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input className="form-input" placeholder="Your name" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} required />
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" type="email" placeholder="you@example.com" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} required />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input className="form-input" type="password" placeholder="••••••••" value={form.password} onChange={e=>setForm(f=>({...f,password:e.target.value}))} required minLength={6} />
          </div>
          {error && <div style={{background:'rgba(255,60,60,.1)',border:'1px solid rgba(255,60,60,.3)',borderRadius:8,padding:'10px 14px',fontSize:13,color:'#FF6060',marginBottom:14}}>⚠️ {error}</div>}
          <button type="submit" className="btn btn-accent btn-full btn-lg" style={{marginTop:4}} disabled={loading}>
            {loading?'Please wait...':(mode==='signin'?'Sign In →':'Create Account →')}
          </button>
        </form>
        <div style={{textAlign:'center',marginTop:20,fontSize:13,color:'#60607A'}}>
          {mode==='signin'?<>No account? <span style={{color:'#FF3B3B',cursor:'pointer'}} onClick={()=>setMode('signup')}>Sign up free</span></>
            :<>Have an account? <span style={{color:'#FF3B3B',cursor:'pointer'}} onClick={()=>setMode('signin')}>Sign in</span></>}
        </div>
        <div style={{textAlign:'center',marginTop:16,fontSize:11,color:'#3A3A50'}}>🔒 Free plan · No credit card required · 10 shorts/month</div>
      </div>
    </div>
  )
}
