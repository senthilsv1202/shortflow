import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.jsx'
import {
  LayoutDashboard,
  Sparkles,
  FolderOpen,
  CalendarClock,
  Tv2,
  BarChart3,
  Settings,
  ChevronsLeft,
  ChevronsRight,
  Zap,
} from 'lucide-react'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, section: 'Main' },
  { to: '/create', label: 'Create', icon: Sparkles, badge: 'AI' },
  { to: '/library', label: 'Library', icon: FolderOpen },
  { to: '/schedule', label: 'Schedule', icon: CalendarClock },
  { to: '/channels', label: 'Channels', icon: Tv2, section: 'Grow' },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: Settings, section: 'Account' },
]

export default function Sidebar() {
  const { profile } = useAuth()
  const [collapsed, setCollapsed] = useState(false)
  const location = useLocation()

  const used = profile?.shorts_used || 0
  const limit = profile?.shorts_limit || 10
  const pct = Math.min((used / limit) * 100, 100)
  const plan = profile?.plan || 'free'

  return (
    <aside
      className={`${
        collapsed ? 'w-[68px]' : 'w-[240px]'
      } flex flex-col shrink-0 glass-surface border-r border-border h-screen`}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-border">
        <div className="w-2 h-2 rounded-full bg-accent animate-pulse-dot shrink-0" />
        {!collapsed && (
          <div>
            <span className="text-sm font-bold tracking-tight text-text">
              ShortFlow
            </span>
            <p className="text-[10px] text-text-muted uppercase tracking-wider">
              Shorts Automation
            </p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const isActive =
            item.to === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.to)

          return (
            <div key={item.to}>
              {item.section && !collapsed && (
                <p className="px-3 pt-5 pb-1.5 text-[9px] font-semibold text-text-muted uppercase tracking-[1.2px]">
                  {item.section}
                </p>
              )}
              {item.section && collapsed && <div className="h-4" />}
              <NavLink
                to={item.to}
                end={item.to === '/'}
                className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium no-underline ${
                  isActive
                    ? 'text-accent bg-accent-muted'
                    : 'text-text-secondary hover:text-text hover:bg-bg-hover'
                }`}
              >
                {/* Active indicator bar */}
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-accent" />
                )}
                <Icon className="w-[18px] h-[18px] shrink-0" />
                {!collapsed && (
                  <>
                    <span>{item.label}</span>
                    {item.badge && (
                      <span className="nav-badge">{item.badge}</span>
                    )}
                  </>
                )}
              </NavLink>
            </div>
          )
        })}
      </nav>

      {/* Plan badge */}
      {!collapsed && (
        <div className="px-3 pb-2">
          <div className="glass-card p-3">
            <div className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-accent" />
              <span className="text-[11px] font-bold text-accent uppercase tracking-wide">
                {plan} Plan
              </span>
            </div>
            <p className="text-[11px] text-text-muted mt-1">
              {plan === 'free' ? `${used} / ${limit} shorts` : 'Unlimited shorts'}
            </p>
            {plan === 'free' && (
              <div className="h-[3px] rounded-full bg-bg-elevated mt-2 overflow-hidden">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{ width: `${pct}%` }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-center py-3 border-t border-border text-text-muted hover:text-text cursor-pointer bg-transparent"
      >
        {collapsed ? (
          <ChevronsRight className="w-4 h-4" />
        ) : (
          <ChevronsLeft className="w-4 h-4" />
        )}
      </button>
    </aside>
  )
}
