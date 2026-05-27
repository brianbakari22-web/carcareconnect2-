import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import { useLanguage } from "../../contexts/LanguageContext"
import useIsMobile from "../../lib/useIsMobile"
import { exportUserData, downloadJSON, downloadCSV, downloadPDF } from "../../lib/dataExport"
import toast from "react-hot-toast"

export default function ProviderProfile() {
  const { profile, updateProfile, user } = useAuth()
  const { t } = useLanguage()
  const isMobile = useIsMobile()
  const [form, setForm] = useState({ first_name:"", last_name:"", business_name:"", city:"" })
  const [sensitive, setSensitive] = useState({ phone:"", email:"" })
  const [location, setLocation] = useState({ latitude:null, longitude:null, address:"" })
  const [saving, setSaving] = useState(false)
  const [locating, setLocating] = useState(false)
  const [tab, setTab] = useState("business")
  const [exporting, setExporting] = useState(false)
  const [exportData, setExportData] = useState(null)

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
    try { await updateProfile(form); toast.success(t("saveChanges")) }
    catch(err) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  async function saveContact(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await supabase.from("profile_sensitive").update({ phone:sensitive.phone }).eq("id", user.id)
      toast.success(t("saveChanges"))
    } catch(err) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  async function saveLocation(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await updateProfile({ latitude:parseFloat(location.latitude)||null, longitude:parseFloat(location.longitude)||null, city:form.city })
      toast.success("Location saved")
    } catch(err) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  async function detectLocation() {
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        setLocation(l=>({...l, latitude:lat, longitude:lng}))
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`)
          const data = await res.json()
          const city = data.address?.city || data.address?.town || data.address?.suburb || ""
          setLocation(l=>({...l, address:data.display_name||""}))
          if (city) setForm(f=>({...f, city}))
        } catch {}
        setLocating(false)
      },
      err => { toast.error("Could not get location"); setLocating(false) }
    )
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

  async function loadExportData() {
    setExporting(true)
    try { const data = await exportUserData(user.id); setExportData(data) }
    catch(err) { toast.error(err.message) }
    finally { setExporting(false) }
  }

  const initials = `${profile?.first_name?.[0]||""}${profile?.last_name?.[0]||""}`.toUpperCase()
  const inp = { width:"100%", background:"#111", border:"1px solid #222", borderRadius:8, padding:"11px 12px", color:"#f0ede6", fontSize:13, outline:"none", fontFamily:"'DM Sans',sans-serif", marginBottom:12 }
  const lbl = { fontSize:11, color:"#666", textTransform:"uppercase", letterSpacing:"0.05em", display:"block", marginBottom:4 }

  const TABS = [
    { k:"business", l:t("businessInfo") },
    { k:"contact", l:t("contactDetails") },
    { k:"location", l:"Location" },
    { k:"security", l:t("security") },
    { k:"data", l:"My Data" },
  ]

  return (
    <div style={{ maxWidth:isMobile?"100%":520 }}>
      <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:"1.5rem" }}>
        <div style={{ width:60, height:60, borderRadius:14, background:"#0c1f2e", border:"2px solid #378add40", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"Syne", fontSize:22, fontWeight:800, color:"#378add" }}>
          {initials}
        </div>
        <div>
          <div style={{ fontFamily:"Syne", fontSize:17, fontWeight:800, color:"#f0ede6" }}>{profile?.business_name||`${profile?.first_name} ${profile?.last_name}`}</div>
          <div style={{ fontSize:12, color:"#555", marginTop:2 }}>Provider · {profile?.city||"Location not set"}</div>
        </div>
      </div>

      <div style={{ display:"flex", gap:6, marginBottom:"1.5rem", flexWrap:"wrap" }}>
        {TABS.map(tb=>(
          <button key={tb.k} onClick={()=>{ setTab(tb.k); if(tb.k==="data"&&!exportData) loadExportData() }}
            style={{ padding:"8px 14px", borderRadius:8, border:"none", fontSize:12, cursor:"pointer", background:tab===tb.k?"#378add":"#111", color:tab===tb.k?"#fff":"#666", fontFamily:"'DM Sans',sans-serif", fontWeight:tab===tb.k?700:400 }}>
            {tb.l}
          </button>
        ))}
      </div>

      {tab==="business"&&(
        <form onSubmit={saveProfile}>
          <div style={{ background:"#111", border:"1px solid #1e1e1e", borderRadius:12, padding:"1.25rem" }}>
            <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, marginBottom:"1rem", color:"#f0ede6" }}>{t("businessInfo")}</div>
            <label style={lbl}>Business name</label>
            <input style={inp} placeholder="Your business name" value={form.business_name} onChange={e=>setForm(f=>({...f,business_name:e.target.value}))}/>
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:10 }}>
              <div><label style={lbl}>{t("firstName")}</label><input style={inp} value={form.first_name} onChange={e=>setForm(f=>({...f,first_name:e.target.value}))} required/></div>
              <div><label style={lbl}>{t("lastName")}</label><input style={inp} value={form.last_name} onChange={e=>setForm(f=>({...f,last_name:e.target.value}))} required/></div>
            </div>
            <label style={lbl}>{t("city")}</label>
            <input style={inp} placeholder="e.g. Nairobi" value={form.city} onChange={e=>setForm(f=>({...f,city:e.target.value}))}/>
            <button type="submit" disabled={saving}
              style={{ background:saving?"#333":"#378add", border:"none", borderRadius:9, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"11px 24px", cursor:saving?"not-allowed":"pointer" }}>
              {saving?t("saving"):t("saveChanges")}
            </button>
          </div>
        </form>
      )}

      {tab==="contact"&&(
        <form onSubmit={saveContact}>
          <div style={{ background:"#111", border:"1px solid #1e1e1e", borderRadius:12, padding:"1.25rem" }}>
            <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, marginBottom:"1rem", color:"#f0ede6" }}>{t("contactDetails")}</div>
            <label style={lbl}>{t("email")}</label>
            <input style={{ ...inp, color:"#555", cursor:"not-allowed" }} value={sensitive.email} readOnly/>
            <label style={lbl}>{t("phone")}</label>
            <input style={inp} placeholder="+254 700 000 000" value={sensitive.phone} onChange={e=>setSensitive(s=>({...s,phone:e.target.value}))}/>
            <button type="submit" disabled={saving}
              style={{ background:saving?"#333":"#378add", border:"none", borderRadius:9, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"11px 24px", cursor:saving?"not-allowed":"pointer" }}>
              {saving?t("saving"):t("saveChanges")}
            </button>
          </div>
        </form>
      )}

      {tab==="location"&&(
        <form onSubmit={saveLocation}>
          <div style={{ background:"#111", border:"1px solid #1e1e1e", borderRadius:12, padding:"1.25rem" }}>
            <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, marginBottom:4, color:"#f0ede6" }}>Shop location</div>
            <div style={{ fontSize:12, color:"#555", marginBottom:"1rem" }}>Help customers find you and enable distance-based search</div>
            <button type="button" onClick={detectLocation} disabled={locating}
              style={{ background:locating?"#333":"#071a12", border:"1px solid #1d9e7540", borderRadius:9, color:"#1d9e75", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"10px 20px", cursor:locating?"not-allowed":"pointer", marginBottom:16, width:"100%" }}>
              {locating?"Detecting...":"📍 Use my current location"}
            </button>
            {location.address&&<div style={{ fontSize:11, color:"#555", marginBottom:12, padding:"0.6rem", background:"#0f0f0f", borderRadius:7 }}>{location.address}</div>}
            <label style={lbl}>Or enter coordinates manually</label>
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:10 }}>
              <div>
                <label style={{ ...lbl, marginBottom:4 }}>Latitude</label>
                <input style={inp} placeholder="-1.2921" value={location.latitude||""} onChange={e=>setLocation(l=>({...l,latitude:e.target.value}))}/>
              </div>
              <div>
                <label style={{ ...lbl, marginBottom:4 }}>Longitude</label>
                <input style={inp} placeholder="36.8219" value={location.longitude||""} onChange={e=>setLocation(l=>({...l,longitude:e.target.value}))}/>
              </div>
            </div>
            <button type="submit" disabled={saving}
              style={{ background:saving?"#333":"#378add", border:"none", borderRadius:9, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"11px 24px", cursor:saving?"not-allowed":"pointer" }}>
              {saving?"Saving...":"Save location"}
            </button>
          </div>
        </form>
      )}

      {tab==="security"&&(
        <form onSubmit={changePassword}>
          <div style={{ background:"#111", border:"1px solid #1e1e1e", borderRadius:12, padding:"1.25rem" }}>
            <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, marginBottom:"1rem", color:"#f0ede6" }}>{t("changePassword")}</div>
            <label style={lbl}>{t("newPassword")}</label>
            <input style={inp} type="password" name="password" placeholder="Min 6 characters" required/>
            <label style={lbl}>{t("confirmPassword")}</label>
            <input style={inp} type="password" name="confirm" placeholder="Repeat password" required/>
            <button type="submit"
              style={{ background:"#378add", border:"none", borderRadius:9, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"11px 24px", cursor:"pointer" }}>
              {t("changePassword")}
            </button>
          </div>
        </form>
      )}

      {tab==="data"&&(
        <div>
          <div style={{ background:"#111", border:"1px solid #1e1e1e", borderRadius:12, padding:"1.25rem", marginBottom:"1rem" }}>
            <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, marginBottom:4, color:"#f0ede6" }}>Your data</div>
            <div style={{ fontSize:12, color:"#666", marginBottom:"1.25rem", lineHeight:1.6 }}>
              Download all data we hold about you under the Kenya Data Protection Act 2019.
            </div>
            {exporting&&<div style={{ color:"#555", fontSize:13, marginBottom:"1rem" }}>Loading your data...</div>}
            {exportData&&(
              <div style={{ marginBottom:"1.25rem" }}>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginBottom:"1rem" }}>
                  {[
                    { label:"Bookings", value:exportData.bookings.length },
                    { label:"Payments", value:exportData.payments.length },
                    { label:"Reviews", value:exportData.reviews.length },
                  ].map(s=>(
                    <div key={s.label} style={{ background:"#0f0f0f", border:"1px solid #222", borderRadius:8, padding:"0.75rem", textAlign:"center" }}>
                      <div style={{ fontFamily:"Syne", fontSize:18, fontWeight:800, color:"#378add" }}>{s.value}</div>
                      <div style={{ fontSize:10, color:"#555", marginTop:2 }}>{s.label}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                  <button onClick={()=>downloadPDF(exportData, `provider-data-${new Date().toISOString().split("T")[0]}.pdf`)}
                    style={{ background:"#071a12", border:"1px solid #1d9e7540", borderRadius:8, color:"#1d9e75", fontSize:12, fontWeight:600, padding:"9px 16px", cursor:"pointer" }}>
                    ⬇ Download PDF report
                  </button>
                  <button onClick={()=>downloadCSV(exportData.bookings, `bookings-${new Date().toISOString().split("T")[0]}.csv`)}
                    style={{ background:"#0c1f2e", border:"1px solid #378add40", borderRadius:8, color:"#378add", fontSize:12, fontWeight:600, padding:"9px 16px", cursor:"pointer" }}>
                    ⬇ Bookings CSV
                  </button>
                </div>
              </div>
            )}
            {!exporting&&!exportData&&(
              <button onClick={loadExportData}
                style={{ background:"#378add", border:"none", borderRadius:9, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"11px 24px", cursor:"pointer" }}>
                Load my data
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
