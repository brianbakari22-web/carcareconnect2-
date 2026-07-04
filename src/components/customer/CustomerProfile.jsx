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
  const [deletingAccount, setDeletingAccount] = useState(false)
  const [pendingDeletion, setPendingDeletion] = useState(null)
  const [exportData, setExportData] = useState(null)

  useEffect(() => {
    if (profile) setForm({ first_name:profile?.first_name||"", last_name:profile?.last_name||"", city:profile?.city||"" })
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
    setDeletingAccount(true)
    try {
      const { data: check } = await supabase.rpc("check_account_deletable", { user_id: user.id })
      if (!check.can_delete) {
        let blockers = []
        if (check.active_bookings > 0) blockers.push(check.active_bookings + " active booking(s)")
        if (check.pending_payments > 0) blockers.push(check.pending_payments + " pending payment(s)")
        if (check.open_claims > 0) blockers.push(check.open_claims + " open claim(s)")
        if (check.active_orders > 0) blockers.push(check.active_orders + " active order(s)")
        if (check.pending_payouts > 0) blockers.push(check.pending_payouts + " pending payout(s)")
        toast.error("Cannot delete account: " + blockers.join(", "), { duration:6000 })
        setDeletingAccount(false); return
      }
      const { data: existing } = await supabase.from("deletion_requests")
        .select("*").eq("user_id", user.id).eq("status","pending").maybeSingle()
      if (existing) {
        const hoursLeft = Math.ceil((new Date(existing.scheduled_for) - new Date()) / 3600000)
        toast("Deletion already scheduled in " + hoursLeft + " hour(s). Log in to cancel.", { duration:6000 })
        setDeletingAccount(false); return
      }
      if (!window.confirm("Delete your account?\\n\\nYour account will be permanently deleted in 24 hours.\\nYou can cancel by logging in within 24 hours.")) {
        setDeletingAccount(false); return
      }
      await supabase.from("deletion_requests").insert({
        user_id: user.id,
        scheduled_for: new Date(Date.now() + 24*60*60*1000).toISOString(),
        status: "pending"
      })
      await supabase.from("notifications").insert({
        user_id: user.id, title: "Account deletion scheduled ⚠️",
        message: "Your account will be deleted in 24 hours. Log in to your profile to cancel.", type: "error"
      })
      toast.success("Account deletion scheduled. You have 24 hours to cancel by logging in.", { duration:8000 })
      setPendingDeletion({ scheduled_for: new Date(Date.now() + 24*60*60*1000).toISOString() })
    } catch(err) { toast.error(err.message) }
    setDeletingAccount(false)
  }

  const initials = `${profile?.first_name?.[0]||""}${profile?.last_name?.[0]||""}`.toUpperCase()
  const inp = { width:"100%", background:"#ffffff", border:"1px solid #e5e5e5", borderRadius:8, padding:"11px 12px", color:"#000000", fontSize:13, outline:"none", fontFamily:"'DM Sans',sans-serif", marginBottom:12 }
  const lbl = { fontSize:11, color:"#666", textTransform:"uppercase", letterSpacing:"0.05em", display:"block", marginBottom:4 }

  return (
    <div style={{ maxWidth:isMobile?"100%":520 }}>
      <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:"1.5rem" }}>
        <div style={{ width:60, height:60, borderRadius:14, background:"#fff8f0", border:"2px solid #e6821e40", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"Syne", fontSize:22, fontWeight:800, color:"#e6821e" }}>
          {initials}
        </div>
        <div>
          <div style={{ fontFamily:"Syne", fontSize:17, fontWeight:800, color:"#000000" }}>{profile?.first_name} {profile?.last_name}</div>
          <div style={{ fontSize:12, color:"#777777", marginTop:2 }}>Customer · {profile?.city||"Location not set"}</div>
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
            style={{ padding:"8px 14px", borderRadius:8, border:"none", fontSize:12, cursor:"pointer", background:tab===tab2.k?"#e6821e":"#555555", color:tab===tab2.k?"#fff":"#666", fontFamily:"'DM Sans',sans-serif", fontWeight:tab===tab2.k?700:400 }}>
            {tab2.l}
          </button>
        ))}
      </div>

      {tab==="profile"&&(
        <form onSubmit={saveProfile}>
          <div style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:12, padding:"1.25rem" }}>
            <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, marginBottom:"1rem", color:"#000000" }}>{t("profile")}</div>
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:10 }}>
              <div><label style={lbl}>Profile photo</label>
            <div style={{ marginBottom:12 }}>
              {profile?.profile_photo_url&&<img src={profile.profile_photo_url} alt="Profile" style={{ width:80, height:80, borderRadius:"50%", objectFit:"cover", marginBottom:8, border:"2px solid #e6821e" }}/>}
              <input type="file" accept="image/*" onChange={async(e)=>{
                const file = e.target.files[0]
                if (!file) return
                const ext = file.name.split(".").pop()
                const path = `${user.id}/profile-${Date.now()}.${ext}`
                const { error } = await supabase.storage.from("provider-photos").upload(path, file, { upsert:true })
                if (error) return toast.error(error.message)
                const { data } = supabase.storage.from("provider-photos").getPublicUrl(path)
                await updateProfile({ profile_photo_url: data.publicUrl })
                toast.success("Photo updated!")
              }} style={{ width:"100%", background:"#ffffff", border:"1px solid #e5e5e5", borderRadius:8, padding:"8px", color:"#555555", fontSize:12, marginBottom:8 }}/>
            </div>
            <label style={lbl}>{t("firstName")}</label><input style={inp} value={form.first_name} onChange={e=>setForm(f=>({...f,first_name:e.target.value}))} required/></div>
              <div><label style={lbl}>{t("lastName")}</label><input style={inp} value={form.last_name} onChange={e=>setForm(f=>({...f,last_name:e.target.value}))} required/></div>
            </div>
            <label style={lbl}>{t("city")}</label>
            <input style={inp} placeholder="e.g. Nairobi" value={form.city} onChange={e=>setForm(f=>({...f,city:e.target.value}))}/>
            <button type="submit" disabled={saving}
              style={{ background:saving?"#555555":"#e6821e", border:"none", borderRadius:9, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"11px 24px", cursor:saving?"not-allowed":"pointer" }}>
              {saving?t("saving"):t("saveChanges")}
            </button>
          </div>
        </form>
      )}

      {tab==="contact"&&(
        <form onSubmit={saveContact}>
          <div style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:12, padding:"1.25rem" }}>
            <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, marginBottom:"1rem", color:"#000000" }}>{t("contactDetails")}</div>
            <label style={lbl}>{t("email")}</label>
            <input style={{ ...inp, color:"#777777", cursor:"not-allowed" }} value={sensitive.email} readOnly/>
            <label style={lbl}>{t("phone")}</label>
            <input style={inp} placeholder="+254 700 000 000" value={sensitive.phone} onChange={e=>setSensitive(s=>({...s,phone:e.target.value}))}/>
            <button type="submit" disabled={saving}
              style={{ background:saving?"#555555":"#e6821e", border:"none", borderRadius:9, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"11px 24px", cursor:saving?"not-allowed":"pointer" }}>
              {saving?t("saving"):t("saveChanges")}
            </button>
          </div>
        </form>
      )}

      {tab==="security"&&(
        <form onSubmit={changePassword}>
          <div style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:12, padding:"1.25rem" }}>
            <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, marginBottom:"1rem", color:"#000000" }}>{t("changePassword")}</div>
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
          <div style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:12, padding:"1.25rem", marginBottom:"1rem" }}>
            <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, marginBottom:4, color:"#000000" }}>Your data</div>
            <div style={{ fontSize:12, color:"#666", marginBottom:"1.25rem", lineHeight:1.6 }}>
              Under the Kenya Data Protection Act 2019, you have the right to access and download all data we hold about you.
            </div>

            {exporting&&<div style={{ color:"#777777", fontSize:13, marginBottom:"1rem" }}>Loading your data...</div>}

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
                    <div key={s.label} style={{ background:"#ffffff", border:"1px solid #e5e5e5", borderRadius:8, padding:"0.75rem", textAlign:"center" }}>
                      <div style={{ fontFamily:"Syne", fontSize:18, fontWeight:800, color:"#e6821e" }}>{s.value}</div>
                      <div style={{ fontSize:10, color:"#777777", marginTop:2 }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                  <button onClick={()=>downloadPDF(exportData, `carcareconnect-data-${new Date().toISOString().split("T")[0]}.pdf`)}
                    style={{ background:"#f0fdf4", border:"1px solid #1d9e7540", borderRadius:8, color:"#1d9e75", fontSize:12, fontWeight:600, padding:"9px 16px", cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>
                    ⬇ Download PDF report
                  </button>
                  <button onClick={()=>downloadCSV(exportData.bookings, `bookings-${new Date().toISOString().split("T")[0]}.csv`)}
                    style={{ background:"#eff6ff", border:"1px solid #378add40", borderRadius:8, color:"#378add", fontSize:12, fontWeight:600, padding:"9px 16px", cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>
                    ⬇ Bookings CSV
                  </button>
                  <button onClick={()=>downloadCSV(exportData.payments, `payments-${new Date().toISOString().split("T")[0]}.csv`)}
                    style={{ background:"#eff6ff", border:"1px solid #378add40", borderRadius:8, color:"#378add", fontSize:12, fontWeight:600, padding:"9px 16px", cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>
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

          <div style={{ background:"#fff5f5", border:"1px solid #e24b4a20", borderRadius:12, padding:"1.25rem" }}>
            <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, marginBottom:4, color:"#e24b4a" }}>Delete account</div>
            {pendingDeletion ? (
              <div>
                <div style={{ background:"#fff3cd", border:"1px solid #ffc10730", borderRadius:8, padding:"0.75rem", marginBottom:"1rem", fontSize:12, color:"#856404", lineHeight:1.6 }}>
                  ⚠️ Your account is scheduled for deletion on <strong>{new Date(pendingDeletion.scheduled_for).toLocaleString()}</strong>. Cancel below to keep your account.
                </div>
                <button onClick={async()=>{ await supabase.from("deletion_requests").update({status:"cancelled"}).eq("user_id",user.id).eq("status","pending"); setPendingDeletion(null); toast.success("Account deletion cancelled!") }}
                  style={{ background:"#1d9e75", border:"none", borderRadius:9, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"10px 20px", cursor:"pointer" }}>
                  ✅ Cancel deletion — keep my account
                </button>
              </div>
            ) : (
              <div>
                <div style={{ fontSize:12, color:"#666", marginBottom:"1rem", lineHeight:1.6 }}>
                  Your account will be scheduled for deletion in 24 hours. You can cancel at any time within that window. Financial records are retained for 7 years as required by Kenyan law.
                </div>
                <button onClick={handleDeleteAccount} disabled={deletingAccount}
                  style={{ background:"none", border:"1px solid #e24b4a", borderRadius:9, color:"#e24b4a", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"10px 20px", cursor:"pointer" }}>
                  {deletingAccount ? "Checking..." : "🗑️ Request account deletion"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}






