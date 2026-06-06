import { useNavigate } from 'react-router-dom'
import { useTheme, THEMES } from '../hooks/useTheme.jsx'
import { useAuth } from '../hooks/useAuth.jsx'

export default function Topbar() {
  const { theme, changeTheme } = useTheme()
  const { signOut, profile } = useAuth()
  const navigate = useNavigate()
  return (
    <div className="topbar">
      <div className="topbar-title">
        {profile?.full_name ? `👋 ${profile.full_name.split(' ')[0]}` : 'ShortFlow'}
      </div>
      <div className="swatches">
        {THEMES.map(t => (
          <div key={t.id} className={`swatch${theme===t.id?' active':''}`}
            style={{background:t.color}} title={t.label}
            onClick={()=>changeTheme(t.id)} />
        ))}
      </div>
      <button className="btn btn-ghost btn-sm" onClick={()=>navigate('/create')}>✨ New Short</button>
      <button className="btn btn-ghost btn-sm" onClick={signOut} title="Sign out">↗</button>
    </div>
  )
}
