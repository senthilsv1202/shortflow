import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth.jsx'
import { db } from '../lib/supabase.js'

const DAYS = ['Jan 22','Jan 25','Jan 28','Feb 1','Feb 5','Feb 8','Feb 11','Feb 14','Feb 18','Feb 22','Feb 25','Mar 1','Mar 5','Mar 8']
const VIEWS = [12,18,8,31,24,42,28,55,38,48,21,62,44,71]
const SUBS  = [2,4,1,8,5,12,7,14,9,11,4,18,10,22]

export default function Analytics() {
  const { user } = useAuth()
  const [period, setPeriod] = useState('30')
  const [analytics, setAnalytics] = useState([])
  useEffect(()=>{ if(user) db.getAnalytics(user.id, parseInt(period)).then(setAnalytics).catch(()=>{}) },[user,period])

  const maxV = Math.max(...VIEWS)
  const totalViews = VIEWS.reduce((a,b)=>a+b,0)
  const totalSubs = SUBS.reduce((a,b)=>a+b,0)

  return (
    <div className="fade-in">
      <div className="page-header" style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between'}}>
        <div><div className="page-title">📈 Analytics</div><div className="page-desc">Track your channel performance</div></div>
        <div style={{display:'flex',gap:6}}>
          {['7','30','90'].map(d=><button key={d} className={`btn btn-sm ${period===d?'btn-accent':'btn-ghost'}`} onClick={()=>setPeriod(d)}>{d}d</button>)}
        </div>
      </div>

      <div className="stats-grid" style={{marginBottom:24}}>
        {[
          {label:'Total Views',value:'284K',change:'↑ 18%',up:true,icon:'👁'},
          {label:'CTR',value:'12.4%',change:'↑ 2.1%',up:true,icon:'🖱'},
          {label:'Avg Retention',value:'61%',change:'↑ 5%',up:true,icon:'⏱'},
          {label:'New Subscribers',value:'1,240',change:'↑ 22%',up:true,icon:'👥'},
        ].map(s=>(
          <div key={s.label} className="stat-card">
            <div className="stat-label"><span>{s.icon}</span>{s.label}</div>
            <div className="stat-value">{s.value}</div>
            <div className={`stat-change ${s.up?'stat-up':'stat-dn'}`}>{s.change}</div>
          </div>
        ))}
      </div>

      <div className="card card-pad" style={{marginBottom:16}}>
        <div style={{fontWeight:700,fontFamily:'var(--font-head)',fontSize:14,marginBottom:18,display:'flex',alignItems:'center',gap:8}}>📊 Views — Last 14 Days <span className="tag tag-accent">{totalViews}K total</span></div>
        <div style={{display:'flex',alignItems:'flex-end',gap:6,height:130}}>
          {VIEWS.map((v,i)=>(
            <div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:3}}>
              <div style={{fontSize:9,color:'var(--text3)'}}>{i%3===0?v+'K':''}</div>
              <div style={{width:'100%',borderRadius:'3px 3px 0 0',height:`${Math.round((v/maxV)*100)}%`,background:i>=10?'var(--accent)':'var(--bg4)',minHeight:4,transition:'all .3s'}} />
              <div style={{fontSize:9,color:'var(--text3)',whiteSpace:'nowrap'}}>{i%3===0?DAYS[i].split(' ')[1]:''}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid-2" style={{marginBottom:16}}>
        <div className="card card-pad">
          <div style={{fontWeight:700,fontFamily:'var(--font-head)',fontSize:14,marginBottom:16}}>🏆 Top Performing Shorts</div>
          {[
            ['Dark Side of Social Media','91.7K','94%'],
            ['10 Python Tips','42.1K','88%'],
            ['5 Money Habits','67.3K','92%'],
            ['Why Devs Fail Interviews','28.4K','74%'],
          ].map(([title,views,viral],i)=>(
            <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 0',borderBottom:'1px solid var(--border)'}}>
              <span style={{color:'var(--text3)',fontSize:12,width:18}}>0{i+1}</span>
              <span style={{flex:1,fontSize:13,color:'var(--text2)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{title}</span>
              <span style={{fontSize:13,fontWeight:600,color:'var(--text)'}}>{views}</span>
              <span className="tag tag-accent" style={{fontSize:10}}>{viral}</span>
            </div>
          ))}
        </div>
        <div className="card card-pad">
          <div style={{fontWeight:700,fontFamily:'var(--font-head)',fontSize:14,marginBottom:16}}>📊 Growth Metrics</div>
          {[
            ['Subscriber growth','72%','#22C97A'],
            ['Avg watch retention','61%','#4488FF'],
            ['Engagement rate','47%','#FFB340'],
            ['Click-through rate','38%','var(--accent)'],
          ].map(([label,pct,color])=>(
            <div key={label} style={{marginBottom:14}}>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:5}}>
                <span style={{color:'var(--text2)'}}>{label}</span>
                <span style={{color,fontWeight:600}}>{pct}</span>
              </div>
              <div className="progress-track"><div className="progress-fill" style={{width:pct,background:color}} /></div>
            </div>
          ))}
          <div style={{borderTop:'1px solid var(--border)',marginTop:16,paddingTop:14}}>
            <div style={{fontSize:12,color:'var(--text3)',marginBottom:8}}>Subscribers per short</div>
            <div style={{display:'flex',alignItems:'flex-end',gap:4,height:50}}>
              {SUBS.map((v,i)=><div key={i} style={{flex:1,height:`${Math.round((v/22)*100)}%`,background:i>=10?'var(--green)':'var(--bg4)',borderRadius:'2px 2px 0 0',minHeight:3}} />)}
            </div>
          </div>
        </div>
      </div>

      <div className="card card-pad">
        <div style={{fontWeight:700,fontFamily:'var(--font-head)',fontSize:14,marginBottom:16}}>💰 Revenue Tracking</div>
        <div style={{display:'flex',alignItems:'center',gap:20,padding:16,background:'var(--bg3)',borderRadius:10,border:'1px dashed var(--border2)'}}>
          <span style={{fontSize:32}}>🔒</span>
          <div>
            <div style={{fontWeight:600,marginBottom:4}}>Revenue analytics requires Creator plan</div>
            <div style={{fontSize:13,color:'var(--text3)'}}>Track AdSense earnings, sponsorship income, and channel monetization metrics</div>
          </div>
          <a href="/pricing" className="btn btn-accent btn-sm" style={{flexShrink:0}}>Upgrade →</a>
        </div>
      </div>
    </div>
  )
}
