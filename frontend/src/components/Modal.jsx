export default function Modal({ title, onClose, children }) {
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.75)',zIndex:500,display:'flex',alignItems:'center',justifyContent:'center',animation:'fadeIn .2s'}} onClick={e=>{if(e.target===e.currentTarget)onClose()}}>
      <div style={{background:'var(--bg2)',border:'1px solid var(--border2)',borderRadius:16,padding:32,minWidth:380,maxWidth:560,width:'90%'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
          <div style={{fontFamily:'var(--font-head)',fontSize:18,fontWeight:700}}>{title}</div>
          <button onClick={onClose} className="btn btn-ghost btn-sm">✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}
