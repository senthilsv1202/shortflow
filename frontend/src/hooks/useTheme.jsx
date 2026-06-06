import { createContext, useContext, useState } from 'react'
export const THEMES = [
  { id:'crimson', label:'Crimson', color:'#FF3B3B' },
  { id:'neon',    label:'Neon',    color:'#00D4FF' },
  { id:'cyber',   label:'Cyber',   color:'#B040FF' },
  { id:'solar',   label:'Solar',   color:'#FF8C00' },
  { id:'matrix',  label:'Matrix',  color:'#00FF41' },
  { id:'rose',    label:'Rose',    color:'#FF1869' },
  { id:'ocean',   label:'Ocean',   color:'#00BFFF' },
]
const ThemeContext = createContext(null)
export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem('sf_theme') || 'crimson')
  function changeTheme(t) { setTheme(t); localStorage.setItem('sf_theme', t) }
  return <ThemeContext.Provider value={{ theme, changeTheme, themes: THEMES }}>{children}</ThemeContext.Provider>
}
export function useTheme() { return useContext(ThemeContext) }
