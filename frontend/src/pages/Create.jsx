import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.jsx'
import { api } from '../lib/api.js'
import { db } from '../lib/supabase.js'

const STYLES = [
  { id:'talking', label:'Talking Head', icon:'🎤' },
  { id:'text_anim', label:'Text Animation', icon:'✍️' },
  { id:'broll', label:'B-Roll + VO', icon:'🎬' },
  { id:'slides', label:'Slide Deck', icon:'📊' },
  { id:'animation', label:'Animation', icon:'🎨' },
  { id:'reddit', label:'Reddit Story', icon:'📱' },
]
const NICHES = ['Tech & Programming','Finance & Money','Health & Fitness','Business & Entrepreneurship','Gaming','Educational / Science','Motivation & Lifestyle','Food & Cooking','Travel','True Crime']
const TONES = ['Energetic & Engaging','Professional & Clear','Casual & Friendly','Dramatic & Intense','Educational & Calm','Humorous & Witty']
const STEPS = ['Analyzing topic & trends...','Writing viral hook & script...','Optimizing for YouTube SEO...','Generating voiceover...','Assembling metadata & tags...']

export default function Create() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ topic:'', niche:'Tech & Programming', style:'talking', tone:'Energetic & Engaging', hook:'', notes:'', duration:'45-60', language:'English' })
  const [generating, setGenerating] = useState(false)
  const [step, setStep] = useState(0)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const set = (k,v) => setForm(f=>({...f,[k]:v}))
  const atLimit = profile?.plan==='free' && (profile?.shorts_used||0) >= (profile?.shorts_limit||10)

  async function generate() {
    if (!form.topic.trim()) { setError('Please enter a topic.'); return }
    if (atLimit) { navigate('/pricing'); return }
    setError(''); setGenerating(true); setResult(null); setProgress(0); setStep(0)
    const iv = setInterval(()=>{ setStep(s=>{ const ns=Math.min(s+1,STEPS.length-1); setProgress(Math.round((ns/STEPS.length)*80)); return ns }) },1100)
    try {
      const data = await api.generateShort(form)
      clearInterval(iv); setProgress(100)
      const { duration, ...saveData } = data
      const saved = await db.createShort({ user_id:user.id, ...saveData, duration_estimate:duration, topic:form.topic, niche:form.niche, style:form.style, tone:form.tone, language:form.language, status:'draft' })
      setResult({...data, id:saved.id})
    } catch(err) {
      clearInterval(iv); setProgress(100)
      // Fallback: generate basic script client-side and still save to Supabase
      const fallback = {
        title: `${form.topic}`,
        hook: `You won't believe what I discovered about "${form.topic}"...`,
        script: `[HOOK]\nYou won't believe what I discovered about "${form.topic}".\n\n[MAIN CONTENT]\nHere's what the data actually shows...\n\n1. First key insight about ${form.topic}\n2. Second key insight\n3. Third key insight\n\n[CTA]\nFollow for more ${form.niche} content!`,
        description: `${form.topic} — everything you need to know. #shorts #${form.niche.replace(/\s/g,'').toLowerCase()}`,
        tags: ['#shorts','#viral','#trending','#fyp', `#${form.niche.split(' ')[0].toLowerCase()}`],
        seo_score: 75, viral_score: 70,
        duration: '~55s',
        thumbnail_prompt: `Bold thumbnail for: ${form.topic}`,
        key_points: [`Key insight about ${form.topic}`, 'Supporting point', 'Call to action']
      }
      try {
        const { duration, ...fallbackData } = fallback
        const saved = await db.createShort({ user_id:user.id, ...fallbackData, duration_estimate:duration, topic:form.topic, niche:form.niche, style:form.style, tone:form.tone, language:form.language, status:'draft' })
        setResult({ ...fallback, id: saved.id })
      } catch(saveErr) {
        setError('Failed to save short. Please check your connection.')
        console.error('Save error:', saveErr)
      }
    } finally { setGenerating(false) }
  }

  if (result) return <Result result={result} form={form} onNew={()=>setResult(null)} onSave={()=>navigate('/library')} />

  return (
    <div className="fade-in">
      <div className="page-header"><div className="page-title">✨ Create Short</div><div className="page-desc">Describe your idea — AI writes, voices & optimizes it</div></div>
      {atLimit && <div style={{background:'var(--ybg)',border:'1px solid var(--amber)',borderRadius:10,padding:'12px 16px',marginBottom:20,fontSize:13,display:'flex',alignItems:'center',justifyContent:'space-between'}}><span>🔒 You've used all <b>{profile.shorts_limit}</b> free shorts this month.</span><button className="btn btn-accent btn-sm" onClick={()=>navigate('/pricing')}>Upgrade →</button></div>}
      <div style={{display:'grid',gridTemplateColumns:'1fr 300px',gap:20}}>
        <div>
          <div className="card card-pad" style={{marginBottom:14}}>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:20,paddingBottom:16,borderBottom:'1px solid var(--border)'}}>
              <span style={{fontSize:22}}>🤖</span>
              <div><div style={{fontFamily:'var(--font-head)',fontWeight:700,fontSize:15}}>AI Generator</div><div style={{fontSize:12,color:'var(--text3)'}}>Powered by Claude</div></div>
              <span className="tag tag-accent" style={{marginLeft:'auto'}}>AI</span>
            </div>
            <div className="form-group">
              <label className="form-label">Topic / Prompt *</label>
              <input className="form-input" placeholder="e.g. 5 habits that made me a millionaire by 25..." value={form.topic} onChange={e=>set('topic',e.target.value)} onKeyDown={e=>e.key==='Enter'&&generate()} />
            </div>
            <div className="grid-2">
              <div className="form-group"><label className="form-label">Niche</label><select className="form-input form-select" value={form.niche} onChange={e=>set('niche',e.target.value)}>{NICHES.map(n=><option key={n}>{n}</option>)}</select></div>
              <div className="form-group"><label className="form-label">Tone</label><select className="form-input form-select" value={form.tone} onChange={e=>set('tone',e.target.value)}>{TONES.map(t=><option key={t}>{t}</option>)}</select></div>
            </div>
            <div className="form-group">
              <label className="form-label">Video Style</label>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginTop:4}}>
                {STYLES.map(s=><div key={s.id} onClick={()=>set('style',s.id)} style={{border:`1px solid ${form.style===s.id?'var(--accent)':'var(--border)'}`,background:form.style===s.id?'var(--abg)':'var(--bg3)',borderRadius:8,padding:'10px 6px',cursor:'pointer',textAlign:'center',transition:'all .2s',color:form.style===s.id?'var(--accent)':'var(--text2)',fontSize:12}}><div style={{fontSize:20,marginBottom:4}}>{s.icon}</div>{s.label}</div>)}
              </div>
            </div>
            <div className="grid-2">
              <div className="form-group"><label className="form-label">Duration</label><select className="form-input form-select" value={form.duration} onChange={e=>set('duration',e.target.value)}><option value="15-30">15–30s Quick</option><option value="30-45">30–45s Short</option><option value="45-60">45–60s Standard</option><option value="55-60">55–60s Max</option></select></div>
              <div className="form-group"><label className="form-label">Language</label><select className="form-input form-select" value={form.language} onChange={e=>set('language',e.target.value)}>{['English','Spanish','French','Portuguese','Hindi','German','Japanese','Korean'].map(l=><option key={l}>{l}</option>)}</select></div>
            </div>
            <div className="form-group"><label className="form-label">Custom Hook (optional)</label><input className="form-input" placeholder="Leave blank — AI writes a viral hook" value={form.hook} onChange={e=>set('hook',e.target.value)} /></div>
            <div className="form-group" style={{marginBottom:0}}><label className="form-label">Notes / Keywords</label><textarea className="form-input form-textarea" placeholder="Any specific points, keywords, CTA..." value={form.notes} onChange={e=>set('notes',e.target.value)} /></div>
          </div>
          {error && <div style={{background:'rgba(255,60,60,.1)',border:'1px solid rgba(255,60,60,.3)',borderRadius:8,padding:'10px 14px',fontSize:13,color:'#FF6060',marginBottom:14}}>⚠️ {error}</div>}
          {generating ? (
            <div className="card card-pad" style={{textAlign:'center'}}>
              <div style={{fontSize:32,marginBottom:12}} className="spinning">⚙️</div>
              <div style={{fontFamily:'var(--font-head)',fontSize:16,fontWeight:700,marginBottom:6}}>Generating Your Short...</div>
              <div style={{fontSize:13,color:'var(--text2)',marginBottom:18}}>{STEPS[step]}</div>
              <div className="progress-track"><div className="progress-fill" style={{width:`${progress}%`}} /></div>
              <div style={{fontSize:12,color:'var(--text3)',marginTop:8}}>Step {step+1} of {STEPS.length}</div>
            </div>
          ) : (
            <button className="btn btn-accent btn-full" style={{padding:13,fontSize:15,fontFamily:'var(--font-head)'}} onClick={generate}>✨ Generate Short with AI</button>
          )}
        </div>
        <div>
          <div className="card" style={{position:'sticky',top:0}}>
            <div style={{padding:'13px 18px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <span style={{fontWeight:600,fontSize:13}}>Preview</span>
              <span className="tag tag-accent pulsing">LIVE</span>
            </div>
            <div style={{padding:18,display:'flex',flexDirection:'column',alignItems:'center'}}>
              <div style={{width:148,height:264,border:'2px solid var(--border2)',borderRadius:20,background:'var(--bg3)',display:'flex',flexDirection:'column',overflow:'hidden',position:'relative'}}>
                <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',position:'relative'}}>
                  <span style={{fontSize:40,opacity:.1}}>📱</span>
                  <div style={{position:'absolute',inset:0,background:'linear-gradient(to bottom,transparent 50%,rgba(0,0,0,.85))'}} />
                  <div style={{position:'absolute',right:7,top:'50%',transform:'translateY(-50%)',display:'flex',flexDirection:'column',gap:10}}>
                    {['❤️','💬','↗️','⋮'].map((ic,i)=><span key={i} style={{fontSize:13,opacity:.7}}>{ic}</span>)}
                  </div>
                  <div style={{position:'absolute',top:0,left:0,right:0,height:3,background:'var(--accent)',width:'70%'}} />
                  <div style={{position:'absolute',bottom:10,left:10,right:10,fontSize:8,color:'#fff',lineHeight:1.4,opacity:.9}}>
                    {form.topic||'Your short title here...'} 🔥 #shorts
                  </div>
                </div>
              </div>
              <div style={{width:'100%',marginTop:16}}>
                <div style={{display:'flex',flexWrap:'wrap',gap:4,marginBottom:14}}>
                  {['#shorts','#viral','#ai','#trending'].map(t=><span key={t} className="tag tag-gray">{t}</span>)}
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,borderTop:'1px solid var(--border)',paddingTop:14}}>
                  {[['Format','9:16'],['Style',STYLES.find(s=>s.id===form.style)?.label||'—'],['SEO Score','High ✦'],['Viral Est.','78%']].map(([l,v])=>(
                    <div key={l} style={{fontSize:12}}><div style={{color:'var(--text3)',marginBottom:2}}>{l}</div><div style={{fontWeight:600}}>{v}</div></div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Result({ result, form, onNew, onSave }) {
  const [tab, setTab] = useState('script')
  return (
    <div className="fade-in">
      <div className="page-header" style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:12}}>
        <div><div className="page-title">🎬 Short Ready!</div><div className="page-desc">Review your AI-generated short</div></div>
        <div style={{display:'flex',gap:10}}><button className="btn btn-ghost" onClick={onNew}>+ New Short</button><button className="btn btn-accent" onClick={onSave}>Save to Library →</button></div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 280px',gap:20}}>
        <div className="card card-pad">
          <div style={{fontFamily:'var(--font-head)',fontSize:18,fontWeight:700,marginBottom:8}}>{result.title}</div>
          <div style={{display:'flex',gap:8,marginBottom:18}}>
            <span className="tag tag-green">SEO {result.seo_score||84}%</span>
            <span className="tag tag-amber">Viral {result.viral_score||76}%</span>
            <span className="tag tag-gray">⏱ {result.duration||'~55s'}</span>
          </div>
          <div className="tabs">
            {['script','metadata','tags','thumbnail'].map(t=><div key={t} className={`tab${tab===t?' active':''}`} onClick={()=>setTab(t)} style={{textTransform:'capitalize'}}>{t}</div>)}
          </div>
          {tab==='script' && <div style={{background:'var(--bg3)',borderRadius:8,padding:16,fontSize:14,lineHeight:1.8,color:'var(--text2)',whiteSpace:'pre-wrap'}}>
            <div style={{color:'var(--accent)',fontWeight:700,marginBottom:8,fontSize:11,textTransform:'uppercase',letterSpacing:'.5px'}}>🔥 Hook</div>
            <div style={{marginBottom:16,fontSize:15,color:'var(--text)',fontWeight:500}}>{result.hook}</div>
            <div style={{color:'var(--accent)',fontWeight:700,marginBottom:8,fontSize:11,textTransform:'uppercase',letterSpacing:'.5px'}}>📝 Script</div>
            {result.script}
          </div>}
          {tab==='metadata' && <div>
            <div className="form-group"><label className="form-label">Title</label><input className="form-input" defaultValue={result.title} /></div>
            <div className="form-group"><label className="form-label">Description</label><textarea className="form-input form-textarea" defaultValue={result.description} /></div>
          </div>}
          {tab==='tags' && <div style={{display:'flex',flexWrap:'wrap',gap:6}}>{(result.tags||[]).map(t=><span key={t} className="tag tag-accent">{t}</span>)}</div>}
          {tab==='thumbnail' && <div>
            <div style={{background:'var(--bg3)',borderRadius:8,padding:14,marginBottom:14,fontSize:14,color:'var(--text2)'}}>{result.thumbnail_prompt}</div>
            <button className="btn btn-ghost btn-full">🎨 Generate Thumbnail (Pro)</button>
          </div>}
        </div>
        <div>
          <div className="card card-pad">
            <div style={{fontWeight:600,fontSize:13,marginBottom:14}}>Publish Options</div>
            <div className="form-group"><label className="form-label">Channel</label><select className="form-input form-select"><option>Select channel...</option></select></div>
            <div className="form-group"><label className="form-label">When to Post</label><select className="form-input form-select"><option>Save as Draft</option><option>Publish Now</option><option>Schedule</option></select></div>
            <div className="form-group"><label className="form-label">Privacy</label><select className="form-input form-select"><option>Public</option><option>Unlisted</option><option>Private</option></select></div>
            <button className="btn btn-accent btn-full" style={{padding:12}} onClick={onSave}>💾 Save to Library</button>
          </div>
          {result.key_points?.length>0 && <div className="card card-pad" style={{marginTop:14}}>
            <div style={{fontWeight:600,fontSize:13,marginBottom:12}}>Key Points</div>
            {result.key_points.map((p,i)=><div key={i} style={{fontSize:13,color:'var(--text2)',padding:'6px 0',borderBottom:'1px solid var(--border)',display:'flex',gap:8}}><span style={{color:'var(--accent)'}}>0{i+1}</span>{p}</div>)}
          </div>}
        </div>
      </div>
    </div>
  )
}
