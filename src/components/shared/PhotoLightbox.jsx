import { useEffect } from "react"

export default function PhotoLightbox({ photos, currentIndex, onClose, onPrev, onNext }) {
  useEffect(() => {
    function handleKey(e) {
      if (e.key === "Escape") onClose()
      if (e.key === "ArrowLeft") onPrev()
      if (e.key === "ArrowRight") onNext()
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [onClose, onPrev, onNext])

  if (!photos || photos.length === 0) return null

  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.95)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center" }}>
      {/* Close button */}
      <button onClick={onClose} style={{ position:"absolute", top:16, right:16, background:"rgba(255,255,255,0.15)", border:"none", borderRadius:"50%", width:40, height:40, color:"#fff", fontSize:20, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1001 }}>×</button>

      {/* Photo counter */}
      <div style={{ position:"absolute", top:16, left:"50%", transform:"translateX(-50%)", color:"rgba(255,255,255,0.8)", fontSize:13 }}>
        {currentIndex+1} / {photos.length}
      </div>

      {/* Prev button */}
      {photos.length > 1 && currentIndex > 0 && (
        <button onClick={e=>{ e.stopPropagation(); onPrev() }}
          style={{ position:"absolute", left:16, background:"rgba(255,255,255,0.15)", border:"none", borderRadius:"50%", width:44, height:44, color:"#fff", fontSize:22, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
          ‹
        </button>
      )}

      {/* Main image */}
      <img
        src={photos[currentIndex]}
        alt=""
        onClick={e=>e.stopPropagation()}
        style={{ maxWidth:"92vw", maxHeight:"88vh", objectFit:"contain", borderRadius:8, boxShadow:"0 8px 40px rgba(0,0,0,0.5)" }}
      />

      {/* Next button */}
      {photos.length > 1 && currentIndex < photos.length - 1 && (
        <button onClick={e=>{ e.stopPropagation(); onNext() }}
          style={{ position:"absolute", right:16, background:"rgba(255,255,255,0.15)", border:"none", borderRadius:"50%", width:44, height:44, color:"#fff", fontSize:22, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
          ›
        </button>
      )}

      {/* Thumbnail strip */}
      {photos.length > 1 && (
        <div style={{ position:"absolute", bottom:16, left:"50%", transform:"translateX(-50%)", display:"flex", gap:6 }}>
          {photos.map((p,i) => (
            <div key={i} onClick={e=>{ e.stopPropagation(); onPrev(); }}
              style={{ width:i===currentIndex?40:32, height:i===currentIndex?40:32, borderRadius:6, overflow:"hidden", border:i===currentIndex?"2px solid #e6821e":"2px solid transparent", cursor:"pointer", transition:"all 0.2s", opacity:i===currentIndex?1:0.6 }}>
              <img src={p} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
