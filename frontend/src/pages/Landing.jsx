import { useNavigate } from 'react-router-dom'

export default function Landing() {
  const nav = useNavigate()
  return (
    <div style={{minHeight:'100vh',background:'#0A0A0F',fontFamily:"'DM Sans',sans-serif",color:'#F0F0F8'}}>
      <nav style={{padding:'20px 60px',display:'flex',alignItems:'center',justifyContent:'space-between',borderBottom:'1px solid #1A1A22'}}>
        <div style={{fontFamily:"'Syne',sans-serif",fontSize:22,fontWeight:800,display:'flex',alignItems:'center',gap:8}}>
          <span style={{width:10,height:10,borderRadius:'50%',background:'#FF3B3B',display:'inline-block'}} />ShortFlow
        </div>
        <div style={{display:'flex',gap:12}}>
          <button onClick={()=>nav('/auth')} style={{background:'transparent',border:'1px solid #2A2A38',borderRadius:8,padding:'8px 18px',color:'#A0A0C0',cursor:'pointer',fontSize:13}}>Sign In</button>
          <button onClick={()=>nav('/auth')} style={{background:'#FF3B3B',border:'none',borderRadius:8,padding:'8px 18px',color:'#fff',cursor:'pointer',fontSize:13,fontWeight:600}}>Start Free →</button>
        </div>
      </nav>
      <div style={{textAlign:'center',padding:'100px 20px 60px'}}>
        <div style={{display:'inline-flex',alignItems:'center',gap:8,background:'rgba(255,59,59,.1)',border:'1px solid rgba(255,59,59,.3)',borderRadius:20,padding:'6px 16px',fontSize:12,color:'#FF6060',marginBottom:24}}>✨ AI-Powered · Free to Start · No Credit Card</div>
        <h1 style={{fontFamily:"'Syne',sans-serif",fontSize:52,fontWeight:800,lineHeight:1.1,marginBottom:20,maxWidth:700,margin:'0 auto 20px'}}>
          Go Viral on YouTube Shorts<br/><span style={{color:'#FF3B3B'}}>Without Lifting a Finger</span>
        </h1>
        <p style={{fontSize:18,color:'#A0A0C0',maxWidth:560,margin:'0 auto 36px',lineHeight:1.7}}>ShortFlow uses Claude AI to write, optimize, and auto-post viral YouTube Shorts for you. From idea to published in under 2 minutes.</p>
        <div style={{display:'flex',gap:12,justifyContent:'center',flexWrap:'wrap'}}>
          <button onClick={()=>nav('/auth')} style={{background:'#FF3B3B',border:'none',borderRadius:10,padding:'14px 28px',color:'#fff',cursor:'pointer',fontSize:16,fontWeight:700,fontFamily:"'Syne',sans-serif"}}>Start for Free — 10 Shorts/Month →</button>
          <button onClick={()=>nav('/auth')} style={{background:'transparent',border:'1px solid #2A2A38',borderRadius:10,padding:'14px 28px',color:'#A0A0C0',cursor:'pointer',fontSize:15}}>Watch Demo</button>
        </div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:20,padding:'0 60px 80px',maxWidth:1000,margin:'0 auto'}}>
        {[['✨','AI Script Generation','Describe your idea — Claude writes a viral hook, script, and SEO tags instantly.'],['📅','Auto-Schedule & Post','Set your posting schedule once. ShortFlow publishes to YouTube automatically.'],['📈','Analytics & Growth','Track views, subs, and viral scores. Know exactly what content to create more of.']].map(([icon,title,desc])=>(
          <div key={title} style={{background:'#111118',border:'1px solid #2A2A38',borderRadius:14,padding:28}}>
            <div style={{fontSize:32,marginBottom:14}}>{icon}</div>
            <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:17,marginBottom:8}}>{title}</div>
            <div style={{fontSize:13,color:'#60607A',lineHeight:1.7}}>{desc}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
