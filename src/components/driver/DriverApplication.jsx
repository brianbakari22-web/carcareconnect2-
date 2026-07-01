import { useState, useEffect } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import toast from "react-hot-toast"

const DOCUMENT_TYPES = [
  { key:"national_id", label:"National ID", required:true, desc:"Both sides of your national identity card" },
  { key:"driving_license", label:"Driving License", required:true, desc:"Valid, non-expired driving license" },
  { key:"good_conduct", label:"Certificate of Good Conduct", required:true, desc:"Police clearance certificate (not older than 6 months)" },
  { key:"profile_photo", label:"Profile Photo", required:true, desc:"Clear, recent passport-style photo" },
  { key:"vehicle_photo", label:"Vehicle Photo", required:false, desc:"Clear photo of vehicle you will use (optional if using CCC fleet)" },
]

const AGREEMENT_TEXT = `DRIVER PARTNERSHIP AGREEMENT — CAR CARE CONNECT

By signing this agreement, you acknowledge and agree to the following:

1. VEHICLE CARE
You will treat every customer vehicle as if it were your own. Any damage caused through negligence is your financial responsibility.

2. MILEAGE
You will only drive the vehicle the minimum distance required for the job. Unauthorized mileage will result in immediate suspension.

3. CONDUCT
You will maintain professional conduct at all times. Rudeness, lateness, or dishonesty will result in account suspension.

4. PROBATION
Your first 10 jobs are on probation. You must maintain a minimum 4.5/5 star rating during this period.

5. REPORTING
You will complete accurate pickup and dropoff condition reports with photos for every job.

6. SUSPENSION POLICY
One verified customer complaint during probation = immediate suspension. Three verified complaints after probation = permanent ban.

7. EARNINGS
Your earnings will be processed within 7 business days of job completion after customer confirmation.

Car Care Connect reserves the right to suspend or terminate any driver account at its discretion.`

