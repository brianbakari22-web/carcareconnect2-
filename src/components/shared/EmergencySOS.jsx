import { useState } from "react"
import { useAuth } from "../../contexts/AuthContext"
import { supabase } from "../../lib/supabase"
import { getCurrentPosition } from "../../lib/geolocation"
import toast from "react-hot-toast"

export default function EmergencySOS() {
  const { user, profile } = useAuth()
  const [open, setOpen] = useState(false)
  const [sending, setSending] = useState(false)

  async function sendSOS() {
    setSending(true)
    try {
      let lat = null, lng = null
      try {
        const pos = await getCurrentPosition()
        lat = pos.latitude
        lng = pos.longitude
      } catch(locErr) {
        console.warn("Location unavailable:", locErr.message)
      }

      await supabase.from("emergency_alerts").insert({
        user_id: user.id,
        user_name: `${profile?.first_name||""} ${profile?.last_name||""}`,
        user_role: profile?.role||"unknown",
        latitude: lat,
        longitude: lng,
        status: "active",
      })

      const { data: admins } = await supabase.from("profiles").select("id").eq("role","admin")
      for (const admin of admins||[]) {
        await supabase.from("notifications").insert({
          user_id: admin.id,
          title: "🚨 EMERGENCY SOS ALERT",
          message: `${profile?.first_name||"A user"} ${profile?.last_name||""} (${profile?.role}) has triggered an emergency alert!${lat?` Location: https://maps.google.com/?q=${lat},${lng}`:""}`,
          type: "error",
        })
      }

      toast.success("Emergency alert sent! Help is on the way.")
      setOpen(false)
    } catch (err) {
      toast.error("Failed to send alert: " + err.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <button onClick={()=>setOpen(true)}
        style={{ position:"fixed", top:70, right:16, width:46, height:46, borderRadius:"50%", background:"#e24b4a", border:"none", color:"#fff", fontSize:20, cursor:"pointer", boxShadow:"0 4px 12px rgba(226,75,74,0.4)", zIndex:90, display:"flex", alignItems:"center", justifyContent:"center" }}>
        🆘
      </button>

      {open&&(
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:"1rem" }}>
          <div style={{ background:"#fff", borderRadius:14, padding:"1.5rem", maxWidth:340, width:"100%" }}>
            <div style={{ fontFamily:"Syne", fontSize:18, fontWeight:800, color:"#e24b4a", marginBottom:8, textAlign:"center" }}>🚨 Emergency Help</div>
            <div style={{ fontSize:13, color:"#666", marginBottom:16, textAlign:"center" }}>
              Choose how you'd like to get help. Your location will be shared.
            </div>

            <a href="tel:999" style={{ display:"block", background:"#fff5f5", border:"1px solid #e24b4a40", borderRadius:10, padding:"12px", marginBottom:8, textAlign:"center", color:"#e24b4a", fontWeight:700, fontSize:14, textDecoration:"none" }}>
              📞 Call Police (999)
            </a>

            <a href="tel:0800723573" style={{ display:"block", background:"#eff6ff", border:"1px solid #378add40", borderRadius:10, padding:"12px", marginBottom:8, textAlign:"center", color:"#378add", fontWeight:700, fontSize:14, textDecoration:"none" }}>
              📞 Call NTSA (0800 723 573)
            </a>

            <button onClick={sendSOS} disabled={sending}
              style={{ display:"block", width:"100%", background:"#e6821e", border:"none", borderRadius:10, padding:"12px", marginBottom:8, textAlign:"center", color:"#fff", fontWeight:700, fontSize:14, cursor:"pointer" }}>
              {sending?"Sending...":"🚨 Alert Car Care Connect Admin"}
            </button>

            <button onClick={()=>setOpen(false)}
              style={{ display:"block", width:"100%", background:"none", border:"1px solid #eee", borderRadius:10, padding:"10px", textAlign:"center", color:"#888", fontSize:13, cursor:"pointer" }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  )
}
