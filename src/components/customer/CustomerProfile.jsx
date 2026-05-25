import useIsMobile from "../../lib/useIsMobile"
import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import { useLanguage } from "../../contexts/LanguageContext"
import { exportUserData, downloadJSON, downloadCSV, downloadPDF } from "../../lib/dataExport"
import toast from "react-hot-toast"

export default function CustomerProfile() {
  const isMobile = useIsMobile()
  const { profile, updateProfile, user } = useAuth()
  const { t } = useLanguage()
  const [form, setForm] = useState({ first_name:"", last_name:"", city:"" })
  const [sensitive, setSensitive] = useState({ phone:"", email:"" })
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState("profile")
  const [exporting, setExporting] = useState(false)
  const [exportData, setExportData] = useState(null)

  useEffect(() => {
    if (profile) setForm({ first_name:profile.first_name||"", last_name:profile.last_name||"", city:profile.city||"" })
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
    try {
      const data = await exportUserData(user.id)
      setExportData(data)
    } catch(err) { toast.error(err.message) }
    finally { setExporting(false) }
  }

  async function handleDeleteAccount() {
    if (!confirm("Are you sure you want to delete your account? This cannot be undone.")) return
    if (!confirm("All your data including bookings, payments and loyalty points will be permanently deleted. Continue?")) return
    const { error } = await supabase.rpc("delete_user_account")
    if (error) {
      await supabase.from("support_tickets").insert({
        customer_id: user.id,
        subject: "Account deletion request",
        category: "other",
        priority: "high",
        status: "open"
      })
      toast.success("Deletion request submitted. Our team will process it within 30 days.")
    }
  }

  const initials = `${profile?.first_name?.[0]||""}${profile?.last_name?.[0]||""}`.toUpperCase()
  const inp = { width:"100%", background:"#111", border:"1px solid #222", borderRadius:8, padding:"11px 12px", color:"#f0ede6", fontSize:13, outline:"none", fontFamily:"'DM Sans',sans-serif", marginBottom:12 }
  const lbl = { fontSize:11, color:"#666", textTransform:"uppercase", letterSpacing:"0.05em", display:"block", marginBottom:4 }

  return (
    <div style={{ maxWidth:isMobile?"100%":520 }}>
      <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:"1.5rem" }}>
        <div style={{ width:60, height:60, borderRadius:14, background:"#1a1208", border:"2px solid #e6821e40", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"Syne", fontSize:22, fontWeight:800, color:"#e6821e" }}>
          {initials}
        </div>
        <div>
          <div style={{ fontFamily:"Syne", fontSize:17, fontWeight:800, color:"#f0ede6" }}>{profile?.first_name} {profile?.last_name}</div>
          <div style={{ fontSize:12, color:"#555", marginTop:2 }}>Customer · {profile?.city||"Location not set"}</div>
        </div>
      </div>

      <div style={{ display:"flex", gap:6, marginBottom:"1.5rem", flexWrap:"wrap" }}>
        {[
          {k:"profile",l:t("profile")},
          {k:"contact",l:t("contactDetails")},
          {k:"security",l:t("security")},
          {k:"data",l:"My Data"},
        ].map(tab2=>(
          <button key={tab2.k} onClick={()=>{ setTab(tab2.k); if(tab2.k==="data"&&!exportData) loadExportData() }}
            style={{ padding:"8px 14px", borderRadius:8, border:"none", fontSize:12, cursor:"pointer", background:tab===tab2.k?"#e6821e":"#111", color:tab===tab2.k?"#fff":"#666", fontFamily:"'DM Sans',sans-serif", fontWeight:tab===tab2.k?700:400 }}>
            {tab2.l}
          </button>
        ))}
      </div>

      {tab==="profile"&&(
        <form onSubmit={saveProfile}>
          <div style={{ background:"#111", border:"1px solid #1e1e1e", borderRadius:12, padding:"1.25rem" }}>
            <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, marginBottom:"1rem", color:"#f0ede6" }}>{t("profile")}</div>
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:10 }}>
              <div><label style={lbl}>{t("firstName")}</label><input style={inp} value={form.first_name} onChange={e=>setForm(f=>({...f,first_name:e.target.value}))} required/></div>
              <div><label style={lbl}>{t("lastName")}</label><input style={inp} value={form.last_name} onChange={e=>setForm(f=>({...f,last_name:e.target.value}))} required/></div>
            </div>
            <label style={lbl}>{t("city")}</label>
            <input style={inp} placeholder="e.g. Nairobi" value={form.city} onChange={e=>setForm(f=>({...f,city:e.target.value}))}/>
            <button type="submit" disabled={saving}
              style={{ background:saving?"#333":"#e6821e", border:"none", borderRadius:9, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"11px 24px", cursor:saving?"not-allowed":"pointer" }}>
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
              style={{ background:saving?"#333":"#e6821e", border:"none", borderRadius:9, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"11px 24px", cursor:saving?"not-allowed":"pointer" }}>
              {saving?t("saving"):t("saveChanges")}
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
              style={{ background:"#e6821e", border:"none", borderRadius:9, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"11px 24px", cursor:"pointer" }}>
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
              Under the Kenya Data Protection Act 2019, you have the right to access and download all data we hold about you.
            </div>

            {exporting&&<div style={{ color:"#555", fontSize:13, marginBottom:"1rem" }}>Loading your data...</div>}

            {exportData&&(
              <div style={{ marginBottom:"1.25rem" }}>
                <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"repeat(3,1fr)", gap:8, marginBottom:"1rem" }}>
                  {[
                    { label:"Bookings", value:exportData.bookings.length },
                    { label:"Payments", value:exportData.payments.length },
                    { label:"Reviews", value:exportData.reviews.length },
                    { label:"Notifications", value:exportData.notifications.length },
                    { label:"Support tickets", value:exportData.support_tickets.length },
                    { label:"Vehicles", value:exportData.vehicles.length },
                  ].map(s=>(
                    <div key={s.label} style={{ background:"#0f0f0f", border:"1px solid #222", borderRadius:8, padding:"0.75rem", textAlign:"center" }}>
                      <div style={{ fontFamily:"Syne", fontSize:18, fontWeight:800, color:"#e6821e" }}>{s.value}</div>
                      <div style={{ fontSize:10, color:"#555", marginTop:2 }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                  <button onClick={()=>downloadPDF(exportData, `carcareconnect-data-${new Date().toISOString().split("T")[0]}.pdf`)}
                    style={{ background:"#071a12", border:"1px solid #1d9e7540", borderRadius:8, color:"#1d9e75", fontSize:12, fontWeight:600, padding:"9px 16px", cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>
                    ⬇ Download PDF report
                  </button>
                  <button onClick={()=>downloadCSV(exportData.bookings, `bookings-${new Date().toISOString().split("T")[0]}.csv`)}
                    style={{ background:"#0c1f2e", border:"1px solid #378add40", borderRadius:8, color:"#378add", fontSize:12, fontWeight:600, padding:"9px 16px", cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>
                    ⬇ Bookings CSV
                  </button>
                  <button onClick={()=>downloadCSV(exportData.payments, `payments-${new Date().toISOString().split("T")[0]}.csv`)}
                    style={{ background:"#0c1f2e", border:"1px solid #378add40", borderRadius:8, color:"#378add", fontSize:12, fontWeight:600, padding:"9px 16px", cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>
                    ⬇ Payments CSV
                  </button>
                </div>
              </div>
            )}

            {!exporting&&!exportData&&(
              <button onClick={loadExportData}
                style={{ background:"#e6821e", border:"none", borderRadius:9, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"11px 24px", cursor:"pointer" }}>
                Load my data
              </button>
            )}
          </div>

          <div style={{ background:"#1a0808", border:"1px solid #e24b4a20", borderRadius:12, padding:"1.25rem" }}>
            <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, marginBottom:4, color:"#e24b4a" }}>Delete account</div>
            <div style={{ fontSize:12, color:"#666", marginBottom:"1rem", lineHeight:1.6 }}>
              Permanently delete your account and all associated data. This action cannot be undone.
            </div>
            <button onClick={handleDeleteAccount}
              style={{ background:"none", border:"1px solid #e24b4a", borderRadius:9, color:"#e24b4a", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"10px 20px", cursor:"pointer" }}>
              Request account deletion
            </button>
          </div>
        </div>
      )}
    </div>
  )
}



