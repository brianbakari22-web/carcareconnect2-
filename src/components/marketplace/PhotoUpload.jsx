import { useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import toast from "react-hot-toast"

export default function PhotoUpload({ listingId, existingPhotos=[], onUploaded }) {
  const { user } = useAuth()
  const [uploading, setUploading] = useState(false)
  const [photos, setPhotos] = useState(existingPhotos)
  const [dragOver, setDragOver] = useState(false)

  async function uploadFiles(files) {
    if (!files?.length) return
    if (photos.length + files.length > 10) return toast.error("Maximum 10 photos allowed")
    setUploading(true)
    try {
      const uploaded = []
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) { toast.error(`${file.name} is not an image`); continue }
        if (file.size > 5*1024*1024) { toast.error(`${file.name} exceeds 5MB limit`); continue }
        const ext = file.name.split(".").pop()
        const path = `${user.id}/${listingId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const { error } = await supabase.storage.from("marketplace").upload(path, file)
        if (error) throw error
        const { data } = supabase.storage.from("marketplace").getPublicUrl(path)
        const isPrimary = photos.length === 0 && uploaded.length === 0
        const { data: photo } = await supabase.from("marketplace_photos").insert({
          listing_id: listingId,
          photo_url: data.publicUrl,
          is_primary: isPrimary,
          display_order: photos.length + uploaded.length,
        }).select().single()
        if (photo) uploaded.push(photo)
      }
      const newPhotos = [...photos, ...uploaded]
      setPhotos(newPhotos)
      if (onUploaded) onUploaded(newPhotos)
      toast.success(`${uploaded.length} photo(s) uploaded`)
    } catch(err) { toast.error(err.message) }
    finally { setUploading(false) }
  }

  async function setPrimary(photoId) {
    await supabase.from("marketplace_photos").update({ is_primary:false }).eq("listing_id",listingId)
    await supabase.from("marketplace_photos").update({ is_primary:true }).eq("id",photoId)
    setPhotos(p=>p.map(ph=>({...ph, is_primary:ph.id===photoId})))
    toast.success("Cover photo updated")
  }

  async function deletePhoto(photo) {
    try {
      const path = photo.photo_url.split("/marketplace/")[1]
      await supabase.storage.from("marketplace").remove([path])
      await supabase.from("marketplace_photos").delete().eq("id",photo.id)
      const remaining = photos.filter(p=>p.id!==photo.id)
      // If deleted was primary, set first remaining as primary
      if (photo.is_primary && remaining.length>0) {
        await supabase.from("marketplace_photos").update({ is_primary:true }).eq("id",remaining[0].id)
        remaining[0].is_primary = true
      }
      setPhotos(remaining)
      if (onUploaded) onUploaded(remaining)
      toast.success("Photo deleted")
    } catch(err) { toast.error(err.message) }
  }

  return (
    <div>
      <div style={{ fontSize:11, color:"#777777", marginBottom:8 }}>
        {photos.length}/10 photos · First photo is the cover · Click photo to set as cover
      </div>

      {/* Upload area */}
      <div
        onDragOver={e=>{ e.preventDefault(); setDragOver(true) }}
        onDragLeave={()=>setDragOver(false)}
        onDrop={e=>{ e.preventDefault(); setDragOver(false); uploadFiles(e.dataTransfer.files) }}
        style={{ border:`2px dashed ${dragOver?"#e6821e":"#555555"}`, borderRadius:12, padding:"1.5rem", textAlign:"center", marginBottom:12, background:dragOver?"#fff8f0":"transparent", transition:"all 0.2s" }}>
        <div style={{ fontSize:32, marginBottom:8 }}>📸</div>
        <div style={{ fontSize:13, color:"#666", marginBottom:8 }}>
          {uploading?"Uploading...":"Drag photos here or click to select"}
        </div>
        <div style={{ fontSize:11, color:"#888888", marginBottom:12 }}>Max 10 photos · 5MB each · JPG, PNG, WEBP</div>
        <input type="file" accept="image/*" multiple id="photo-upload" style={{ display:"none" }}
          onChange={e=>uploadFiles(e.target.files)}/>
        <label htmlFor="photo-upload"
          style={{ background:uploading?"#555555":"#e6821e", border:"none", borderRadius:8, color:uploading?"#555":"#fff", fontFamily:"Syne,sans-serif", fontSize:12, fontWeight:700, padding:"9px 20px", cursor:uploading?"not-allowed":"pointer", display:"inline-block" }}>
          {uploading?"Uploading...":"Select photos"}
        </label>
      </div>

      {/* Photo grid */}
      {photos.length>0&&(
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8 }}>
          {photos.map(photo=>(
            <div key={photo.id} style={{ position:"relative", borderRadius:10, overflow:"hidden", border:`2px solid ${photo.is_primary?"#e6821e":"transparent"}`, cursor:"pointer" }}
              onClick={()=>!photo.is_primary&&setPrimary(photo.id)}>
              <img src={photo.photo_url} alt="" style={{ width:"100%", height:90, objectFit:"cover", display:"block" }}/>
              {photo.is_primary&&(
                <div style={{ position:"absolute", bottom:0, left:0, right:0, background:"rgba(230,130,30,0.9)", fontSize:9, fontWeight:700, color:"#fff", textAlign:"center", padding:"3px" }}>
                  COVER
                </div>
              )}
              <button
                onClick={e=>{ e.stopPropagation(); deletePhoto(photo) }}
                style={{ position:"absolute", top:4, right:4, background:"rgba(0,0,0,0.7)", border:"none", borderRadius:"50%", color:"#fff", width:20, height:20, fontSize:12, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", lineHeight:1 }}>
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

