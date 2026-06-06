import { NavLink } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.jsx'

const NAV = [
  { to:'/', label:'Dashboard', icon:'📊', section:'Main' },
  { to:'/create', label:'Create Short', icon:'✨', badge:'AI', section:null },
  { to:'/library', label:'My Library', icon:'📁', section:null },
  { to:'/schedule', label:'Schedule', icon:'📅', section:null },
  { to:'/channels', label:'Channels', icon:'▶️', section:'Grow' },
  { to:'/analytics', label:'Analytics', icon:'📈', section:null },
  { to:'/pricing', label:'Upgrade', icon:'⭐', section:'Account' },
  { to:'/settings', label:'Settings', icon:'⚙️', section:null },
]

export default function Sidebar() {
  const { profile } = useAuth()
  const used = profile?.shorts_used || 0
  const limit = profile?.shorts_limit || 10
  const pct = Math.min((used/limit)*100, 100)
  const plan = profile?.plan || 'free'
  return (
    <div className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-mark"><div className="logo-dot" />ShortFlow</div>
        <div className="logo-sub">Shorts Automation</div>
      </div>
      <nav className="sidebar-nav">
        {NAV.map(item => (
          <span key={item.to}>
            {item.section && <div className="nav-section">{item.section}</div>}
            <NavLink to={item.to} end={item.to==='/'} className={({isActive})=>`nav-item${isActive?' active':''}`}>
              <span>{item.icon}</span>{item.label}
              {item.badge && <span className="nav-badge">{item.badge}</span>}
            </NavLink>
          </span>
        ))}
      </nav>
      <div className="sidebar-footer">
        <div className="plan-chip">
          <div className="plan-chip-name">{plan.toUpperCase()} PLAN</div>
          <div className="plan-chip-desc">{plan==='free'?`${used} / ${limit} shorts used`:'Unlimited shorts'}</div>
          {plan==='free' && <div className="plan-bar"><div className="plan-bar-fill" style={{width:`${pct}%`}} /></div>}
        </div>
      </div>
    </div>
  )
}
