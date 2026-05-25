import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import toast from "react-hot-toast"
import { exportUserData, downloadJSON, downloadCSV, downloadPDF } from "../../lib/dataExport"
import { useLanguage } from "../../contexts/LanguageContext"

export default function DriverProfile() {
  const { user, profile, updateProfile } = useAuth()
  const { t } = useLanguage()
  const [sensitive, setSensitive] = useState({ phone:"", email:"", drivers_license:"" })
  const [form, setForm] = useState({ first_name:"", last_name:"", city:"" })
  const [reviews, setReviews] = useState([])
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState("info")

  useEffect(() => {
    if (profile) setForm({ first_name:profile.first_name||"", last_name:profile.last_name||"", city:profile.city||"" })
    if (user) { loadSensitive(); loadReviews() }
  }, [profile, user])

  async function loadSensitive() {
    const { data } = await supabase.from("profile_sensitive").select("phone,email,drivers_license").eq("id",user.id).single()
    if (data) setSensitive({ phone:data.phone||"", email:data.email||"", drivers_license:data.drivers_license||"" })
  }

  async function loadReviews() {
    const { data } = await supabase.from("reviews").select("driver_rating,driver_review,created_at,profile_public!reviews_customer_id_fkey(first_name,last_name)").eq("driver_id",user.id).not("driver_rating","is",null).order("created_at",{ascending:false})
    setReviews(data||[])
  }

  async function saveProfile(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await updateProfile(form)
      await supabase.from("profile_sensitive").update({ phone:sensitive.phone, drivers_license:sensitive.drivers_license }).eq("id",user.id)
      toast.success("Profile updated")
    } catch(err) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  async function changePassword(e) {
    e.preventDefault()
    const pw = e.target.password.value
    const confirm = e.target.confirm.value
    if (pw!==confirm) return toast.error("Passwords do not match")
    const { error } = await supabase.auth.updateUser({ password:pw })
    if (error) return toast.error(error.message)
    toast.success("Password changed")
    e.target.reset()
  }

  const avgRating = reviews.length>0 ? (reviews.reduce((s,r)=>s+(r.driver_rating||0),0)/reviews.length).toFixed(1) : "0.0"
  const initials = `${profile?.first_name?.[0]||""}${profile?.last_name?.[0]||""}`.toUpperCase()
  const inp = { width:"100%", background:"#111", border:"1px solid #222", borderRadius:8, padding:"10px 12px", color:"#f0ede6", fontSize:13, outline:"none", fontFamily:"'DM Sans',sans-serif", marginBottom:10 }
  const lbl = { fontSize:11, color:"#666", textTransform:"uppercase", letterSpacing:"0.05em", display:"block", marginBottom:4 }

  return (
    <div style={{ maxWidth:520 }}>
      <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:"1.5rem" }}>
        <div style={{ width:60, height:60, borderRadius:"50%", background:"#071a12", border:"2px solid #1d9e7540", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"Syne", fontSize:22, fontWeight:800, color:"#1d9e75" }}>
          {initials}
        </div>
        <div>
          <div style={{ fontFamily:"Syne", fontSize:17, fontWeight:800, color:"#f0ede6" }}>{profile?.first_name} {profile?.last_name}</div>
          <div style={{ fontSize:12, color:"#555", marginTop:2 }}>Driver · {profile?.city||"Location not set"}</div>
          <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:4 }}>
            <span style={{ color:"#e6821e", fontSize:14 }}>★</span>
            <span style={{ fontSize:13, fontWeight:600, color:"#f0ede6" }}>{avgRating}</span>
            <span style={{ fontSize:11, color:"#555" }}>({reviews.length} ratings)</span>
          </div>
        </div>
      </div>

      <div style={{ display:"flex", gap:6, marginBottom:"1.5rem" }}>
        {[{k:"info",l:"Profile"},{k:t("security"),l:t("security")},{k:"ratings",l:`Ratings (${reviews.length})`}].map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k)}
            style={{ padding:"8px 16px", borderRadius:8, border:"none", fontSize:12, cursor:"pointer", background:tab===t.k?"#1d9e75":"#111", color:tab===t.k?"#fff":"#666", fontFamily:"'DM Sans',sans-serif", fontWeight:tab===t.k?700:400 }}>
            {t.l}
          </button>
        ))}
      </div>

      {tab==="info"&&(
        <form onSubmit={saveProfile}>
          <div style={{ background:"#111", border:"1px solid #1e1e1e", borderRadius:12, padding:"1.25rem" }}>
            <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, marginBottom:"1rem", color:"#f0ede6" }}>Personal information</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              <div><label style={lbl}>First name</label><input style={inp} value={form.first_name} onChange={e=>setForm(f=>({...f,first_name:e.target.value}))} required/></div>
              <div><label style={lbl}>Last name</label><input style={inp} value={form.last_name} onChange={e=>setForm(f=>({...f,last_name:e.target.value}))} required/></div>
            </div>
            <label style={lbl}>City</label>
            <input style={inp} placeholder="e.g. Nairobi" value={form.city} onChange={e=>setForm(f=>({...f,city:e.target.value}))}/>
            <label style={lbl}>Phone</label>
            <input style={inp} placeholder="+254 700 000 000" value={sensitive.phone} onChange={e=>setSensitive(s=>({...s,phone:e.target.value}))}/>
            <label style={lbl}>Email</label>
            <input style={{ ...inp, color:"#555", cursor:"not-allowed" }} value={sensitive.email} readOnly/>
            <label style={lbl}>Driver license number</label>
            <input style={inp} placeholder="License number" value={sensitive.drivers_license} onChange={e=>setSensitive(s=>({...s,drivers_license:e.target.value}))}/>
            <button type="submit" disabled={saving}
              style={{ background:saving?"#333":"#1d9e75", border:"none", borderRadius:9, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"11px 24px", cursor:saving?"not-allowed":"pointer" }}>
              {saving?t("loading"):t("saveChanges")}
            </button>
          </div>
        </form>
      )}

      {tab===t("security")&&(
        <form onSubmit={changePassword}>
          <div style={{ background:"#111", border:"1px solid #1e1e1e", borderRadius:12, padding:"1.25rem" }}>
            <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, marginBottom:"1rem", color:"#f0ede6" }}>Change password</div>
            <label style={lbl}>New password</label>
            <input style={inp} type="password" name="password" placeholder="Min 6 characters" required/>
            <label style={lbl}>Confirm password</label>
            <input style={inp} type="password" name="confirm" placeholder="Repeat password" required/>
            <button type="submit"
              style={{ background:"#1d9e75", border:"none", borderRadius:9, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"11px 24px", cursor:"pointer" }}>
              Change password
            </button>
          </div>
        </form>
      )}

      {tab==="ratings"&&(
        <div>
          {reviews.length===0&&<div style={{ color:"#444", fontSize:13, textAlign:"center", padding:"2rem" }}>No ratings yet</div>}
          {reviews.map((r,i)=>(
            <div key={i} style={{ background:"#111", border:"1px solid #1e1e1e", borderRadius:10, padding:"1rem", marginBottom:8 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                <div style={{ fontSize:13, fontWeight:500, color:"#f0ede6" }}>{r.profile_public?.first_name} {r.profile_public?.last_name}</div>
                <div style={{ display:"flex", gap:1 }}>
                  {[1,2,3,4,5].map(s=><span key={s} style={{ color:s<=r.driver_rating?"#e6821e":"#333", fontSize:15 }}>★</span>)}
                </div>
              </div>
              {r.driver_review&&<div style={{ fontSize:12, color:"#888", fontStyle:"italic" }}>"{r.driver_review}"</div>}
              <div style={{ fontSize:10, color:"#444", marginTop:6 }}>{new Date(r.created_at).toLocaleDateString()}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

