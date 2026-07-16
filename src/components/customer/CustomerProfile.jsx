import useIsMobile from "../../lib/useIsMobile"
import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { sanitizeName, sanitizePhone, sanitizeFreeText } from "../../lib/sanitize"
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

  async function requestDeleteAccount() {
    const { data: activeBookings } = await supabase.from("bookings")
      .select("id").eq("customer_id", user.id).in("status",["pending","confirmed","in-progress"])
    if(activeBookings?.length > 0) return toast.error("You have active bookings. Resolve them before deleting your account.")
    const { data: activeTxns } = await supabase.from("marketplace_transactions")
      .select("id").eq("buyer_id", user.id).eq("buyer_confirmed", false).in("payment_status",["paid","processing"])
    if(activeTxns?.length > 0) return toast.error("You have pending marketplace transactions. Complete them first.")
    if(!window.confirm("Delete your account? All data will be permanently removed within 7 days. This cannot be undone.")) return
    setDeletingAccount(true)
    try {
      await supabase.from("profiles").update({ deletion_requested:true, deletion_requested_at:new Date().toISOString() }).eq("id", user.id)
      await supabase.from("notifications").insert({ user_id:user.id, type:"account_deletion", title:"Account deletion requested", message:"Your account will be deleted within 7 days. Contact us if this was a mistake." })
      toast.success("Account deletion requested. You will be signed out now.")
      setTimeout(() => supabase.auth.signOut(), 2000)
    } catch(e) { toast.error(e.message) }
    finally { setDeletingAccount(false) }
  }

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
          {k:"account",l:"Account"},
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
            {/* Header */}
            <div style={{ background:"linear-gradient(135deg,#fff8f0,#fff)", border:"1px solid #e6821e20", borderRadius:12, padding:"1rem", marginBottom:"1rem" }}>
              <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:800, color:"#000", marginBottom:4 }}>📦 My Personal Data</div>
              <div style={{ fontSize:12, color:"#666", lineHeight:1.7 }}>Under Kenya Data Protection Act, you have the right to download or delete all your personal data stored on Car Care Connect.</div>
            </div>
            {exporting&&(
              <div style={{ textAlign:"center", padding:"2rem", color:"#888", fontSize:13 }}>
                <div style={{ fontSize:32, marginBottom:8 }}>⏳</div>
                Loading your data...
              </div>
            )}
            {!exporting&&!exportData&&(
              <div>
                <button onClick={loadExportData} style={{ width:"100%", background:"#e6821e", border:"none", borderRadius:10, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:14, fontWeight:700, padding:"14px", cursor:"pointer", marginBottom:"0.75rem" }}>
                  📂 Load my data
                </button>
                <div style={{ fontSize:11, color:"#aaa", textAlign:"center" }}>We will compile all your data. This may take a few seconds.</div>
              </div>
            )}
            {exportData&&(
              <div>
                <div style={{ fontFamily:"Syne", fontSize:12, fontWeight:700, color:"#555", marginBottom:8, textTransform:"uppercase", letterSpacing:"0.05em" }}>Your data summary</div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:"1.25rem" }}>
                  {[
                    { label:"Bookings", value:exportData.bookings?.length||0, icon:"📅", color:"#378add" },
                    { label:"Payments", value:exportData.payments?.length||0, icon:"💳", color:"#1d9e75" },
                    { label:"Vehicles", value:exportData.vehicles?.length||0, icon:"🚗", color:"#e6821e" },
                    { label:"Reviews", value:exportData.reviews?.length||0, icon:"⭐", color:"#f59e0b" },
                    { label:"Points", value:exportData.loyaltyPoints||0, icon:"🎁", color:"#8b5cf6" },
                    { label:"Claims", value:exportData.claims?.length||0, icon:"🛡️", color:"#e24b4a" },
                  ].map(item=>(
                    <div key={item.label} style={{ background:"#f8f8f8", borderRadius:10, padding:"0.75rem 0.5rem", textAlign:"center", border:"1px solid #eee" }}>
                      <div style={{ fontSize:20, marginBottom:4 }}>{item.icon}</div>
                      <div style={{ fontFamily:"Syne", fontSize:16, fontWeight:800, color:item.color }}>{item.value}</div>
                      <div style={{ fontSize:10, color:"#888", marginTop:2 }}>{item.label}</div>
                    </div>
                  ))}
                </div>
                <div style={{ fontFamily:"Syne", fontSize:12, fontWeight:700, color:"#555", marginBottom:8, textTransform:"uppercase", letterSpacing:"0.05em" }}>Download formats</div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr", gap:8, marginBottom:"1rem" }}>
                  <button onClick={()=>downloadJSON(exportData)} style={{ background:"#fff", border:"1px solid #378add", borderRadius:10, color:"#378add", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"12px", cursor:"pointer", display:"flex", alignItems:"center", gap:8 }}>
                    <span>📦</span><span>Download as JSON</span><span style={{ marginLeft:"auto", fontSize:10, color:"#aaa" }}>Full data export</span>
                  </button>
                  <button onClick={()=>downloadCSV(exportData)} style={{ background:"#fff", border:"1px solid #1d9e75", borderRadius:10, color:"#1d9e75", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"12px", cursor:"pointer", display:"flex", alignItems:"center", gap:8 }}>
                    <span>📊</span><span>Download as CSV</span><span style={{ marginLeft:"auto", fontSize:10, color:"#aaa" }}>Spreadsheet format</span>
                  </button>
                  <button onClick={()=>downloadPDF(exportData)} style={{ background:"#fff", border:"1px solid #e6821e", borderRadius:10, color:"#e6821e", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"12px", cursor:"pointer", display:"flex", alignItems:"center", gap:8 }}>
                    <span>📄</span><span>Download as PDF</span><span style={{ marginLeft:"auto", fontSize:10, color:"#aaa" }}>Printable report</span>
                  </button>
                </div>
                <button onClick={()=>setExportData(null)} style={{ width:"100%", background:"none", border:"1px solid #eee", borderRadius:8, color:"#888", fontSize:12, padding:"8px", cursor:"pointer" }}>
                  🔄 Reload data
                </button>
              </div>
            )}
          </div>
      )}
      {tab==="account"&&(
        <div>
          <div style={{ background:"#fff", border:"1px solid #eee", borderRadius:12, padding:"1.25rem", marginBottom:12 }}>
            <div style={{ fontFamily:"Syne", fontSize:15, fontWeight:700, marginBottom:4 }}>Account information</div>
            <div style={{ fontSize:13, color:"#888" }}>Account ID: {user?.id?.slice(0,8)}...</div>
          </div>
          <div style={{ background:"#fff5f5", border:"1px solid #e24b4a30", borderRadius:12, padding:"1.25rem" }}>
            <div style={{ fontFamily:"Syne", fontSize:15, fontWeight:700, color:"#e24b4a", marginBottom:6 }}>Danger Zone</div>
            <div style={{ fontSize:13, color:"#666", marginBottom:12, lineHeight:1.6 }}>
              Deleting your account permanently removes all your personal data within 7 days. Active bookings must be resolved first.
            </div>
            <button onClick={requestDeleteAccount} disabled={deletingAccount}
              style={{ background:"#fff", border:"1px solid #e24b4a", borderRadius:8, color:"#e24b4a", fontSize:13, fontWeight:600, padding:"10px 20px", cursor:"pointer" }}>
              {deletingAccount?"Processing...":"Request Account Deletion"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
