import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
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

const pageVariants = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
}

const pageTransition = {
  duration: 0.2,
  ease: [0.4, 0, 0.2, 1],
}

function AnimatedRoutes() {
  const location = useLocation()

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={pageTransition}
        className="flex-1 overflow-y-auto px-8 py-7"
      >
        <Routes location={location}>
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
      </motion.div>
    </AnimatePresence>
  )
}

function ProtectedShell() {
  const { user, loading } = useAuth()
  const { theme } = useTheme()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg">
        <div className="flex flex-col items-center gap-4">
          <div className="w-3 h-3 rounded-full bg-accent animate-pulse-dot" />
          <p className="text-sm text-text-muted font-medium">
            Loading ShortFlow...
          </p>
        </div>
      </div>
    )
  }

  if (!user) return <Navigate to="/auth" replace />

  return (
    <div className={`flex h-screen overflow-hidden bg-bg theme-${theme}`}>
      <Sidebar />
      <div className="flex flex-1 flex-col min-w-0">
        <Topbar />
        <AnimatedRoutes />
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
