import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import { useLanguage } from "../../contexts/LanguageContext"
import useIsMobile from "../../lib/useIsMobile"
import toast from "react-hot-toast"

const LICENSE_CLASSES = ["Class B - Light Motor Vehicle", "Class C - Heavy Motor Vehicle", "Class D - Motorcycle", "Class E - PSV", "Class F - Special Vehicle"]

const DRIVER_VEHICLE_TYPES = [
  { key:"car", label:"Car", icon:"🚗", desc:"Standard delivery" },
  { key:"motorcycle", label:"Boda Boda", icon:"🏍️", desc:"Fast parts delivery" },
  { key:"tuktuk", label:"Tuktuk", icon:"🛺", desc:"Local delivery" },
  { key:"van", label:"Van/Pickup", icon:"🚐", desc:"Large items" },
]

export default function DriverProfile() {
  const { user, profile, updateProfile } = useAuth()
  const { t } = useLanguage()
  const isMobile = useIsMobile()
  const [tab, setTab] = useState("personal")
  const [saving, setSaving] = useState(false)
  const [stats, setStats] = useState({ total:0, completed:0, rating:0, earnings:0 })
  const [sensitive, setSensitive] = useState({ phone:"", email:"" })

  const [vehicleType, setVehicleType] = useState("car")
  const [personalForm, setPersonalForm] = useState({
    first_name:"", last_name:"", city:""
  })

  const [idDocFile, setIdDocFile] = useState(null)
  const [idDocBackFile, setIdDocBackFile] = useState(null)
  const [goodConductFile, setGoodConductFile] = useState(null)
  const [licenseDocFile, setLicenseDocFile] = useState(null)
  const [profilePhotoFile, setProfilePhotoFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [docs, setDocs] = useState([])
  const [docForm, setDocForm] = useState({ type:"license", expiry_date:"", notes:"" })
  const [docUploading, setDocUploading] = useState(false)
  const [kraPinFile, setKraPinFile] = useState(null)
  const [medicalCertFile, setMedicalCertFile] = useState(null)
  const [psvBadgeFile, setPsvBadgeFile] = useState(null)
  
  const [credentialsForm, setCredentialsForm] = useState({
    id_number:"",
    license_number:"",
    license_expiry:"",
    license_class:"Class B - Light Motor Vehicle",
    years_experience:"",
    emergency_contact_name:"",
    emergency_contact_phone:"",
  })

  const [passwordForm, setPasswordForm] = useState({ password:"", confirm:"" })

  useEffect(() => {
    if (user) loadDocs()
    if (profile) {
      setPersonalForm({
        first_name: profile?.first_name||"",
        last_name: profile?.last_name||"",
        city: profile?.city||"",
      })
      setCredentialsForm({
        id_number: profile?.id_number||"",
        license_number: profile?.license_number||"",
        license_expiry: profile?.license_expiry||"",
        license_class: profile?.license_class||"Class B - Light Motor Vehicle",
        years_experience: profile?.years_experience||"",
        emergency_contact_name: profile?.emergency_contact_name||"",
        emergency_contact_phone: profile?.emergency_contact_phone||"",
        kra_pin_number: profile?.kra_pin_number||"",
        psv_badge_number: profile?.psv_badge_number||"",
      })
    }
    if (user) { loadSensitive(); loadStats() }
  }, [profile, user])

  async function loadSensitive() {
    const { data } = await supabase.from("profile_sensitive").select("phone,email").eq("id", user.id).maybeSingle()
    if (data) setSensitive({ phone:data.phone||"", email:data.email||"" })
  }

  async function loadStats() {
    const [{ data: bks }, { data: revs }] = await Promise.all([
      supabase.from("bookings").select("id,status,driver_earnings").eq("driver_id", user.id),
      supabase.from("reviews").select("driver_rating").eq("driver_id", user.id).not("driver_rating","is",null),
    ])
    const completed = bks?.filter(b=>b.status==="completed")||[]
    const totalEarnings = completed.reduce((s,b)=>s+Number(b.driver_earnings||0),0)
    const avgRating = revs?.length ? (revs.reduce((s,r)=>s+Number(r.driver_rating||0),0)/revs.length).toFixed(1) : "—"
    setStats({ total:bks?.length||0, completed:completed.length, rating:avgRating, earnings:totalEarnings })
  }

  async function savePersonal(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await updateProfile({ ...personalForm, driver_vehicle_type: vehicleType })
      toast.success("Personal info saved")
    } catch(err) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  async function uploadDocument(file, type) {
    if (!file) return null
    const ext = file.name.split(".").pop()
    const path = `${user.id}/${type}-${Date.now()}.${ext}`
    const { error } = await supabase.storage.from("driver-documents").upload(path, file, { upsert:true })
    if (error) throw error
    const { data } = supabase.storage.from("driver-documents").getPublicUrl(path)
    return data.publicUrl
  }

  async function saveCredentials(e) {
    e.preventDefault()
    setSaving(true)
      setUploading(true)
      try {
        let idDocUrl = profile?.id_document_url
        let idDocBackUrl = profile?.id_document_back_url
        let licenseDocUrl = profile?.license_document_url
        let goodConductUrl = profile?.good_conduct_url
        let kraPinUrl = profile?.kra_pin_url
        let medicalCertUrl = profile?.medical_cert_url
        let psvBadgeUrl = profile?.psv_badge_url
        let profilePhotoUrl = profile?.profile_photo_url
        if (idDocFile) idDocUrl = await uploadDocument(idDocFile, "id-front")
        if (idDocBackFile) idDocBackUrl = await uploadDocument(idDocBackFile, "id-back")
        if (licenseDocFile) licenseDocUrl = await uploadDocument(licenseDocFile, "license")
        if (goodConductFile) goodConductUrl = await uploadDocument(goodConductFile, "good-conduct")
        if (kraPinFile) kraPinUrl = await uploadDocument(kraPinFile, "kra-pin")
        if (medicalCertFile) medicalCertUrl = await uploadDocument(medicalCertFile, "medical-cert")
        if (psvBadgeFile) psvBadgeUrl = await uploadDocument(psvBadgeFile, "psv-badge")
        if (profilePhotoFile) profilePhotoUrl = await uploadDocument(profilePhotoFile, "profile")
        await updateProfile({
        ...credentialsForm,
        years_experience: parseInt(credentialsForm.years_experience)||0,
          id_document_url: idDocUrl,
          id_document_back_url: idDocBackUrl,
          license_document_url: licenseDocUrl,
          good_conduct_url: goodConductUrl,
          kra_pin_url: kraPinUrl,
          medical_cert_url: medicalCertUrl,
          psv_badge_url: psvBadgeUrl,
          profile_photo_url: profilePhotoUrl,
          kra_pin_number: credentialsForm.kra_pin_number,
          psv_badge_number: credentialsForm.psv_badge_number,
        })
      toast.success("Credentials saved — pending admin verification")
    } catch(err) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  async function loadDocs() {
    const { data } = await supabase.from("driver_documents")
      .select("*").eq("driver_id", user.id).order("created_at", { ascending:false })
    setDocs(data||[])
  }

  async function uploadDoc(file, docType, expiryDate) {
    if (!file) return null
    const ext = file.name.split(".").pop()
    const path = `${user.id}/${docType}-${Date.now()}.${ext}`
    const { error } = await supabase.storage.from("driver-documents").upload(path, file, { upsert:true })
    if (error) throw error
    const { data } = supabase.storage.from("driver-documents").getPublicUrl(path)
    return data.publicUrl
  }

  async function addDocument(e) {
    e.preventDefault()
    if (!docForm.file) return toast.error("Please select a file")
    setDocUploading(true)
    try {
      const url = await uploadDoc(docForm.file, docForm.type, docForm.expiry_date)
      await supabase.from("driver_documents").insert({
        driver_id: user.id,
        type: docForm.type,
        document_url: url,
        expiry_date: docForm.expiry_date||null,
        is_verified: false,
      })

      // Also update profile URL columns
      const urlMap = {
        license: "license_doc_url",
        id_front: "id_doc_front_url",
        id_back: "id_doc_back_url",
        psv_badge: "psv_badge_url",
        good_conduct: "good_conduct_url",
        insurance: "insurance_url",
      }
      if (urlMap[docForm.type]) {
        await updateProfile({ [urlMap[docForm.type]]: url })
      }

      toast.success("Document uploaded!")
      setDocForm({ type:"license", expiry_date:"", notes:"" })
      loadDocs()
    } catch(err) { toast.error(err.message) }
    finally { setDocUploading(false) }
  }

  async function deleteDoc(id) {
    if (!confirm("Remove this document?")) return
    await supabase.from("driver_documents").delete().eq("id", id)
    loadDocs()
    toast.success("Document removed")
  }

  async function saveContact(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await supabase.from("profile_sensitive").update({ phone:sensitive.phone }).eq("id", user.id)
      toast.success("Contact saved")
    } catch(err) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  async function changePassword(e) {
    e.preventDefault()
    if (passwordForm.password !== passwordForm.confirm) return toast.error("Passwords do not match")
    if (passwordForm.password.length < 6) return toast.error("Min 6 characters")
    const { error } = await supabase.auth.updateUser({ password: passwordForm.password })
    if (error) return toast.error(error.message)
    toast.success("Password changed")
    setPasswordForm({ password:"", confirm:"" })
  }

  const initials = `${profile?.first_name?.[0]||""}${profile?.last_name?.[0]||""}`.toUpperCase()
  const inp = { width:"100%", background:"#ffffff", border:"1px solid #e5e5e5", borderRadius:8, padding:"11px 12px", color:"#000000", fontSize:13, outline:"none", fontFamily:"'DM Sans',sans-serif", marginBottom:12 }
  const lbl = { fontSize:11, color:"#666", textTransform:"uppercase", letterSpacing:"0.05em", display:"block", marginBottom:4 }

  const TABS = [
    { k:"personal", l:"Personal" },
    { k:"credentials", l:"Credentials" },
    { k:"contact", l:"Contact" },
    { k:"security", l:"Security" },
  ]

  return (
    <div style={{ maxWidth:isMobile?"100%":540 }}>
      {/* Profile header */}
      <div style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:12, padding:"1.25rem", marginBottom:"1.25rem" }}>
        <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:"1.25rem" }}>
          <div style={{ width:60, height:60, borderRadius:14, background:"#f0fdf4", border:"2px solid #1d9e7540", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"Syne", fontSize:22, fontWeight:800, color:"#1d9e75", flexShrink:0 }}>
            {initials||"🚗"}
          </div>
          <div>
            <div style={{ fontFamily:"Syne", fontSize:17, fontWeight:800, color:"#000000" }}>{profile?.first_name} {profile?.last_name}</div>
            <div style={{ fontSize:12, color:"#777777", marginTop:2 }}>
              {profile?.driver_vehicle_type==="motorcycle"?"🏍️ Boda Boda Driver":
               profile?.driver_vehicle_type==="tuktuk"?"🛺 Tuktuk Driver":
               profile?.driver_vehicle_type==="van"?"🚐 Van Driver":"🚗 Concierge Driver"}
               · {profile?.city||"Location not set"}
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:4 }}>
              {profile?.documents_verified ? (
                <span style={{ fontSize:10, color:"#1d9e75", background:"#f0fdf4", padding:"2px 8px", borderRadius:10, border:"1px solid #1d9e7540" }}>✓ Verified driver</span>
              ) : (
                <span style={{ fontSize:10, color:"#e6821e", background:"#fff8f0", padding:"2px 8px", borderRadius:10, border:"1px solid #e6821e40" }}>⏳ Pending verification</span>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8 }}>
          {[
            { label:"Total jobs", value:stats.total, color:"#000000" },
            { label:"Completed", value:stats.completed, color:"#1d9e75" },
            { label:"Rating", value:stats.rating, color:"#e6821e" },
            { label:"Earned", value:`KES ${Number(stats.earnings).toLocaleString()}`, color:"#8b5cf6" },
          ].map(s=>(
            <div key={s.label} style={{ background:"#ffffff", borderRadius:8, padding:"0.6rem", textAlign:"center", border:"1px solid #eeeeee" }}>
              <div style={{ fontFamily:"Syne", fontSize:isMobile?13:16, fontWeight:800, color:s.color }}>{s.value}</div>
              <div style={{ fontSize:9, color:"#888888", marginTop:2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", gap:6, marginBottom:"1.25rem", flexWrap:"wrap" }}>
        {TABS.map(tb=>(
          <button key={tb.k} onClick={()=>setTab(tb.k)}
            style={{ padding:"8px 16px", borderRadius:8, border:"none", fontSize:12, cursor:"pointer", background:tab===tb.k?"#1d9e75":"#555555", color:tab===tb.k?"#fff":"#666", fontFamily:"'DM Sans',sans-serif", fontWeight:tab===tb.k?700:400 }}>
            {tb.l}
          </button>
        ))}
      </div>

      {/* PERSONAL TAB */}
      {tab==="personal"&&(
        <form onSubmit={savePersonal}>
          <div style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:12, padding:"1.25rem" }}>
            <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, marginBottom:"1rem", color:"#000000" }}>Personal information</div>
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:10 }}>
              <div><label style={lbl}>First name</label><input style={inp} value={personalForm.first_name} onChange={e=>setPersonalForm(f=>({...f,first_name:e.target.value}))} required/></div>
              <div><label style={lbl}>Last name</label><input style={inp} value={personalForm.last_name} onChange={e=>setPersonalForm(f=>({...f,last_name:e.target.value}))} required/></div>
            </div>
            <label style={lbl}>City</label>
            <input style={inp} placeholder="e.g. Nairobi" value={personalForm.city} onChange={e=>setPersonalForm(f=>({...f,city:e.target.value}))}/>
            <button type="submit" disabled={saving}
              style={{ background:saving?"#555555":"#1d9e75", border:"none", borderRadius:9, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"11px 24px", cursor:saving?"not-allowed":"pointer" }}>
              {saving?"Saving...":"Save changes"}
            </button>
          </div>
        </form>
      )}

      {/* CREDENTIALS TAB */}
      {tab==="credentials"&&(
        <form onSubmit={saveCredentials}>
          <div style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:12, padding:"1.25rem" }}>
            <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, marginBottom:4, color:"#000000" }}>Driver credentials</div>
            <div style={{ fontSize:11, color:"#777777", marginBottom:"1rem" }}>Your credentials will be reviewed by admin before you can go online.</div>

            {!profile?.documents_verified&&(
              <div style={{ background:"#fff8f0", border:"1px solid #e6821e40", borderRadius:8, padding:"0.75rem", marginBottom:"1rem" }}>
                <div style={{ fontSize:12, color:"#e6821e" }}>⏳ Pending verification — fill in all fields and submit for admin review</div>
              </div>
            )}

            
            {/* Profile photo upload */}
            <div style={{ marginBottom:16 }}>
              <label style={lbl}>Profile photo</label>
              <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                {(profile?.profile_photo_url||profilePhotoFile)&&(
                  <img src={profilePhotoFile?URL.createObjectURL(profilePhotoFile):profile?.profile_photo_url} alt="Profile" style={{ width:56, height:56, borderRadius:"50%", objectFit:"cover", border:"2px solid #1d9e75" }}/>
                )}
                <div>
                  <input type="file" accept="image/*" id="profile-photo" style={{ display:"none" }} onChange={e=>setProfilePhotoFile(e.target.files[0])}/>
                  <label htmlFor="profile-photo" style={{ background:"#ffffff", border:"1px solid #dddddd", borderRadius:8, color:"#555555", fontSize:11, padding:"7px 14px", cursor:"pointer", display:"inline-block" }}>
                    {profile?.profile_photo_url?"Change photo":"Upload photo"}
                  </label>
                  {profilePhotoFile&&<div style={{ fontSize:10, color:"#1d9e75", marginTop:4 }}>✓ {profilePhotoFile.name}</div>}
                </div>
              </div>
            </div>

            <div style={{ height:1, background:"#f0f0f0", margin:"8px 0 16px" }}/>
            <label style={lbl}>National ID number *</label>
            <input style={inp} placeholder="e.g. 12345678" value={credentialsForm.id_number} onChange={e=>setCredentialsForm(f=>({...f,id_number:e.target.value}))} required/>

            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:10 }}>
              <div>
                <label style={lbl}>Driver's license number *</label>
                <input style={inp} placeholder="e.g. DL123456" value={credentialsForm.license_number} onChange={e=>setCredentialsForm(f=>({...f,license_number:e.target.value}))} required/>
              </div>
              <div>
                <label style={lbl}>License expiry date *</label>
                <input style={inp} type="date" value={credentialsForm.license_expiry} onChange={e=>setCredentialsForm(f=>({...f,license_expiry:e.target.value}))} required/>
              </div>
            </div>

            <label style={lbl}>License class *</label>
            <select style={inp} value={credentialsForm.license_class} onChange={e=>setCredentialsForm(f=>({...f,license_class:e.target.value}))}>
              {LICENSE_CLASSES.map(c=><option key={c} value={c}>{c}</option>)}
            </select>

            <label style={lbl}>Years of driving experience *</label>
            <input style={inp} type="number" min="0" max="50" placeholder="e.g. 5" value={credentialsForm.years_experience} onChange={e=>setCredentialsForm(f=>({...f,years_experience:e.target.value}))} required/>

            {/* DOCUMENT UPLOADS */}
            <div style={{ marginBottom:16 }}>
              <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, marginBottom:8, color:"#000000" }}>Upload documents</div>
              <div style={{ fontSize:11, color:"#777777", marginBottom:10 }}>Upload clear photos for admin verification. Max 10MB each.</div>
              {[
                { key:"id_doc_front_url", label:"National ID (front)", icon:"📋" },
                { key:"id_doc_back_url", label:"National ID (back)", icon:"📋" },
                { key:"license_doc_url", label:"Drivers License", icon:"🪪" },
                { key:"psv_badge_url", label:"PSV Badge (if applicable)", icon:"🔖" },
                { key:"good_conduct_url", label:"Certificate of Good Conduct", icon:"📄" },
                { key:"insurance_url", label:"Insurance Certificate", icon:"📝" },
              ].map(doc=>(
                <div key={doc.key} style={{ marginBottom:12, background:"#ffffff", borderRadius:10, padding:"0.75rem", border:"1px solid #eeeeee" }}>
                  <div style={{ fontSize:12, color:"#555555", marginBottom:6 }}>{doc.icon} {doc.label}</div>
                  {credentialsForm[doc.key]&&(
                    <div style={{ position:"relative", marginBottom:6 }}>
                      <img src={credentialsForm[doc.key]} alt={doc.label} style={{ width:"100%", maxHeight:120, objectFit:"cover", borderRadius:8 }}/>
                      <span style={{ position:"absolute", top:4, right:4, background:"#1d9e75", borderRadius:6, fontSize:10, color:"#fff", padding:"2px 8px" }}>✓ Uploaded</span>
                    </div>
                  )}
                  <input type="file" accept="image/*,application/pdf"
                    onChange={async(e)=>{
                      const file = e.target.files[0]
                      if (!file) return
                      if (file.size > 10*1024*1024) return toast.error("File too large - max 10MB")
                      try {
                        const ext = file.name.split(".").pop()
                        const path = `${user.id}/${doc.key}-${Date.now()}.${ext}`
                        const { error } = await supabase.storage.from("driver-documents").upload(path, file, { upsert:true })
                        if (error) throw error
                        const { data } = supabase.storage.from("driver-documents").getPublicUrl(path)
                        setCredentialsForm(c=>({...c, [doc.key]:data.publicUrl}))
                        toast.success(doc.label + " uploaded!")
                      } catch(err) { toast.error(err.message) }
                    }}
                    style={{ width:"100%", background:"#ffffff", border:"1px solid #e5e5e5", borderRadius:8, padding:"8px", color:"#555555", fontSize:12 }}/>
                </div>
              ))}
            </div>
            <div style={{ height:1, background:"#f0f0f0", margin:"8px 0 16px" }}/>
            <div style={{ height:1, background:"#f0f0f0", margin:"8px 0 16px" }}/>
            <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, marginBottom:"0.75rem", color:"#000000" }}>Emergency contact</div>

            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:10 }}>
              <div>
                <label style={lbl}>Contact name</label>
                <input style={inp} placeholder="Full name" value={credentialsForm.emergency_contact_name} onChange={e=>setCredentialsForm(f=>({...f,emergency_contact_name:e.target.value}))}/>
              </div>
              <div>
                <label style={lbl}>Contact phone</label>
                <input style={inp} placeholder="+254 700 000 000" value={credentialsForm.emergency_contact_phone} onChange={e=>setCredentialsForm(f=>({...f,emergency_contact_phone:e.target.value}))}/>
              </div>
            </div>

            <button type="submit" disabled={saving}
              style={{ background:saving?"#555555":"#1d9e75", border:"none", borderRadius:9, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"11px 24px", cursor:saving?"not-allowed":"pointer" }}>
              {saving?"Saving...":"Save credentials"}
            </button>
          </div>
        </form>
      )}
      {/* DOCUMENTS TAB */}
      {tab==="documents"&&(
        <div>
          {/* Existing documents */}
          <div style={{ marginBottom:"1.5rem" }}>
            <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, marginBottom:"1rem", color:"#000000" }}>My Documents</div>
            {docs.length===0&&<div style={{ color:"#888", fontSize:13, textAlign:"center", padding:"1.5rem", background:"#f5f5f5", borderRadius:10 }}>No documents uploaded yet</div>}
            {docs.map(doc=>(
              <div key={doc.id} style={{ background:"#f5f5f5", border:"1px solid #eeeeee", borderRadius:10, padding:"0.9rem", marginBottom:8, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div style={{ flex:1 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                    <span style={{ fontSize:18 }}>{doc.type==="license"?"🪪":doc.type==="insurance"?"🛡️":doc.type==="id_front"||doc.type==="id_back"?"🪪":doc.type==="psv_badge"?"🏅":doc.type==="good_conduct"?"📋":"📄"}</span>
                    <div style={{ fontWeight:600, fontSize:13, color:"#000", textTransform:"capitalize" }}>{doc.type.replace(/_/g," ")}</div>
                    <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, background:doc.is_verified?"#f0fdf4":"#fff8f0", color:doc.is_verified?"#1d9e75":"#e6821e", border:"1px solid "+(doc.is_verified?"#bbf7d0":"#fed7aa") }}>{doc.is_verified?"verified":"pending"}</span>
                  </div>
                  {doc.expiry_date&&(() => {
                    const daysLeft = Math.ceil((new Date(doc.expiry_date) - new Date()) / (1000*60*60*24))
                    const isExpiring = daysLeft <= 30 && daysLeft >= 0
                    const isExpired = daysLeft < 0
                    return (
                      <div style={{ fontSize:11, color:isExpired?"#e24b4a":isExpiring?"#e6821e":"#888", fontWeight:isExpiring||isExpired?700:400 }}>
                        {isExpired ? "⚠️ Expired " : isExpiring ? "⚠️ Expires soon: " : "Expires: "}
                        {new Date(doc.expiry_date).toLocaleDateString()}
                      </div>
                    )
                  })()}
                  {doc.document_url&&<a href={doc.document_url} target="_blank" rel="noreferrer" style={{ fontSize:11, color:"#e6821e", textDecoration:"none" }}>View document →</a>}
                </div>
                <button onClick={()=>deleteDoc(doc.id)} style={{ background:"none", border:"none", color:"#e24b4a", cursor:"pointer", fontSize:12, padding:"4px 8px" }}>Remove</button>
              </div>
            ))}
          </div>

          {/* Add new document */}
          <div style={{ background:"#f5f5f5", border:"1px solid #eeeeee", borderRadius:12, padding:"1.25rem" }}>
            <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, marginBottom:"1rem", color:"#000000" }}>Add document</div>
            <form onSubmit={addDocument}>
              <label style={{ fontSize:11, color:"#666", textTransform:"uppercase", letterSpacing:"0.05em", display:"block", marginBottom:4 }}>Document type</label>
              <select value={docForm.type} onChange={e=>setDocForm(f=>({...f,type:e.target.value}))}
                style={{ width:"100%", background:"#ffffff", border:"1px solid #e5e5e5", borderRadius:8, padding:"10px 12px", color:"#000", fontSize:13, outline:"none", marginBottom:10 }}>
                <option value="license">Driver License</option>
                <option value="id_front">National ID (Front)</option>
                <option value="id_back">National ID (Back)</option>
                <option value="psv_badge">PSV Badge</option>
                <option value="insurance">Insurance Certificate</option>
                <option value="good_conduct">Good Conduct Certificate</option>
                <option value="vehicle_registration">Vehicle Registration</option>
              </select>

              <label style={{ fontSize:11, color:"#666", textTransform:"uppercase", letterSpacing:"0.05em", display:"block", marginBottom:4 }}>Upload file</label>
              <input type="file" accept="image/*,.pdf"
                onChange={e=>setDocForm(f=>({...f,file:e.target.files[0]}))}
                style={{ width:"100%", background:"#ffffff", border:"1px solid #e5e5e5", borderRadius:8, padding:"8px 12px", color:"#000", fontSize:13, marginBottom:10 }}
                required/>

              <label style={{ fontSize:11, color:"#666", textTransform:"uppercase", letterSpacing:"0.05em", display:"block", marginBottom:4 }}>Expiry date (optional)</label>
              <input type="date" value={docForm.expiry_date} onChange={e=>setDocForm(f=>({...f,expiry_date:e.target.value}))}
                style={{ width:"100%", background:"#ffffff", border:"1px solid #e5e5e5", borderRadius:8, padding:"10px 12px", color:"#000", fontSize:13, outline:"none", marginBottom:10 }}/>

              <label style={{ fontSize:11, color:"#666", textTransform:"uppercase", letterSpacing:"0.05em", display:"block", marginBottom:4 }}>Notes (optional)</label>
              <input value={docForm.notes} onChange={e=>setDocForm(f=>({...f,notes:e.target.value}))}
                placeholder="Any additional notes..."
                style={{ width:"100%", background:"#ffffff", border:"1px solid #e5e5e5", borderRadius:8, padding:"10px 12px", color:"#000", fontSize:13, outline:"none", marginBottom:14 }}/>

              <button type="submit" disabled={docUploading}
                style={{ width:"100%", background:docUploading?"#ccc":"#e6821e", border:"none", borderRadius:9, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"12px", cursor:docUploading?"not-allowed":"pointer" }}>
                {docUploading?"Uploading...":"Upload document"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* CONTACT TAB */}
      {tab==="contact"&&(
        <form onSubmit={saveContact}>
          <div style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:12, padding:"1.25rem" }}>
            <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, marginBottom:"1rem", color:"#000000" }}>Contact details</div>
            <label style={lbl}>Email</label>
            <input style={{ ...inp, color:"#777777", cursor:"not-allowed" }} value={sensitive.email} readOnly/>
            <label style={lbl}>Phone number</label>
            <input style={inp} placeholder="+254 700 000 000" value={sensitive.phone} onChange={e=>setSensitive(s=>({...s,phone:e.target.value}))}/>
            <button type="submit" disabled={saving}
              style={{ background:saving?"#555555":"#1d9e75", border:"none", borderRadius:9, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"11px 24px", cursor:saving?"not-allowed":"pointer" }}>
              {saving?"Saving...":"Save contact"}
            </button>
          </div>
        </form>
      )}

      {/* SECURITY TAB */}
      {tab==="security"&&(
        <form onSubmit={changePassword}>
          <div style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:12, padding:"1.25rem" }}>
            <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, marginBottom:"1rem", color:"#000000" }}>Change password</div>
            <label style={lbl}>New password</label>
            <input style={inp} type="password" placeholder="Min 6 characters" value={passwordForm.password} onChange={e=>setPasswordForm(f=>({...f,password:e.target.value}))} required/>
            <label style={lbl}>Confirm password</label>
            <input style={inp} type="password" placeholder="Repeat password" value={passwordForm.confirm} onChange={e=>setPasswordForm(f=>({...f,confirm:e.target.value}))} required/>
            <button type="submit"
              style={{ background:"#1d9e75", border:"none", borderRadius:9, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"11px 24px", cursor:"pointer" }}>
              Change password
            </button>
          </div>
        </form>
      )}
    </div>
  )
}






