export default function DriverApplication() {
  const { user, profile } = useAuth()
  const [step, setStep] = useState(1)
  const [documents, setDocuments] = useState({})
  const [uploading, setUploading] = useState({})
  const [agreed, setAgreed] = useState(false)
  const [appointmentDate, setAppointmentDate] = useState("")
  const [appointmentTime, setAppointmentTime] = useState("")
  const [location, setLocation] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [existingApp, setExistingApp] = useState(null)

  useEffect(() => {
    if (!user) return
    // Check existing application status
    supabase.from("driver_vetting_appointments").select("*").eq("driver_id", user.id).maybeSingle()
      .then(({ data }) => setExistingApp(data))
    // Load appointment location from settings
    supabase.from("app_settings").select("value").eq("key","vetting_appointment_location").maybeSingle()
      .then(({ data }) => { if (data) setLocation(data.value) })
    // Load existing documents
    supabase.from("driver_documents").select("*").eq("driver_id", user.id)
      .then(({ data }) => {
        const docs = {}
        data?.forEach(d => { docs[d.type] = d })
        setDocuments(docs)
      })
  }, [user])

  async function uploadDocument(type, file) {
    if (!file) return
    if (file.size > 10*1024*1024) return toast.error("File must be under 10MB")
    setUploading(u => ({...u, [type]:true}))
    try {
      const ext = file.name.split(".").pop()
      const path = `${user.id}/${type}-${Date.now()}.${ext}`
      const { error } = await supabase.storage.from("driver-documents").upload(path, file, { upsert:true })
      if (error) throw error
      const { data } = supabase.storage.from("driver-documents").getPublicUrl(path)
      // Save to driver_documents
      const { data: doc } = await supabase.from("driver_documents").upsert({
        driver_id: user.id,
        type,
        document_url: data.publicUrl,
        is_verified: false,
      }, { onConflict: "driver_id,type" }).select().single()
      setDocuments(d => ({...d, [type]: doc}))
      toast.success(`${DOCUMENT_TYPES.find(t=>t.key===type)?.label} uploaded!`)
    } catch(e) { toast.error("Upload failed: " + e.message) }
    finally { setUploading(u => ({...u, [type]:false})) }
  }

  async function submitApplication() {
    if (!appointmentDate || !appointmentTime) return toast.error("Please select an appointment date and time")
    setSubmitting(true)
    try {
      // Save agreement
      await supabase.from("driver_agreements").upsert({
        driver_id: user.id,
        agreement_version: "1.0",
        agreed_at: new Date().toISOString(),
      }, { onConflict: "driver_id" })

      // Book appointment
      await supabase.from("driver_vetting_appointments").upsert({
        driver_id: user.id,
        appointment_date: appointmentDate,
        appointment_time: appointmentTime,
        location,
        status: "scheduled",
      }, { onConflict: "driver_id" })

      // Update profile vetting status
      await supabase.from("profiles").update({ vetting_status: "documents_submitted" }).eq("id", user.id)

      // Notify admin
      await supabase.from("notifications").insert({
        user_id: user.id,
        title: "Application submitted! ✅",
        message: `Your driver application has been submitted. Your vetting appointment is scheduled for ${appointmentDate} at ${appointmentTime} at ${location}. We will confirm shortly.`,
        type: "success",
      })

      toast.success("Application submitted! We will be in touch.")
      setExistingApp({ status:"scheduled", appointment_date:appointmentDate, appointment_time:appointmentTime })
    } catch(e) { toast.error(e.message) }
    finally { setSubmitting(false) }
  }

  const requiredDocs = DOCUMENT_TYPES.filter(d=>d.required)
  const allRequiredUploaded = requiredDocs.every(d => documents[d.key])

  // Already applied
  if (existingApp) return (
    <div style={{ padding:"1.5rem", maxWidth:480, margin:"0 auto" }}>
      <div style={{ background:"#f0fdf4", border:"1px solid #1d9e7540", borderRadius:16, padding:"1.5rem", textAlign:"center" }}>
        <div style={{ fontSize:48, marginBottom:12 }}>📋</div>
        <div style={{ fontFamily:"Syne", fontSize:18, fontWeight:800, color:"#1d9e75", marginBottom:8 }}>Application Submitted</div>
        <div style={{ fontSize:13, color:"#555", marginBottom:16, lineHeight:1.6 }}>
          Your vetting appointment is scheduled for:
        </div>
        <div style={{ background:"#ffffff", borderRadius:10, padding:"1rem", marginBottom:16 }}>
          <div style={{ fontFamily:"Syne", fontSize:15, fontWeight:700, color:"#000", marginBottom:4 }}>📅 {existingApp.appointment_date}</div>
          <div style={{ fontSize:13, color:"#555", marginBottom:4 }}>⏰ {existingApp.appointment_time}</div>
          <div style={{ fontSize:13, color:"#555" }}>📍 {existingApp.location}</div>
        </div>
        <div style={{ fontSize:12, color:"#888", lineHeight:1.6 }}>
          Status: <span style={{ color:"#e6821e", fontWeight:600, textTransform:"uppercase" }}>{existingApp.status}</span>
        </div>
        <div style={{ fontSize:11, color:"#888", marginTop:12 }}>
          Please arrive 10 minutes early with original copies of all submitted documents.
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ padding:"1rem", maxWidth:500, margin:"0 auto", fontFamily:"DM Sans,sans-serif" }}>
      {/* Header */}
      <div style={{ textAlign:"center", marginBottom:"1.5rem" }}>
        <div style={{ fontSize:40, marginBottom:8 }}>🚗</div>
        <div style={{ fontFamily:"Syne", fontSize:20, fontWeight:800, color:"#000" }}>Become a CCC Driver</div>
        <div style={{ fontSize:12, color:"#888", marginTop:4 }}>Complete all steps to apply for driver partnership</div>
      </div>

      {/* Progress */}
      <div style={{ display:"flex", gap:6, marginBottom:"1.5rem" }}>
        {["Documents","Agreement","Appointment"].map((s,i)=>(
          <div key={s} style={{ flex:1, textAlign:"center" }}>
            <div style={{ height:4, borderRadius:2, background:step>i+1?"#1d9e75":step===i+1?"#e6821e":"#eeeeee", marginBottom:4 }}/>
            <div style={{ fontSize:9, color:step===i+1?"#e6821e":step>i+1?"#1d9e75":"#aaa", fontWeight:600, textTransform:"uppercase" }}>{s}</div>
          </div>
        ))}
      </div>

      {/* Step 1: Documents */}
      {step===1&&(
        <div>
          <div style={{ fontFamily:"Syne", fontSize:15, fontWeight:800, color:"#000", marginBottom:4 }}>Step 1: Upload Documents</div>
          <div style={{ fontSize:12, color:"#888", marginBottom:"1.25rem" }}>All required documents must be uploaded before proceeding. Files must be clear and legible.</div>
          {DOCUMENT_TYPES.map(doc=>(
            <div key={doc.key} style={{ background:"#f8f8f8", border:`1px solid ${documents[doc.key]?"#1d9e7540":"#eeeeee"}`, borderRadius:12, padding:"1rem", marginBottom:10 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:"#000" }}>{doc.label} {doc.required&&<span style={{ color:"#e24b4a" }}>*</span>}</div>
                  <div style={{ fontSize:11, color:"#888" }}>{doc.desc}</div>
                </div>
                {documents[doc.key]&&<span style={{ fontSize:10, color:"#1d9e75", fontWeight:600 }}>✓ Uploaded</span>}
              </div>
              {documents[doc.key] ? (
                <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                  <a href={documents[doc.key].document_url} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize:11, color:"#378add", textDecoration:"none" }}>View uploaded →</a>
                  <label style={{ fontSize:11, color:"#888", cursor:"pointer" }}>
                    Replace
                    <input type="file" accept="image/*,.pdf" style={{ display:"none" }} onChange={e=>uploadDocument(doc.key, e.target.files[0])}/>
                  </label>
                </div>
              ) : (
                <label style={{ display:"block", background:uploading[doc.key]?"#e0e0e0":"#e6821e", border:"none", borderRadius:8, color:"#fff", fontSize:12, fontWeight:700, padding:"8px 16px", cursor:uploading[doc.key]?"not-allowed":"pointer", textAlign:"center", fontFamily:"Syne,sans-serif" }}>
                  {uploading[doc.key]?"Uploading...":"Upload "+doc.label}
                  <input type="file" accept="image/*,.pdf" style={{ display:"none" }} disabled={uploading[doc.key]} onChange={e=>uploadDocument(doc.key, e.target.files[0])}/>
                </label>
              )}
            </div>
          ))}
          <button onClick={()=>{ if(!allRequiredUploaded) return toast.error("Please upload all required documents"); setStep(2) }}
            disabled={!allRequiredUploaded}
            style={{ width:"100%", background:allRequiredUploaded?"#1d9e75":"#e0e0e0", border:"none", borderRadius:9, color:allRequiredUploaded?"#fff":"#555", fontFamily:"Syne,sans-serif", fontSize:14, fontWeight:700, padding:"13px", cursor:allRequiredUploaded?"pointer":"not-allowed", marginTop:8 }}>
            Continue to Agreement →
          </button>
        </div>
      )}

      {/* Step 2: Agreement */}
      {step===2&&(
        <div>
          <div style={{ fontFamily:"Syne", fontSize:15, fontWeight:800, color:"#000", marginBottom:4 }}>Step 2: Driver Agreement</div>
          <div style={{ fontSize:12, color:"#888", marginBottom:"1rem" }}>Read and agree to the CCC Driver Partnership Agreement before booking your appointment.</div>
          <div style={{ background:"#f8f8f8", border:"1px solid #eeeeee", borderRadius:12, padding:"1rem", marginBottom:"1rem", maxHeight:300, overflowY:"auto" }}>
            <pre style={{ fontSize:11, color:"#444", lineHeight:1.8, whiteSpace:"pre-wrap", fontFamily:"DM Sans,sans-serif", margin:0 }}>{AGREEMENT_TEXT}</pre>
          </div>
          <label style={{ display:"flex", alignItems:"flex-start", gap:10, cursor:"pointer", marginBottom:"1rem" }}>
            <input type="checkbox" checked={agreed} onChange={e=>setAgreed(e.target.checked)} style={{ accentColor:"#1d9e75", width:16, height:16, flexShrink:0, marginTop:2 }}/>
            <span style={{ fontSize:12, color:"#555", lineHeight:1.6 }}>I have read and agree to the CCC Driver Partnership Agreement. I understand that violation of these terms may result in suspension or permanent removal from the platform.</span>
          </label>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={()=>setStep(1)} style={{ flex:1, background:"none", border:"1px solid #dddddd", borderRadius:9, color:"#888", fontSize:13, padding:"12px", cursor:"pointer" }}>← Back</button>
            <button onClick={()=>{ if(!agreed) return toast.error("Please agree to the terms"); setStep(3) }} disabled={!agreed}
              style={{ flex:2, background:agreed?"#1d9e75":"#e0e0e0", border:"none", borderRadius:9, color:agreed?"#fff":"#555", fontFamily:"Syne,sans-serif", fontSize:14, fontWeight:700, padding:"13px", cursor:agreed?"pointer":"not-allowed" }}>
              Continue to Appointment →
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Appointment */}
      {step===3&&(
        <div>
          <div style={{ fontFamily:"Syne", fontSize:15, fontWeight:800, color:"#000", marginBottom:4 }}>Step 3: Book Vetting Appointment</div>
          <div style={{ fontSize:12, color:"#888", marginBottom:"1.25rem" }}>Select a date and time for your in-person vetting appointment at CCC headquarters.</div>
          <div style={{ background:"#fff8f0", border:"1px solid #e6821e30", borderRadius:10, padding:"0.75rem", marginBottom:"1.25rem" }}>
            <div style={{ fontSize:12, fontWeight:600, color:"#e6821e", marginBottom:4 }}>📍 Appointment Location</div>
            <div style={{ fontSize:12, color:"#555" }}>{location}</div>
            <div style={{ fontSize:11, color:"#888", marginTop:4 }}>Please bring original copies of all uploaded documents</div>
          </div>
          <div style={{ marginBottom:16 }}>
            <label style={{ fontSize:11, color:"#666", textTransform:"uppercase", letterSpacing:"0.05em", display:"block", marginBottom:4 }}>Preferred date *</label>
            <input type="date" value={appointmentDate} onChange={e=>setAppointmentDate(e.target.value)}
              min={new Date(Date.now()+3*24*60*60*1000).toISOString().split("T")[0]}
              style={{ width:"100%", background:"#ffffff", border:"1px solid #e5e5e5", borderRadius:8, padding:"10px 12px", color:"#000", fontSize:13, outline:"none" }}/>
            <div style={{ fontSize:10, color:"#888", marginTop:4 }}>Earliest available: 3 days from today</div>
          </div>
          <div style={{ marginBottom:16 }}>
            <label style={{ fontSize:11, color:"#666", textTransform:"uppercase", letterSpacing:"0.05em", display:"block", marginBottom:4 }}>Preferred time *</label>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8 }}>
              {["09:00 AM","10:00 AM","11:00 AM","02:00 PM","03:00 PM","04:00 PM"].map(t=>(
                <button key={t} type="button" onClick={()=>setAppointmentTime(t)}
                  style={{ background:appointmentTime===t?"#e6821e":"#ffffff", border:`1px solid ${appointmentTime===t?"#e6821e":"#eeeeee"}`, borderRadius:8, padding:"8px", cursor:"pointer", fontSize:11, color:appointmentTime===t?"#fff":"#555", fontWeight:appointmentTime===t?700:400 }}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div style={{ background:"#f0fdf4", border:"1px solid #1d9e7540", borderRadius:10, padding:"0.75rem", marginBottom:"1.25rem" }}>
            <div style={{ fontSize:11, color:"#1d9e75", fontWeight:600, marginBottom:4 }}>What to expect at your appointment:</div>
            {["Identity verification (bring original documents)","Short driving assessment","Interview with CCC assessor","Sign final agreement","Same-day approval decision"].map((item,i)=>(
              <div key={i} style={{ fontSize:11, color:"#555", marginBottom:2 }}>✓ {item}</div>
            ))}
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={()=>setStep(2)} style={{ flex:1, background:"none", border:"1px solid #dddddd", borderRadius:9, color:"#888", fontSize:13, padding:"12px", cursor:"pointer" }}>← Back</button>
            <button onClick={submitApplication} disabled={submitting||!appointmentDate||!appointmentTime}
              style={{ flex:2, background:submitting||!appointmentDate||!appointmentTime?"#e0e0e0":"#1d9e75", border:"none", borderRadius:9, color:submitting||!appointmentDate||!appointmentTime?"#555":"#fff", fontFamily:"Syne,sans-serif", fontSize:14, fontWeight:700, padding:"13px", cursor:submitting||!appointmentDate||!appointmentTime?"not-allowed":"pointer" }}>
              {submitting?"Submitting...":"Submit Application ✓"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

