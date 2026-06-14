import { useState, useRef, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTheme, THEMES } from '../hooks/useTheme.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import {
  Search,
  Bell,
  ChevronDown,
  LogOut,
  User,
  Palette,
  Plus,
} from 'lucide-react'

const PAGE_TITLES = {
  '/': 'Dashboard',
  '/create': 'Create Short',
  '/library': 'Library',
  '/schedule': 'Schedule',
  '/channels': 'Channels',
  '/analytics': 'Analytics',
  '/pricing': 'Pricing',
  '/settings': 'Settings',
}

export default function Topbar() {
  const { theme, changeTheme } = useTheme()
  const { signOut, profile } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [showDropdown, setShowDropdown] = useState(false)
  const [showThemes, setShowThemes] = useState(false)
  const dropdownRef = useRef(null)
  const themeRef = useRef(null)

  const pageTitle =
    PAGE_TITLES[location.pathname] || 'ShortFlow'
  const userName = profile?.full_name || 'User'
  const initials = userName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false)
      }
      if (themeRef.current && !themeRef.current.contains(e.target)) {
        setShowThemes(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <header className="h-[58px] flex items-center gap-4 px-8 border-b border-border glass-surface shrink-0">
      {/* Page title */}
      <h1 className="text-base font-bold tracking-tight text-text">
        {pageTitle}
      </h1>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Search */}
      <div className="relative hidden md:block">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
        <input
          type="text"
          placeholder="Search..."
          className="glass-input pl-9 pr-4 py-2 text-sm w-56 rounded-lg focus:glass-input-focus placeholder:text-text-muted"
        />
      </div>

      {/* New Short button */}
      <button
        onClick={() => navigate('/create')}
        className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-accent text-bg text-[13px] font-semibold hover:bg-accent-hover cursor-pointer border-none"
      >
        <Plus className="w-4 h-4" />
        <span className="hidden sm:inline">New Short</span>
      </button>

      {/* Theme toggle */}
      <div className="relative" ref={themeRef}>
        <button
          onClick={() => setShowThemes(!showThemes)}
          className="flex items-center justify-center w-9 h-9 rounded-lg text-text-secondary hover:text-text hover:bg-bg-hover cursor-pointer bg-transparent border-none"
          title="Change theme"
        >
          <Palette className="w-[18px] h-[18px]" />
        </button>
        {showThemes && (
          <div className="absolute right-0 top-full mt-2 glass-card p-3 z-50 min-w-[160px]">
            <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wide mb-2">
              Theme
            </p>
            <div className="flex flex-wrap gap-2">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    changeTheme(t.id)
                    setShowThemes(false)
                  }}
                  className={`w-6 h-6 rounded-full cursor-pointer border-2 hover:scale-110 ${
                    theme === t.id
                      ? 'border-text scale-110'
                      : 'border-transparent'
                  }`}
                  style={{ backgroundColor: t.color }}
                  title={t.label}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Notifications */}
      <button className="relative flex items-center justify-center w-9 h-9 rounded-lg text-text-secondary hover:text-text hover:bg-bg-hover cursor-pointer bg-transparent border-none">
        <Bell className="w-[18px] h-[18px]" />
        <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-accent" />
      </button>

      {/* User avatar + dropdown */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex items-center gap-2 cursor-pointer bg-transparent border-none"
        >
          <div className="w-8 h-8 rounded-full bg-accent-muted flex items-center justify-center text-accent text-xs font-bold">
            {initials}
          </div>
          <ChevronDown
            className={`w-3.5 h-3.5 text-text-muted ${
              showDropdown ? 'rotate-180' : ''
            }`}
          />
        </button>
        {showDropdown && (
          <div className="absolute right-0 top-full mt-2 glass-card py-1.5 z-50 min-w-[180px]">
            <div className="px-3 py-2 border-b border-border">
              <p className="text-sm font-semibold text-text">{userName}</p>
              <p className="text-[11px] text-text-muted">{profile?.email}</p>
            </div>
            <button
              onClick={() => {
                navigate('/settings')
                setShowDropdown(false)
              }}
              className="flex items-center gap-2.5 w-full px-3 py-2 text-[13px] text-text-secondary hover:text-text hover:bg-bg-hover cursor-pointer bg-transparent border-none text-left"
            >
              <User className="w-4 h-4" />
              Profile
            </button>
            <button
              onClick={() => {
                signOut()
                setShowDropdown(false)
              }}
              className="flex items-center gap-2.5 w-full px-3 py-2 text-[13px] text-red-400 hover:bg-bg-hover cursor-pointer bg-transparent border-none text-left"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
