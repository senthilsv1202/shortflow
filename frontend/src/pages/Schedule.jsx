import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth.jsx'
import { db } from '../lib/supabase.js'

const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
const TIMES = ['6am','9am','12pm','3pm','6pm','9pm']
const DEFAULT_ACTIVE = [[0,1],[0,2],[2,1],[4,3],[4,1]]

export default function Schedule() {
  const { user } = useAuth()
  const [slots, setSlots] = useState(()=>{ const m={}; DEFAULT_ACTIVE.forEach(([d,t])=>{ m[`${d}-${t}`]=true }); return m })
  const [upcoming, setUpcoming] = useState([])
  const [saved, setSaved] = useState(false)

  useEffect(()=>{ if(user) db.getSchedule(user.id).then(setUpcoming).catch(()=>{}) },[user])

  function toggle(d,t) { setSlots(s=>({...s,[`${d}-${t}`]:!s[`${d}-${t}`]})) }
  function saveSchedule() { setSaved(true); setTimeout(()=>setSaved(false),2000) }

  const activeCount = Object.values(slots).filter(Boolean).length

  return (
    <div className="fade-in">
      <div className="page-header" style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between'}}>
        <div><div className="page-title">📅 Schedule</div><div className="page-desc">{activeCount} time slots active this week</div></div>
        <div style={{display:'flex',gap:10}}>
          <button className="btn btn-ghost" onClick={()=>{ const m={}; DEFAULT_ACTIVE.forEach(([d,t])=>m[`${d}-${t}`]=true); setSlots(m) }}>Auto-Optimal</button>
          <button className={`btn ${saved?'btn-ghost':'btn-accent'}`} onClick={saveSchedule}>{saved?'✅ Saved!':'Save Schedule'}</button>
        </div>
      </div>

      <div className="card card-pad" style={{marginBottom:20}}>
        <div style={{fontWeight:600,fontSize:13,marginBottom:16,color:'var(--text2)'}}>Click slots to toggle auto-posting times</div>
        <div style={{display:'grid',gridTemplateColumns:`80px repeat(7,1fr)`,gap:6}}>
          <div />
          {DAYS.map(d=><div key={d} style={{textAlign:'center',fontSize:11,color:'var(--text3)',fontWeight:600,padding:'4px 0'}}>{d}</div>)}
          {TIMES.map((time,ti)=>(
            <>
              <div key={`t${ti}`} style={{fontSize:11,color:'var(--text3)',display:'flex',alignItems:'center',justifyContent:'flex-end',paddingRight:10}}>{time}</div>
              {DAYS.map((_,di)=>{
                const active = slots[`${di}-${ti}`]
                return (
                  <div key={`${di}-${ti}`} onClick={()=>toggle(di,ti)} style={{height:36,borderRadius:6,border:`1px solid ${active?'var(--accent)':'var(--border)'}`,background:active?'var(--abg)':'transparent',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,color:active?'var(--accent)':'var(--text3)',transition:'all .2s',fontWeight:active?700:400}}>
                    {active?'✓':''}
                  </div>
                )
              })}
            </>
          ))}
        </div>
      </div>

      <div className="grid-2" style={{marginBottom:20}}>
        <div className="card card-pad">
          <div style={{fontWeight:700,fontFamily:'var(--font-head)',fontSize:14,marginBottom:16}}>Automation Settings</div>
          <div className="form-group"><label className="form-label">Default Channel</label><select className="form-input form-select"><option>Select channel...</option><option>@TechWithJack</option></select></div>
          <div className="form-group"><label className="form-label">Posts per Week</label><select className="form-input form-select"><option>3 / week</option><option>5 / week</option><option>Daily</option><option>2x Daily (Pro)</option></select></div>
          <div className="form-group"><label className="form-label">Auto-Post Delay</label><select className="form-input form-select"><option>Post immediately</option><option>15 min review window</option><option>1 hour review</option></select></div>
          <div className="form-group" style={{marginBottom:0}}><label className="form-label">Timezone</label><select className="form-input form-select"><option>America/New_York</option><option>America/Los_Angeles</option><option>UTC</option><option>Europe/London</option><option>Asia/Singapore</option></select></div>
        </div>
        <div className="card card-pad">
          <div style={{fontWeight:700,fontFamily:'var(--font-head)',fontSize:14,marginBottom:16}}>📋 Upcoming Queue</div>
          {upcoming.length>0 ? upcoming.slice(0,5).map((p,i)=>(
            <div key={i} style={{display:'flex',gap:12,padding:'10px 0',borderBottom:'1px solid var(--border)'}}>
              <div style={{fontSize:24}}>{p.shorts?.emoji||'🎬'}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:500}}>{p.shorts?.title||'Untitled'}</div>
                <div style={{fontSize:11,color:'var(--text3)',marginTop:2}}>{new Date(p.scheduled_at).toLocaleString()}</div>
              </div>
              <button className="btn btn-ghost btn-sm">✕</button>
            </div>
          )) : (
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {[['Build a SaaS in 30 Days','Tomorrow 9:00 AM'],['5 Money Habits','Wed 9:00 AM'],['AI Tools for Creators','Fri 9:00 AM']].map(([t,d],i)=>(
                <div key={i} style={{display:'flex',gap:10,padding:'9px 0',borderBottom:'1px solid var(--border)'}}>
                  <span className="tag tag-blue" style={{fontSize:9,flexShrink:0}}>{d}</span>
                  <span style={{fontSize:13,color:'var(--text2)'}}>{t}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card card-pad" style={{borderColor:'var(--accent)'}}>
        <div style={{display:'flex',alignItems:'center',gap:16}}>
          <span style={{fontSize:28}}>⚡</span>
          <div style={{flex:1}}>
            <div style={{fontWeight:700,marginBottom:3}}>Auto-Generate + Post</div>
            <div style={{fontSize:13,color:'var(--text3)'}}>ShortFlow can automatically generate AND post shorts based on trending topics in your niche. Zero manual effort.</div>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:10,flexShrink:0}}>
            <span style={{fontSize:12,color:'var(--text3)'}}>Pro feature</span>
            <a href="/pricing" className="btn btn-accent btn-sm">Enable →</a>
          </div>
        </div>
      </div>
    </div>
  )
}
