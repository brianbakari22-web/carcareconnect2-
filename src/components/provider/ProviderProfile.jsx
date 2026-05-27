import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import toast from "react-hot-toast"
import { exportUserData, downloadJSON, downloadCSV, downloadPDF } from "../../lib/dataExport"
import { useLanguage } from "../../contexts/LanguageContext"
import useIsMobile from "../../lib/useIsMobile"

export default function ProviderProfile() {
  const isMobile = useIsMobile()
  const { profile, updateProfile, user } = useAuth()
  const { t } = useLanguage()
  const [form, setForm] = useState({ first_name:"", last_name:"", business_name:"", city:"" })
  const [sensitive, setSensitive] = useState({ phone:"", email:"" })
  const [location, setLocation] = useState({ latitude:null, longitude:null, address:"" })
  const [saving, setSaving] = useState(false)
  const [locating, setLocating] = useState(false)
  const [tab, setTab] = useState("business")

  useEffect(() => {
    if (profile) {
      setForm({ first_name:profile.first_name||"", last_name:profile.last_name||"", business_name:profile.business_name||"", city:profile.city||"" })
      setLocation({ latitude:profile.latitude||null, longitude:profile.longitude||null, address:"" })
    }
    if (user) loadSensitive()
  }, [profile, user])

  async function loadSensitive() {
    const { data } = await supabase.from("profile_sensitive").select("phone,email").eq("id", user.id).single()
    if (data) setSensitive({ phone:data.phone||"", email:data.email||"" })
  }

  async function saveProfile(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await updateProfile({ ...form, latitude:location.latitude, longitude:location.longitude })
      toast.success("Profile updated")
    } catch(err) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  async function saveContact(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await supabase.from("profile_sensitive").update({ phone:sensitive.phone }).eq("id", user.id)
      toast.success("Contact updated")
    } catch(err) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  async function changePassword(e) {
    e.preventDefault()
    const pw = e.target.password.value
    const confirm = e.target.confirm.value
    if (pw !== confirm) return toast.error("Passwords do not match")
    if (pw.length < 6) return toast.error("Min 6 characters")
    const { error } = await supabase.auth.updateUser({ password: pw })
    if (error) return toast.error(error.message)
    toast.success("Password changed")
    e.target.reset()
  }

  async function detectLocation() {
    if (!navigator.geolocation) return toast.error("Geolocation not supported")
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        setLocation(l => ({ ...l, latitude:lat, longitude:lng }))
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`)
          const data = await res.json()
          const address = data.display_name?.split(",").slice(0,3).join(", ") || `${lat.toFixed(4)}, ${lng.toFixed(4)}`
          setLocation({ latitude:lat, longitude:lng, address })
        } catch { setLocation(l => ({ ...l, address:`${lat.toFixed(4)}, ${lng.toFixed(4)}` })) }
        setLocating(false)
        toast.success("Location detected")
      },
      () => { toast.error("Could not detect location"); setLocating(false) }
    )
  }

  const initials = `${profile?.first_name?.[0]||""}${profile?.last_name?.[0]||""}`.toUpperCase()
  async function loadExportData() {
    setExporting(true)
    try { const data = await exportUserData(user.id); setExportData(data) }
    catch(err) { toast.error(err.message) }
    finally { setExporting(false) }
  }

  const inp = { width:"100%", background:"#111", border:"1px solid #222", borderRadius:8, padding:"11px 12px", color:"#f0ede6", fontSize:13, outline:"none", fontFamily:"'DM Sans',sans-serif", marginBottom:12 }
  const lbl = { fontSize:11, color:"#666", textTransform:"uppercase", letterSpacing:"0.05em", display:"block", marginBottom:4 }

  return (
    <div style={{ maxWidth:isMobile?"100%":520 }}>
      <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:"1.5rem" }}>
        <div style={{ width:60, height:60, borderRadius:14, background:"#0c1f2e", border:"2px solid #378add40", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"Syne", fontSize:22, fontWeight:800, color:"#378add" }}>
          {initials}
        </div>
        <div>
          <div style={{ fontFamily:"Syne", fontSize:17, fontWeight:800, color:"#f0ede6" }}>{profile?.business_name||`${profile?.first_name} ${profile?.last_name}`}</div>
          <div style={{ fontSize:12, color:"#555", marginTop:2 }}>Service Provider · {profile?.city||"Location not set"}</div>
          {profile?.is_verified&&<div style={{ fontSize:11, color:"#1d9e75", marginTop:2 }}>✓ Verified provider</div>}
        </div>
      </div>

      <div style={{ display:"flex", gap:6, marginBottom:"1.5rem" }}>
        {[{k:"business",l:t("businessInfo")},{k:"contact",l:t("contactDetails")},{k:"location",l:"Location"},{k:"security",l:t("security")}].map(t=>(
          <button key={tab2.k} onClick={()=>{ setTab(tab2.k); if(tab2.k==="data"&&!exportData) loadExportData() }}
            style={{ padding:"8px 14px", borderRadius:8, border:"none", fontSize:12, cursor:"pointer", background:tab===tab2.k?"#378add":"#111", color:tab===tab2.k?"#fff":"#666", fontFamily:"'DM Sans',sans-serif", fontWeight:tab===tab2.k?700:400 }}>
            {tab2.l}
          </button>
        ))}
      </div>

      {tab==="business"&&(
        <form onSubmit={saveProfile}>
          <div style={{ background:"#111", border:"1px solid #1e1e1e", borderRadius:12, padding:"1.25rem" }}>
            <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, marginBottom:"1rem", color:"#f0ede6" }}>Business information</div>
            <label style={lbl}>Business name</label>
            <input style={inp} placeholder="Your business name" value={form.business_name} onChange={e=>setForm(f=>({...f,business_name:e.target.value}))}/>
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:10 }}>
              <div><label style={lbl}>First name</label><input style={inp} value={form.first_name} onChange={e=>setForm(f=>({...f,first_name:e.target.value}))} required/></div>
              <div><label style={lbl}>Last name</label><input style={inp} value={form.last_name} onChange={e=>setForm(f=>({...f,last_name:e.target.value}))} required/></div>
            </div>
            <label style={lbl}>City</label>
            <input style={inp} placeholder="e.g. Nairobi" value={form.city} onChange={e=>setForm(f=>({...f,city:e.target.value}))}/>
            <button type="submit" disabled={saving}
              style={{ background:saving?"#333":"#378add", border:"none", borderRadius:9, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"11px 24px", cursor:saving?"not-allowed":"pointer" }}>
              {saving?t("loading"):t("saveChanges")}
            </button>
          </div>
        </form>
      )}

      {tab==="contact"&&(
        <form onSubmit={saveContact}>
          <div style={{ background:"#111", border:"1px solid #1e1e1e", borderRadius:12, padding:"1.25rem" }}>
            <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, marginBottom:"1rem", color:"#f0ede6" }}>Contact details</div>
            <label style={lbl}>Email</label>
            <input style={{ ...inp, color:"#555", cursor:"not-allowed" }} value={sensitive.email} readOnly/>
            <label style={lbl}>Phone</label>
            <input style={inp} placeholder="+254 700 000 000" value={sensitive.phone} onChange={e=>setSensitive(s=>({...s,phone:e.target.value}))}/>
            <button type="submit" disabled={saving}
              style={{ background:saving?"#333":"#378add", border:"none", borderRadius:9, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"11px 24px", cursor:saving?"not-allowed":"pointer" }}>
              {saving?t("loading"):"Save contact"}
            </button>
          </div>
        </form>
      )}

      {tab==="location"&&(
        <div style={{ background:"#111", border:"1px solid #1e1e1e", borderRadius:12, padding:"1.25rem" }}>
          <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, marginBottom:4, color:"#f0ede6" }}>Shop location</div>
          <div style={{ fontSize:12, color:"#555", marginBottom:"1.25rem" }}>
            Setting your location helps customers find you in nearby searches
          </div>

          {location.latitude&&location.longitude&&(
            <div style={{ background:"#071a12", border:"1px solid #1d9e7540", borderRadius:10, padding:"0.9rem", marginBottom:"1rem" }}>
              <div style={{ fontSize:12, color:"#1d9e75", fontWeight:500, marginBottom:2 }}>✓ Location set</div>
              <div style={{ fontSize:11, color:"#555" }}>
                {location.address || `${location.latitude?.toFixed(4)}, ${location.longitude?.toFixed(4)}`}
              </div>
            </div>
          )}

          <button onClick={detectLocation} disabled={locating}
            style={{ width:"100%", background:locating?"#333":"#0c1f2e", border:"1px solid #378add40", borderRadius:9, color:locating?"#666":"#378add", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"12px", cursor:locating?"not-allowed":"pointer", marginBottom:12 }}>
            {locating?"Detecting...":"📍 Use my current location"}
          </button>

          <div style={{ marginBottom:12 }}>
            <label style={lbl}>Or enter coordinates manually</label>
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:10 }}>
              <div>
                <label style={{ ...lbl, marginBottom:4 }}>Latitude</label>
                <input style={inp} type="number" step="any" placeholder="-1.2921" value={location.latitude||""} onChange={e=>setLocation(l=>({...l,latitude:parseFloat(e.target.value)||null}))}/>
              </div>
              <div>
                <label style={{ ...lbl, marginBottom:4 }}>Longitude</label>
                <input style={inp} type="number" step="any" placeholder="36.8219" value={location.longitude||""} onChange={e=>setLocation(l=>({...l,longitude:parseFloat(e.target.value)||null}))}/>
              </div>
            </div>
          </div>

          <button onClick={saveProfile} disabled={saving||!location.latitude||!location.longitude}
            style={{ background:saving||!location.latitude||!location.longitude?"#333":"#378add", border:"none", borderRadius:9, color:saving||!location.latitude||!location.longitude?"#666":"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"11px 24px", cursor:saving||!location.latitude||!location.longitude?"not-allowed":"pointer" }}>
            {saving?t("loading"):"Save location"}
          </button>
        </div>
      )}

      {tab==="security"&&(
        <form onSubmit={changePassword}>
          <div style={{ background:"#111", border:"1px solid #1e1e1e", borderRadius:12, padding:"1.25rem" }}>
            <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, marginBottom:"1rem", color:"#f0ede6" }}>Change password</div>
            <label style={lbl}>New password</label>
            <input style={inp} type="password" name="password" placeholder="Min 6 characters" required/>
            <label style={lbl}>Confirm password</label>
            <input style={inp} type="password" name="confirm" placeholder="Repeat password" required/>
            <button type="submit"
              style={{ background:"#378add", border:"none", borderRadius:9, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"11px 24px", cursor:"pointer" }}>
              Change password
            </button>
          </div>
        </form>
      )}
    </div>
  )
}







