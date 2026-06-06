import { createContext, useContext, useState, useCallback } from 'react'
const ToastContext = createContext(null)
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const toast = useCallback((msg, type = 'success') => {
    const id = Date.now()
    setToasts(t => [...t, { id, msg, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500)
  }, [])
  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div style={{ position:'fixed', bottom:24, right:24, zIndex:9999, display:'flex', flexDirection:'column', gap:8 }}>
        {toasts.map(t => (
          <div key={t.id} style={{ background:'var(--bg3)', border:'1px solid var(--accent)', borderRadius:10, padding:'12px 18px', fontSize:13, color:'var(--text)', display:'flex', alignItems:'center', gap:10, minWidth:260, animation:'fadeIn .3s ease', boxShadow:'0 8px 24px rgba(0,0,0,.4)' }}>
            <span>{t.type==='error'?'❌':t.type==='warn'?'⚠️':'✅'}</span>
            {t.msg}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
export function useToast() { return useContext(ToastContext) }
