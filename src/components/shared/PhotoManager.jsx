import { useState } from "react"
import { supabase } from "../../lib/supabase"
import toast from "react-hot-toast"

export default function PhotoManager({ photos=[], onUpdate, bucket="provider-photos", userId, label="Photos", maxPhotos=10 }) {
  const [uploading, setUploading] = useState(false)

  async function uploadPhoto(file) {
    setUploading(true)
    try {
      const ext = file.name.split(".").pop()
      const path = `${userId}/photo-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert:true })
      if (error) throw error
      const { data } = supabase.storage.from(bucket).getPublicUrl(path)
      const newPhotos = [...photos, data.publicUrl]
      onUpdate(newPhotos)
      toast.success("Photo uploaded!")
    } catch(e) { toast.error(e.message) }
    finally { setUploading(false) }
  }

  async function deletePhoto(url) {
    if (!confirm("Delete this photo?")) return
    const newPhotos = photos.filter(p=>p!==url)
    onUpdate(newPhotos)
    toast.success("Photo removed")
  }

  function setPrimary(url) {
    const newPhotos = [url, ...photos.filter(p=>p!==url)]
    onUpdate(newPhotos)
    toast.success("Set as primary photo")
  }

  return (
    <div style={{ marginBottom:16 }}>
      <div style={{ fontSize:11, color:"#666", textTransform:"uppercase", letterSpacing:"0.05em", display:"block", marginBottom:8 }}>{label}</div>
      
      {/* Photo grid */}
      {photos.length>0&&(
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(90px,1fr))", gap:8, marginBottom:10 }}>
          {photos.map((url,i)=>(
            <div key={url} style={{ position:"relative", aspectRatio:"1", borderRadius:8, overflow:"hidden", border:`2px solid ${i===0?"#e6821e":"#f5f5f5"}` }}>
              <img src={url} alt={`Photo ${i+1}`} style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
              {i===0&&<div style={{ position:"absolute", top:4, left:4, background:"#e6821e", borderRadius:4, fontSize:8, color:"#fff", padding:"2px 5px", fontWeight:700 }}>PRIMARY</div>}
              <div style={{ position:"absolute", bottom:0, left:0, right:0, display:"flex", gap:2, padding:4, background:"rgba(0,0,0,0.7)" }}>
                {i!==0&&(
                  <button onClick={()=>setPrimary(url)} style={{ flex:1, background:"#e6821e", border:"none", borderRadius:3, color:"#fff", fontSize:8, padding:"2px", cursor:"pointer", fontWeight:700 }}>
                    ★
                  </button>
                )}
                <button onClick={()=>deletePhoto(url)} style={{ flex:1, background:"#e24b4a", border:"none", borderRadius:3, color:"#fff", fontSize:8, padding:"2px", cursor:"pointer" }}>
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload button */}
      {photos.length < maxPhotos && (
        <label style={{ display:"block", background:"#ffffff", border:"2px dashed #333", borderRadius:8, padding:"12px", textAlign:"center", cursor:"pointer" }}>
          <input type="file" accept="image/*" multiple style={{ display:"none" }} 
            onChange={async(e)=>{
              const files = Array.from(e.target.files).slice(0, maxPhotos - photos.length)
              for (const file of files) await uploadPhoto(file)
            }}/>
          <div style={{ fontSize:20, marginBottom:4 }}>📷</div>
          <div style={{ fontSize:11, color:"#777777" }}>{uploading?"Uploading...":"Tap to add photos"}</div>
          <div style={{ fontSize:10, color:"#555555", marginTop:2 }}>{photos.length}/{maxPhotos} photos</div>
        </label>
      )}
    </div>
  )
}

