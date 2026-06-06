import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth.jsx'
import { db } from '../lib/supabase.js'

const STATUSES = ['all','draft','published','scheduled','failed']
const MOCK = [
  {id:1,title:'10 Python Tips That Will Blow Your Mind',status:'published',views:42100,likes:1840,niche:'Tech & Programming',created_at:'2024-01-15',emoji:'🔥',viral_score:88,seo_score:91},
  {id:2,title:'Why Developers Fail at Coding Interviews',status:'published',views:28400,likes:1200,niche:'Tech & Programming',created_at:'2024-01-14',emoji:'💡',viral_score:74,seo_score:82},
  {id:3,title:'Build a SaaS in 30 Days — Full Roadmap',status:'scheduled',views:0,likes:0,niche:'Business',created_at:'2024-01-13',emoji:'🚀',viral_score:81,seo_score:88},
  {id:4,title:'The Dark Side of Social Media Algorithms',status:'published',views:91700,likes:4200,niche:'Tech & Programming',created_at:'2024-01-12',emoji:'📱',viral_score:94,seo_score:90},
  {id:5,title:'AI Tools Every Creator Needs in 2025',status:'draft',views:0,likes:0,niche:'Tech & Programming',created_at:'2024-01-11',emoji:'🧠',viral_score:79,seo_score:85},
  {id:6,title:'5 Money Habits Nobody Teaches You',status:'published',views:67300,likes:3100,niche:'Finance',created_at:'2024-01-10',emoji:'💰',viral_score:92,seo_score:87},
]
const STATUS_COLORS = { published:{color:'#22C97A',bg:'rgba(34,201,122,.12)'}, draft:{color:'var(--text3)',bg:'var(--bg4)'}, scheduled:{color:'#4488FF',bg:'rgba(68,136,255,.12)'}, failed:{color:'#FF6060',bg:'rgba(255,60,60,.12)'} }

export default function Library() {
  const { user } = useAuth()
  const [shorts, setShorts] = useState([])
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [view, setView] = useState('grid')

  useEffect(()=>{ if(user) db.getShorts(user.id).then(d=>setShorts(d.length?d:MOCK)).catch(()=>setShorts(MOCK)) },[user])

  const filtered = shorts.filter(s=>{
    if (filter!=='all' && s.status!==filter) return false
    if (search && !s.title.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <div className="fade-in">
      <div className="page-header">
        <div className="page-title">📁 My Library</div>
        <div className="page-desc">{shorts.length} shorts total</div>
      </div>
      <div style={{display:'flex',gap:12,marginBottom:20,flexWrap:'wrap',alignItems:'center'}}>
        <input className="form-input" style={{maxWidth:280}} placeholder="Search shorts..." value={search} onChange={e=>setSearch(e.target.value)} />
        <div style={{display:'flex',gap:6,flex:1}}>
          {STATUSES.map(s=><button key={s} className={`btn ${filter===s?'btn-accent':'btn-ghost'} btn-sm`} style={{textTransform:'capitalize'}} onClick={()=>setFilter(s)}>{s}</button>)}
        </div>
        <div style={{display:'flex',gap:4}}>
          <button className={`btn btn-sm ${view==='grid'?'btn-accent':'btn-ghost'}`} onClick={()=>setView('grid')}>⊞</button>
          <button className={`btn btn-sm ${view==='list'?'btn-accent':'btn-ghost'}`} onClick={()=>setView('list')}>☰</button>
        </div>
      </div>
      {filtered.length===0 ? <div className="empty"><div className="empty-icon">📁</div><div className="empty-text">No shorts found</div></div> : (
        view==='grid' ? (
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14}}>
            {filtered.map(s=>(
              <div key={s.id} className="video-card">
                <div style={{height:120,background:'var(--bg3)',display:'flex',alignItems:'center',justifyContent:'center',position:'relative',fontSize:36,opacity:.2}}>
                  {s.emoji||'🎬'}
                  <div style={{position:'absolute',top:8,right:8}}><span className="tag" style={{fontSize:10,background:STATUS_COLORS[s.status]?.bg,color:STATUS_COLORS[s.status]?.color}}>{s.status}</span></div>
                </div>
                <div style={{padding:'11px 13px'}}>
                  <div style={{fontSize:13,fontWeight:500,marginBottom:6,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{s.title}</div>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'var(--text3)'}}>
                    <span>👁 {s.views?.toLocaleString()||'—'}</span>
                    <span>❤️ {s.likes?.toLocaleString()||'—'}</span>
                    <span>{new Date(s.created_at).toLocaleDateString()}</span>
                  </div>
                  {s.viral_score && <div style={{display:'flex',gap:6,marginTop:8}}>
                    <span className="tag tag-accent" style={{fontSize:10}}>Viral {s.viral_score}%</span>
                    <span className="tag tag-green" style={{fontSize:10}}>SEO {s.seo_score}%</span>
                  </div>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card">
            <table className="data-table">
              <thead><tr><th>Title</th><th>Status</th><th>Views</th><th>Likes</th><th>Niche</th><th>Date</th><th>Actions</th></tr></thead>
              <tbody>
                {filtered.map(s=>(
                  <tr key={s.id}>
                    <td style={{maxWidth:280,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',color:'var(--text)'}}>{s.title}</td>
                    <td><span className="tag" style={{fontSize:10,background:STATUS_COLORS[s.status]?.bg,color:STATUS_COLORS[s.status]?.color}}>{s.status}</span></td>
                    <td>{s.views?.toLocaleString()||'—'}</td>
                    <td>{s.likes?.toLocaleString()||'—'}</td>
                    <td>{s.niche||'—'}</td>
                    <td>{new Date(s.created_at).toLocaleDateString()}</td>
                    <td><button className="btn btn-ghost btn-sm">Edit</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  )
}
