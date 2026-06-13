import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth.jsx'
import { db, supabase } from '../lib/supabase.js'
import { api } from '../lib/api.js'

const STATUSES = ['all','draft','published','scheduled','failed']
const STATUS_COLORS = {
  published: { color:'#22C97A', bg:'rgba(34,201,122,.12)' },
  draft:     { color:'var(--text3)', bg:'var(--bg4)' },
  scheduled: { color:'#4488FF', bg:'rgba(68,136,255,.12)' },
  failed:    { color:'#FF6060', bg:'rgba(255,60,60,.12)' }
}

export default function Library() {
  const { user } = useAuth()
  const [shorts, setShorts] = useState([])
  const [channels, setChannels] = useState([])
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [view, setView] = useState('grid')
  const [selected, setSelected] = useState(null)
  const [publishing, setPublishing] = useState(false)
  const [generatingVideo, setGeneratingVideo] = useState(false)
  const [selectedVoice, setSelectedVoice] = useState('male')
  const [publishForm, setPublishForm] = useState({ channel_id:'', privacy:'public' })

  // Popular ElevenLabs voices
  const VOICES = [
    { id: 'TxGEqnHWrfWFTfGW9XjX', label: 'Josh', gender: 'male', description: 'Deep & authoritative' },
    { id: 'VR6AewLTigWG4xSOukaG', label: 'Arnold', gender: 'male', description: 'Strong & confident' },
    { id: 'pNInz6obpgDQGcFmaJgB', label: 'Adam', gender: 'male', description: 'Calm & professional' },
    { id: '21m00Tcm4TlvDq8ikWAM', label: 'Rachel', gender: 'female', description: 'Warm & friendly' },
    { id: 'AZnzlk1XvdvUeBnXmlld', label: 'Domi', gender: 'female', description: 'Energetic & young' },
    { id: 'EXAVITQu4vr4xnSDxMaL', label: 'Bella', gender: 'female', description: 'Soft & expressive' },
  ]
  const [toast, setToast] = useState('')

  useEffect(() => {
    if (user) {
      db.getShorts(user.id).then(d => setShorts(d))
      db.getChannels(user.id).then(d => setChannels(d))
    }
  }, [user])

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  async function handlePublish() {
    if (!selected) return
    if (!publishForm.channel_id) { showToast('Please select a channel'); return }
    setPublishing(true)
    try {
      await api.publishNow(selected.id, publishForm)
      await db.updateShort(selected.id, { status: 'published' })
      setShorts(s => s.map(x => x.id === selected.id ? { ...x, status:'published' } : x))
      setSelected(null)
      showToast('✅ Published to YouTube!')
    } catch(err) {
      showToast('❌ ' + err.message)
    } finally {
      setPublishing(false)
    }
  }

  async function handleGenerateVideo() {
    if (!selected) return
    setGeneratingVideo(true)
    showToast('🎬 Video generation started — this takes 1-2 minutes...')
    try {
      await api.generateVideo(selected.id, { voice_id: selectedVoice })
      // Poll every 5s until status changes
      const poll = setInterval(async () => {
        try {
          const s = await api.getVideoStatus(selected.id)
          if (s.status === 'ready') {
            clearInterval(poll)
            setGeneratingVideo(false)
            setShorts(prev => prev.map(x => x.id === selected.id ? { ...x, ...s } : x))
            setSelected(prev => ({ ...prev, ...s }))
            showToast('✅ Video ready! You can now publish.')
          } else if (s.status === 'failed') {
            clearInterval(poll)
            setGeneratingVideo(false)
            showToast('❌ Video generation failed. Check Railway logs.')
          }
        } catch { clearInterval(poll); setGeneratingVideo(false) }
      }, 5000)
    } catch(err) {
      setGeneratingVideo(false)
      showToast('❌ ' + err.message)
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this short?')) return
    await db.deleteShort(id)
    setShorts(s => s.filter(x => x.id !== id))
    setSelected(null)
  }

  const filtered = shorts.filter(s => {
    if (filter !== 'all' && s.status !== filter) return false
    if (search && !s.title.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <div className="fade-in">
      {/* Toast */}
      {toast && (
        <div style={{position:'fixed',top:20,right:20,background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:10,padding:'12px 18px',fontSize:13,zIndex:999,boxShadow:'0 4px 20px rgba(0,0,0,.3)'}}>
          {toast}
        </div>
      )}

      <div className="page-header">
        <div className="page-title">📁 My Library</div>
        <div className="page-desc">{shorts.length} shorts total</div>
      </div>

      <div style={{display:'flex',gap:12,marginBottom:20,flexWrap:'wrap',alignItems:'center'}}>
        <input className="form-input" style={{maxWidth:280}} placeholder="Search shorts..." value={search} onChange={e=>setSearch(e.target.value)} />
        <div style={{display:'flex',gap:6,flex:1}}>
          {STATUSES.map(s=>(
            <button key={s} className={`btn ${filter===s?'btn-accent':'btn-ghost'} btn-sm`} style={{textTransform:'capitalize'}} onClick={()=>setFilter(s)}>{s}</button>
          ))}
        </div>
        <div style={{display:'flex',gap:4}}>
          <button className={`btn btn-sm ${view==='grid'?'btn-accent':'btn-ghost'}`} onClick={()=>setView('grid')}>⊞</button>
          <button className={`btn btn-sm ${view==='list'?'btn-accent':'btn-ghost'}`} onClick={()=>setView('list')}>☰</button>
        </div>
      </div>

      {shorts.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">📁</div>
          <div className="empty-text">No shorts yet — go create one!</div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty"><div className="empty-icon">🔍</div><div className="empty-text">No shorts match your filter</div></div>
      ) : view === 'grid' ? (
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14}}>
          {filtered.map(s=>(
            <div key={s.id} className="video-card" style={{cursor:'pointer'}} onClick={()=>setSelected(s)}>
              <div style={{height:120,background:'var(--bg3)',display:'flex',alignItems:'center',justifyContent:'center',position:'relative',fontSize:36,opacity:.2}}>
                🎬
                <div style={{position:'absolute',top:8,right:8}}>
                  <span className="tag" style={{fontSize:10,background:STATUS_COLORS[s.status]?.bg,color:STATUS_COLORS[s.status]?.color}}>{s.status}</span>
                </div>
              </div>
              <div style={{padding:'11px 13px'}}>
                <div style={{fontSize:13,fontWeight:500,marginBottom:6,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{s.title}</div>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'var(--text3)'}}>
                  <span>👁 {s.views?.toLocaleString()||'0'}</span>
                  <span>❤️ {s.likes?.toLocaleString()||'0'}</span>
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
                  <td>{s.views?.toLocaleString()||'0'}</td>
                  <td>{s.likes?.toLocaleString()||'0'}</td>
                  <td>{s.niche||'—'}</td>
                  <td>{new Date(s.created_at).toLocaleDateString()}</td>
                  <td style={{display:'flex',gap:6}}>
                    <button className="btn btn-ghost btn-sm" onClick={()=>setSelected(s)}>View</button>
                    {s.status==='draft' && <button className="btn btn-accent btn-sm" onClick={()=>setSelected(s)}>Publish</button>}
                    <button className="btn btn-sm" style={{background:'rgba(255,60,60,.15)',color:'#FF6060',border:'none'}} onClick={()=>handleDelete(s.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Short Detail / Publish Modal */}
      {selected && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.7)',zIndex:100,display:'flex',alignItems:'center',justifyContent:'center',padding:20}} onClick={e=>{if(e.target===e.currentTarget)setSelected(null)}}>
          <div style={{background:'var(--bg2)',borderRadius:16,padding:28,width:'100%',maxWidth:600,maxHeight:'85vh',overflowY:'auto',border:'1px solid var(--border)'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:20}}>
              <div>
                <div style={{fontSize:16,fontWeight:700,marginBottom:4}}>{selected.title}</div>
                <span className="tag" style={{fontSize:10,background:STATUS_COLORS[selected.status]?.bg,color:STATUS_COLORS[selected.status]?.color}}>{selected.status}</span>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={()=>setSelected(null)}>✕</button>
            </div>

            {/* Script */}
            {selected.script && (
              <div style={{marginBottom:20}}>
                <div style={{fontSize:12,fontWeight:600,color:'var(--text3)',marginBottom:8,textTransform:'uppercase',letterSpacing:.5}}>Script</div>
                <div style={{background:'var(--bg3)',borderRadius:8,padding:14,fontSize:13,lineHeight:1.7,whiteSpace:'pre-wrap',color:'var(--text)'}}>{selected.script}</div>
              </div>
            )}

            {/* Tags */}
            {selected.tags?.length > 0 && (
              <div style={{marginBottom:20}}>
                <div style={{fontSize:12,fontWeight:600,color:'var(--text3)',marginBottom:8,textTransform:'uppercase',letterSpacing:.5}}>Tags</div>
                <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                  {selected.tags.map(t=><span key={t} className="tag" style={{fontSize:11}}>{t}</span>)}
                </div>
              </div>
            )}

            {/* Generate Video — for drafts without a video */}
            {(selected.status === 'draft' || selected.status === 'failed') && !selected.video_url && (
              <div style={{borderTop:'1px solid var(--border)',paddingTop:16,marginTop:4,marginBottom:16}}>
                <div style={{fontSize:14,fontWeight:600,marginBottom:12}}>🎬 Generate Video</div>

                {/* Voice picker */}
                <div style={{marginBottom:14}}>
                  <div style={{fontSize:12,fontWeight:600,color:'var(--text3)',marginBottom:8,textTransform:'uppercase',letterSpacing:.5}}>Choose Voice</div>
                  {/* Gender tabs */}
                  <div style={{display:'flex',gap:6,marginBottom:10}}>
                    {['male','female'].map(g => (
                      <button key={g} onClick={()=>{
                        const first = VOICES.find(v=>v.gender===g)
                        if(first) setSelectedVoice(first.id)
                      }}
                      style={{padding:'4px 14px',borderRadius:20,border:'1.5px solid var(--border)',background: VOICES.find(v=>v.id===selectedVoice)?.gender===g ? 'var(--accent)':'transparent',color: VOICES.find(v=>v.id===selectedVoice)?.gender===g ?'#fff':'var(--text3)',fontSize:12,fontWeight:600,cursor:'pointer',textTransform:'capitalize'}}>
                        {g === 'male' ? '👨 Male' : '👩 Female'}
                      </button>
                    ))}
                  </div>
                  {/* Voice options */}
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
                    {VOICES.filter(v => v.gender === (VOICES.find(v=>v.id===selectedVoice)?.gender || 'male')).map(v => (
                      <div key={v.id} onClick={()=>setSelectedVoice(v.id)}
                        style={{padding:'8px 12px',borderRadius:8,border:`1.5px solid ${selectedVoice===v.id?'var(--accent)':'var(--border)'}`,background:selectedVoice===v.id?'rgba(255,59,59,.1)':'transparent',cursor:'pointer'}}>
                        <div style={{fontSize:13,fontWeight:600,color:'var(--text)'}}>{v.label}</div>
                        <div style={{fontSize:11,color:'var(--text3)'}}>{v.description}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{fontSize:12,color:'var(--text3)',marginBottom:10}}>Takes ~1-2 minutes to generate.</div>
                <button className="btn btn-accent" style={{width:'100%'}} disabled={generatingVideo} onClick={handleGenerateVideo}>
                  {generatingVideo ? '⏳ Generating… (check back in 1-2 min)' : '🎬 Generate Video'}
                </button>
              </div>
            )}

            {/* Video ready */}
            {selected.video_url && (
              <div style={{borderTop:'1px solid var(--border)',paddingTop:16,marginTop:4,marginBottom:16}}>
                <div style={{fontSize:14,fontWeight:600,marginBottom:8}}>🎬 Video Ready</div>
                <video src={selected.video_url} controls style={{width:'100%',borderRadius:8,marginBottom:8}} />
              </div>
            )}

            {/* Publish section — for drafts and ready shorts */}
            {(selected.status === 'draft' || selected.status === 'ready') && (
              <div style={{borderTop:'1px solid var(--border)',paddingTop:20,marginTop:4}}>
                <div style={{fontSize:14,fontWeight:600,marginBottom:14}}>🚀 Publish to YouTube</div>
                {channels.length === 0 ? (
                  <div style={{fontSize:13,color:'var(--text3)'}}>No channels connected. Go to <b>Channels</b> to connect your YouTube account first.</div>
                ) : (
                  <>
                    <div style={{marginBottom:12}}>
                      <label style={{fontSize:12,fontWeight:600,color:'var(--text3)',display:'block',marginBottom:6,textTransform:'uppercase',letterSpacing:.5}}>Channel</label>
                      <select className="form-input" value={publishForm.channel_id} onChange={e=>setPublishForm(f=>({...f,channel_id:e.target.value}))}>
                        <option value="">Select channel...</option>
                        {channels.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    <div style={{marginBottom:16}}>
                      <label style={{fontSize:12,fontWeight:600,color:'var(--text3)',display:'block',marginBottom:6,textTransform:'uppercase',letterSpacing:.5}}>Privacy</label>
                      <select className="form-input" value={publishForm.privacy} onChange={e=>setPublishForm(f=>({...f,privacy:e.target.value}))}>
                        <option value="public">Public</option>
                        <option value="unlisted">Unlisted</option>
                        <option value="private">Private</option>
                      </select>
                    </div>
                    <div style={{display:'flex',gap:10}}>
                      <button className="btn btn-accent" style={{flex:1}} disabled={publishing || !selected.video_url} onClick={handlePublish} title={!selected.video_url ? 'Generate video first' : ''}>
                        {publishing ? 'Publishing...' : selected.video_url ? '🚀 Publish Now' : '🔒 Generate Video First'}
                      </button>
                      <button className="btn btn-ghost" onClick={()=>handleDelete(selected.id)}>🗑 Delete</button>
                    </div>
                  </>
                )}
              </div>
            )}

            {selected.status === 'published' && selected.youtube_video_id && (
              <div style={{borderTop:'1px solid var(--border)',paddingTop:16,marginTop:4}}>
                <a href={`https://youtube.com/shorts/${selected.youtube_video_id}`} target="_blank" rel="noreferrer" className="btn btn-accent" style={{display:'inline-block'}}>
                  ▶ View on YouTube
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
