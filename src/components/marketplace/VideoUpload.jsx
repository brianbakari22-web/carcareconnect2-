import { useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import toast from "react-hot-toast"

export default function VideoUpload({ listingId, onUploaded }) {
  const { user } = useAuth()
  const [uploading, setUploading] = useState(false)
  const [video, setVideo] = useState(null)
  const [dragOver, setDragOver] = useState(false)

  async function uploadVideo(file) {
    if (!file) return
    if (!file.type.startsWith("video/")) return toast.error("Please upload a video file")
    if (file.size > 50*1024*1024) return toast.error("Video must be under 50MB")
    setUploading(true)
    try {
      const ext = file.name.split(".").pop()
      const path = `${user.id}/${listingId}/video-${Date.now()}.${ext}`
      const { error } = await supabase.storage.from("marketplace").upload(path, file, { upsert: true })
      if (error) throw error
      const { data } = supabase.storage.from("marketplace").getPublicUrl(path)
      await supabase.from("marketplace_listings").update({ video_url: data.publicUrl }).eq("id", listingId)
      setVideo(data.publicUrl)
      toast.success("Video uploaded!")
      if (onUploaded) onUploaded(data.publicUrl)
    } catch(e) {
      toast.error("Upload failed: " + e.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div style={{ marginTop:16 }}>
      <div style={{ fontFamily:"Syne", fontSize:15, fontWeight:700, color:"#000", marginBottom:6 }}>Add a video 🎥 <span style={{ fontSize:11, color:"#888", fontWeight:400 }}>(optional, max 50MB)</span></div>
      <div
        onDragOver={e=>{ e.preventDefault(); setDragOver(true) }}
        onDragLeave={()=>setDragOver(false)}
        onDrop={e=>{ e.preventDefault(); setDragOver(false); uploadVideo(e.dataTransfer.files[0]) }}
        style={{ border:`2px dashed ${dragOver?"#e6821e":"#dddddd"}`, borderRadius:10, padding:"1.5rem", textAlign:"center", background:dragOver?"#fff8f0":"#fafafa", cursor:"pointer" }}
        onClick={()=>document.getElementById("video-upload-input").click()}>
        {uploading ? (
          <div style={{ color:"#888", fontSize:13 }}>⏳ Uploading video...</div>
        ) : video ? (
          <div>
            <video src={video} controls style={{ width:"100%", maxHeight:200, borderRadius:8, marginBottom:8 }}/>
            <div style={{ fontSize:11, color:"#1d9e75", fontWeight:600 }}>✓ Video uploaded</div>
            <div style={{ fontSize:11, color:"#888", marginTop:4, cursor:"pointer" }} onClick={e=>{ e.stopPropagation(); setVideo(null) }}>Replace video</div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize:32, marginBottom:8 }}>🎥</div>
            <div style={{ fontSize:13, color:"#555", marginBottom:4 }}>Drag & drop a video or tap to browse</div>
            <div style={{ fontSize:11, color:"#888" }}>MP4, MOV, AVI • Max 50MB</div>
          </div>
        )}
        <input id="video-upload-input" type="file" accept="video/*" style={{ display:"none" }}
          onChange={e=>uploadVideo(e.target.files[0])}/>
      </div>
    </div>
  )
}
