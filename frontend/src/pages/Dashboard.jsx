import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.jsx'
import { db } from '../lib/supabase.js'

const MOCK_STATS = [
  { label:'Total Views', value:'284K', change:'+18%', up:true, icon:'👁' },
  { label:'Shorts Created', value:'47', change:'+6 this month', up:true, icon:'🎬' },
  { label:'New Subscribers', value:'1,240', change:'+22%', up:true, icon:'👥' },
  { label:'Est. Revenue', value:'$38', change:'Upgrade to track', up:null, icon:'💰' },
]
const MOCK_ACTIVITY = [
  { icon:'✅', bg:'rgba(34,201,122,.1)', color:'#22C97A', text:'Short published to @TechWithJack', sub:'"10 Python Tips" — 42K views in 2h', time:'2h ago' },
  { icon:'📅', bg:'rgba(68,136,255,.1)', color:'#4488FF', text:'3 Shorts scheduled for next week', sub:'Mon, Wed, Fri at 9:00 AM', time:'5h ago' },
  { icon:'✨', bg:'rgba(255,179,64,.1)', color:'#FFB340', text:'AI generated script for "Build a SaaS"', sub:'Script + voiceover ready for review', time:'1d ago' },
  { icon:'📈', bg:'rgba(168,85,247,.1)', color:'#A855F7', text:'Trending topic detected: AI Agents', sub:'High search volume — great time to post', time:'2d ago' },
]
const MOCK_SHORTS = [
  { title:'10 Python Tips That Will Blow Your Mind', emoji:'🔥', views:'42.1K', status:'published', statusColor:'#22C97A', statusBg:'rgba(34,201,122,.12)', time:'2h ago' },
  { title:'Why Most Developers Fail at Coding Interviews', emoji:'💡', views:'28.4K', status:'published', statusColor:'#22C97A', statusBg:'rgba(34,201,122,.12)', time:'1d ago' },
  { title:'Build a SaaS in 30 Days — Full Roadmap', emoji:'🚀', views:'—', status:'scheduled', statusColor:'#4488FF', statusBg:'rgba(68,136,255,.12)', time:'Tomorrow 9am' },
  { title:'The Dark Side of Social Media Algorithms', emoji:'📱', views:'91.7K', status:'published', statusColor:'#22C97A', statusBg:'rgba(34,201,122,.12)', time:'3d ago' },
  { title:'AI Tools Every Creator Needs in 2025', emoji:'🧠', views:'—', status:'draft', statusColor:'var(--text3)', statusBg:'var(--bg4)', time:'Draft' },
]

export default function Dashboard() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [shorts, setShorts] = useState([])

  useEffect(()=>{
    if (user) db.getShorts(user.id).then(setShorts).catch(()=>{})
  },[user])

  const displayShorts = shorts.length > 0 ? shorts.slice(0,5) : MOCK_SHORTS

  return (
    <div className="fade-in">
      <div className="page-header">
        <div className="page-title">Dashboard</div>
        <div className="page-desc">Welcome back{profile?.full_name?`, ${profile.full_name.split(' ')[0]}`:''}! Here's your channel overview.</div>
      </div>

      <div className="stats-grid" style={{marginBottom:28}}>
        {MOCK_STATS.map(s=>(
          <div key={s.label} className="stat-card">
            <div className="stat-label"><span>{s.icon}</span>{s.label}</div>
            <div className="stat-value">{s.value}</div>
            <div className={`stat-change ${s.up===true?'stat-up':s.up===false?'stat-dn':''}`} style={s.up===null?{color:'var(--text3)'}:{}}>
              {s.up!==null?`${s.up?'↑':'↓'} `:'🔒 '}{s.change}
            </div>
          </div>
        ))}
      </div>

      <div className="section-header">
        <div className="section-title">Recent Shorts</div>
        <button className="btn btn-ghost btn-sm" onClick={()=>navigate('/library')}>View All →</button>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14,marginBottom:28}}>
        {displayShorts.map((s,i)=>(
          <div key={i} className="video-card">
            <div style={{height:120,background:'var(--bg3)',display:'flex',alignItems:'center',justifyContent:'center',position:'relative',fontSize:38,opacity:.25}}>
              {s.emoji || '🎬'}
              <div style={{position:'absolute',top:8,right:8}}>
                <span className="tag" style={{background:s.statusBg,color:s.statusColor,fontSize:10}}>{s.status}</span>
              </div>
            </div>
            <div style={{padding:'11px 13px'}}>
              <div style={{fontSize:13,fontWeight:500,marginBottom:5,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{s.title}</div>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'var(--text3)'}}>
                <span>👁 {s.views}</span><span>{s.time}</span>
              </div>
            </div>
          </div>
        ))}
        <div className="video-card" onClick={()=>navigate('/create')} style={{border:'1px dashed var(--border2)'}}>
          <div style={{height:120,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',color:'var(--text3)',gap:6,fontSize:13}}>
            <span style={{fontSize:28}}>✨</span>Create New
          </div>
          <div style={{padding:'11px 13px'}}>
            <div style={{fontSize:13,color:'var(--text3)'}}>Start with AI prompt</div>
            <div style={{fontSize:11,color:'var(--accent)',marginTop:4}}>Generate →</div>
          </div>
        </div>
      </div>

      <div className="section-header"><div className="section-title">Recent Activity</div></div>
      <div className="activity-list">
        {MOCK_ACTIVITY.map((a,i)=>(
          <div key={i} className="activity-item">
            <div className="activity-icon" style={{background:a.bg,color:a.color}}>{a.icon}</div>
            <div className="activity-text">{a.text}<div className="activity-sub">{a.sub}</div></div>
            <div className="activity-time">{a.time}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
