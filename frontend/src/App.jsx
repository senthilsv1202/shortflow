import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth.jsx'
import { useTheme } from './hooks/useTheme.jsx'
import Sidebar from './components/Sidebar.jsx'
import Topbar from './components/Topbar.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Create from './pages/Create.jsx'
import Library from './pages/Library.jsx'
import Schedule from './pages/Schedule.jsx'
import Channels from './pages/Channels.jsx'
import Analytics from './pages/Analytics.jsx'
import Pricing from './pages/Pricing.jsx'
import Settings from './pages/Settings.jsx'
import Landing from './pages/Landing.jsx'
import Auth from './pages/Auth.jsx'

function ProtectedShell() {
  const { user, loading } = useAuth()
  const { theme } = useTheme()
  if (loading) return <div style={{display:'flex',height:'100vh',alignItems:'center',justifyContent:'center',background:'#0A0A0F',color:'#fff',fontFamily:'Syne,sans-serif',flexDirection:'column',gap:16}}><div style={{fontSize:32}}>⚡</div><div>Loading ShortFlow...</div></div>
  if (!user) return <Navigate to="/auth" replace />
  return (
    <div className={`app theme-${theme}`}>
      <Sidebar />
      <div className="main">
        <Topbar />
        <div className="content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/create" element={<Create />} />
            <Route path="/library" element={<Library />} />
            <Route path="/schedule" element={<Schedule />} />
            <Route path="/channels" element={<Channels />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/landing" element={<Landing />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/*" element={<ProtectedShell />} />
        </Routes>
      </Router>
    </AuthProvider>
  )
}
