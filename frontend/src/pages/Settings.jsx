import { useState } from 'react'
import { useAuth } from '../hooks/useAuth.jsx'
import { api } from '../lib/api.js'

export default function Settings() {
  const { profile, updateProfile, signOut } = useAuth()
  const [tab, setTab] = useState('profile')
  const [form, setForm] = useState({ full_name:profile?.full_name||'', default_niche:profile?.default_niche||'Tech & Programming', default_tone:profile?.default_tone||'Energetic & Engaging', default_language:profile?.default_language||'English', watermark_text:profile?.watermark_text||'' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const set = (k,v) => setForm(f=>({...f,[k]:v}))

  async function save() {
    setSaving(true)
    try { await updateProfile(form); setSaved(true); setTimeout(()=>setSaved(false),2000) }
    catch(e) { alert(e.message) }
    finally { setSaving(false) }
  }

  async function openBillingPortal() {
    try { const { url } = await api.createPortal(); window.location.href = url }
    catch { alert('Connect Stripe in backend .env to manage billing.') }
  }

  const TABS = ['profile','ai','billing','notifications']

  return (
    <div className="fade-in">
      <div className="page-header"><div className="page-title">⚙️ Settings</div><div className="page-desc">Manage your account and preferences</div></div>
      <div className="tabs">{TABS.map(t=><div key={t} className={`tab${tab===t?' active':''}`} onClick={()=>setTab(t)} style={{textTransform:'capitalize'}}>{t}</div>)}</div>

      <div style={{maxWidth:560}}>
        {tab==='profile' && (
          <div className="card card-pad">
            <div className="form-group"><label className="form-label">Display Name</label><input className="form-input" value={form.full_name} onChange={e=>set('full_name',e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Email</label><input className="form-input" value={profile?.email||''} disabled style={{opacity:.6}} /></div>
            <div className="form-group"><label className="form-label">Default Niche</label>
              <select className="form-input form-select" value={form.default_niche} onChange={e=>set('default_niche',e.target.value)}>
                {['Tech & Programming','Finance & Money','Health & Fitness','Business & Entrepreneurship','Gaming','Educational / Science','Motivation & Lifestyle'].map(n=><option key={n}>{n}</option>)}
              </select>
            </div>
            <div className="form-group"><label className="form-label">Watermark / Channel Handle</label><input className="form-input" placeholder="@yourchannel" value={form.watermark_text} onChange={e=>set('watermark_text',e.target.value)} /></div>
            <button className="btn btn-accent" onClick={save} disabled={saving}>{saving?'Saving..':saved?'✅ Saved!':'Save Changes'}</button>
          </div>
        )}

        {tab==='ai' && (
          <div className="card card-pad">
            <div className="form-group"><label className="form-label">Default Tone</label>
              <select className="form-input form-select" value={form.default_tone} onChange={e=>set('default_tone',e.target.value)}>
                {['Energetic & Engaging','Professional & Clear','Casual & Friendly','Dramatic & Intense','Educational & Calm','Humorous & Witty'].map(t=><option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group"><label className="form-label">Script Language</label>
              <select className="form-input form-select" value={form.default_language} onChange={e=>set('default_language',e.target.value)}>
                {['English','Spanish','French','Portuguese','Hindi','German','Japanese','Korean','Arabic'].map(l=><option key={l}>{l}</option>)}
              </select>
            </div>
            <div className="form-group"><label className="form-label">Hook Style</label>
              <select className="form-input form-select">
                <option>Question Hook</option><option>Shocking Fact</option><option>Controversial Statement</option><option>Story / Anecdote</option><option>Challenge</option>
              </select>
            </div>
            <div style={{background:'var(--bg3)',borderRadius:10,padding:'14px 16px',marginBottom:20}}>
              <div style={{fontWeight:600,fontSize:13,marginBottom:6}}>🔑 API Keys</div>
              <div style={{fontSize:12,color:'var(--text3)',marginBottom:10}}>Add your own API keys for advanced features</div>
              <div className="form-group"><label className="form-label">Anthropic API Key</label><input className="form-input" type="password" placeholder="sk-ant-..." /></div>
              <div className="form-group" style={{marginBottom:0}}><label className="form-label">ElevenLabs (Voiceover)</label><input className="form-input" type="password" placeholder="Your ElevenLabs key" /></div>
            </div>
            <button className="btn btn-accent" onClick={save} disabled={saving}>{saving?'Saving..':saved?'✅ Saved!':'Save Settings'}</button>
          </div>
        )}

        {tab==='billing' && (
          <div className="card card-pad">
            <div style={{background:'var(--bg3)',border:'1px solid var(--border2)',borderRadius:12,padding:'18px 20px',marginBottom:20}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
                <div style={{fontFamily:'var(--font-head)',fontWeight:700,fontSize:16,color:'var(--accent)'}}>{(profile?.plan||'free').toUpperCase()} PLAN</div>
                <span className="tag tag-green">Active</span>
              </div>
              <div style={{fontSize:13,color:'var(--text2)',marginBottom:4}}>{profile?.plan==='free'?`${profile?.shorts_used||0} of ${profile?.shorts_limit||10} free shorts used this month`:'Unlimited shorts generation'}</div>
              {profile?.plan==='free' && <div className="progress-track" style={{marginTop:10}}><div className="progress-fill" style={{width:`${Math.min(((profile?.shorts_used||0)/(profile?.shorts_limit||10))*100,100)}%`}} /></div>}
            </div>
            {profile?.plan==='free' ? (
              <a href="/pricing" className="btn btn-accent btn-full" style={{padding:12,marginBottom:12}}>⭐ Upgrade to Creator — $19/mo</a>
            ) : (
              <button className="btn btn-ghost btn-full" onClick={openBillingPortal} style={{marginBottom:12}}>Manage Subscription & Invoices</button>
            )}
            <button className="btn btn-danger btn-full" onClick={signOut}>Sign Out</button>
          </div>
        )}

        {tab==='notifications' && (
          <div className="card card-pad">
            {[['published','Short published successfully'],['trending','Trending topic detected in your niche'],['weekly_report','Weekly analytics report (email)'],['ypp_alert','YPP eligibility milestone reached'],['marketing','Product updates and tips']].map(([key,label])=>(
              <div key={key} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 0',borderBottom:'1px solid var(--border)'}}>
                <div>
                  <div style={{fontSize:14}}>{label}</div>
                  <div style={{fontSize:11,color:'var(--text3)',marginTop:2}}>Email notification</div>
                </div>
                <label className="toggle"><input type="checkbox" defaultChecked={key!=='marketing'} /><span className="toggle-slider" /></label>
              </div>
            ))}
            <button className="btn btn-accent" style={{marginTop:16}} onClick={save}>Save Preferences</button>
          </div>
        )}
      </div>
    </div>
  )
}
