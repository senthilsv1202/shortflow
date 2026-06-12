import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth.jsx'
import { db } from '../lib/supabase.js'
import { api } from '../lib/api.js'

const MOCK_CHANNELS = [
  { id:1, name:'TechWithJack', handle:'@techwithjaack', subscribers:12400, total_views:1420000, video_count:47, ypp_eligible:true, emoji:'📺' },
  { id:2, name:'Daily Facts', handle:'@dailyfactsworld', subscribers:3200, total_views:980000, video_count:32, ypp_eligible:false, emoji:'🌍' },
]

export default function Channels() {
  const { user } = useAuth()
  const [channels, setChannels] = useState([])
  const [connecting, setConnecting] = useState(false)

  useEffect(()=>{ if(user) db.getChannels(user.id).then(d=>setChannels(d)).catch(err=>console.error('getChannels error:',err)) },[user])

  async function connectYouTube() {
    setConnecting(true)
    try {
      const { url } = await api.getYouTubeAuthUrl()
      window.location.href = url
    } catch {
      alert('Set up YOUTUBE_CLIENT_ID in backend .env to connect YouTube. See launch guide.')
    } finally { setConnecting(false) }
  }

  return (
    <div className="fade-in">
      <div className="page-header" style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between'}}>
        <div><div className="page-title">▶️ Channels</div><div className="page-desc">{channels.length} connected channels</div></div>
        <button className="btn btn-accent" onClick={connectYouTube} disabled={connecting}>{connecting?'Connecting...':'+ Connect YouTube'}</button>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:14,marginBottom:24}}>
        {channels.map(ch=>(
          <div key={ch.id} className="card card-pad">
            <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:14}}>
              <div style={{width:44,height:44,borderRadius:12,background:'var(--abg)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22}}>{ch.emoji||'📺'}</div>
              <div>
                <div style={{fontWeight:700,fontSize:15}}>{ch.name}</div>
                <div style={{fontSize:12,color:'var(--text3)'}}>{ch.handle}</div>
              </div>
              {ch.ypp_eligible && <span className="tag tag-green" style={{marginLeft:'auto',fontSize:10}}>YPP Ready ✓</span>}
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:14}}>
              {[['Subscribers',ch.subscribers?.toLocaleString()],[`Views`,(ch.total_views/1000).toFixed(0)+'K'],['Shorts',ch.video_count]].map(([l,v])=>(
                <div key={l} style={{textAlign:'center',background:'var(--bg3)',borderRadius:8,padding:'10px 8px'}}>
                  <div style={{fontFamily:'var(--font-head)',fontWeight:700,fontSize:16}}>{v}</div>
                  <div style={{fontSize:11,color:'var(--text3)'}}>{l}</div>
                </div>
              ))}
            </div>
            <div style={{display:'flex',gap:8}}>
              <button className="btn btn-ghost btn-sm" style={{flex:1}}>📊 Stats</button>
              <button className="btn btn-ghost btn-sm" style={{flex:1}}>⚙️ Settings</button>
              {ch.ypp_eligible && <button className="btn btn-accent btn-sm">Apply YPP</button>}
            </div>
          </div>
        ))}
        <div onClick={connectYouTube} style={{border:'1px dashed var(--border2)',borderRadius:12,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',cursor:'pointer',padding:30,gap:8,color:'var(--text3)',transition:'all .2s',minHeight:160}} onMouseEnter={e=>e.currentTarget.style.color='var(--accent)'} onMouseLeave={e=>e.currentTarget.style.color='var(--text3)'}>
          <span style={{fontSize:32}}>➕</span>
          <span style={{fontSize:13}}>Add YouTube Channel</span>
          <span style={{fontSize:11}}>OAuth 2.0 connection</span>
        </div>
      </div>

      <div style={{fontFamily:'var(--font-head)',fontSize:16,fontWeight:700,marginBottom:16}}>💰 Monetization Status</div>
      <div className="activity-list">
        {channels.map(ch=>(
          <div key={ch.id} className="activity-item">
            <div className="activity-icon" style={{background:ch.ypp_eligible?'rgba(34,201,122,.1)':'rgba(255,179,64,.1)',color:ch.ypp_eligible?'#22C97A':'#FFB340'}}>
              {ch.ypp_eligible?'✅':'⏳'}
            </div>
            <div className="activity-text">
              {ch.handle} — {ch.ypp_eligible?'YPP Eligible ✓':'In Progress'}
              <div className="activity-sub">
                {ch.ypp_eligible?`${ch.subscribers?.toLocaleString()} subs · Meets all requirements`:`Need ${Math.max(0,1000-ch.subscribers)} more subscribers for YPP`}
              </div>
            </div>
            {ch.ypp_eligible
              ? <button className="btn btn-accent btn-sm" onClick={()=>window.open('https://studio.youtube.com','_blank')}>Apply Now</button>
              : <div style={{fontSize:12,color:'var(--text3)'}}>{ch.subscribers?.toLocaleString()} / 1,000</div>
            }
          </div>
        ))}
      </div>

      <div className="card card-pad" style={{marginTop:20}}>
        <div style={{fontWeight:700,fontFamily:'var(--font-head)',fontSize:14,marginBottom:12}}>📋 YouTube Partnership Requirements</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:12}}>
          {[['1,000 Subscribers','Standard YPP threshold'],['4,000 Watch Hours','Or 10M Shorts views in 90 days'],['No Community Violations','Clean account standing'],['2-Step Verification','Google account security']].map(([req,desc])=>(
            <div key={req} style={{display:'flex',gap:10,padding:'10px 12px',background:'var(--bg3)',borderRadius:8}}>
              <span style={{color:'var(--green)'}}>✓</span>
              <div><div style={{fontSize:13,fontWeight:500}}>{req}</div><div style={{fontSize:11,color:'var(--text3)'}}>{desc}</div></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
