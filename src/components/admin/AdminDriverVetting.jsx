import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import useIsMobile from "../../lib/useIsMobile"
import toast from "react-hot-toast"

const STATUS_COLORS = {
  scheduled: "#e6821e", completed: "#1d9e75", cancelled: "#e24b4a",
  approved: "#1d9e75", rejected: "#e24b4a", pending: "#888"
}

export default function AdminDriverVetting() {
  const { user } = useAuth()
  const isMobile = useIsMobile()
  const [appointments, setAppointments] = useState([])
  const [selected, setSelected] = useState(null)
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState("pending")
  const [result, setResult] = useState("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)
  const [rescheduling, setRescheduling] = useState(null)
  const [rescheduleForm, setRescheduleForm] = useState({ date:"", time:"" })
  const [search, setSearch] = useState("")

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from("driver_vetting_appointments")
      .select("*, driver:profiles!driver_vetting_appointments_driver_id_fkey(id,first_name,last_name,driver_vehicle_type,vetting_status,is_verified,driver_category)")
      .order("appointment_date", { ascending:true })
    setAppointments(data||[])
    setLoading(false)
  }

  async function loadDocuments(driverId) {
    const { data } = await supabase.from("driver_documents").select("*").eq("driver_id", driverId)
    setDocuments(data||[])
  }

  async function selectAppointment(appt) {
    setSelected(appt)
    setResult("")
    setNotes("")
    await loadDocuments(appt.driver_id)
  }

  async function verifyDocument(docId, verified) {
    await supabase.from("driver_documents").update({ is_verified: verified }).eq("id", docId)
    await loadDocuments(selected.driver_id)
    toast.success(verified ? "Document verified ✓" : "Document marked unverified")
  }

  async function submitAssessment() {
    if (!result) return toast.error("Please select assessment result")
    setSaving(true)
    try {
      const passed = result === "passed"
      const conditional = result === "conditional"

      // Update appointment
      await supabase.from("driver_vetting_appointments").update({
        status: "completed",
        assessment_result: result,
        assessment_notes: notes,
        assessed_by: user.id,
        updated_at: new Date().toISOString()
      }).eq("id", selected.id)

      if (conditional) {
        // Conditional — schedule follow-up, don't approve yet
        await Promise.all([
          supabase.from("profiles").update({ vetting_status:"conditional" }).eq("id", selected.driver_id),
          supabase.from("notifications").insert({
            user_id: selected.driver_id,
            title: "Application Update — Conditional",
            message: "Your vetting assessment had a conditional result. " + (notes||"Please contact support for next steps."),
            type: "warning",
          })
        ])
        toast.success("Driver marked conditional — notified")
      } else if (passed) {
        // Approve driver — create probation record
        await Promise.all([
          supabase.from("profiles").update({
            is_verified: true,
            documents_verified: true,
            vetting_status: "approved",
            verified_by: user.id,
            verified_at: new Date().toISOString(),
          }).eq("id", selected.driver_id),
          supabase.from("driver_probation").upsert({
            driver_id: selected.driver_id,
            status: "probation",
            jobs_completed: 0,
            jobs_required: 10,
            started_at: new Date().toISOString(),
          }, { onConflict: "driver_id" }),
          supabase.from("notifications").insert({
            user_id: selected.driver_id,
            title: "🎉 Application Approved!",
            message: "Congratulations! You have been approved as a CCC Driver. You are now on probation for your first 10 jobs — maintain a 4.5+ star rating to complete probation successfully.",
            type: "success",
          })
        ])
        toast.success("Driver approved — probation started!")
      } else {
        // Reject driver
        await Promise.all([
          supabase.from("profiles").update({
            vetting_status: "rejected",
          }).eq("id", selected.driver_id),
          supabase.from("notifications").insert({
            user_id: selected.driver_id,
            title: "Application Update",
            message: `Your CCC Driver application was not successful at this time. ${notes ? "Assessor notes: " + notes : "Please contact support for more information."}`,
            type: "warning",
          })
        ])
        toast.success("Driver rejected — notified")
      }

      setSelected(null)
      load()
    } catch(e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  async function rescheduleAppointment() {
    if (!rescheduleForm.date || !rescheduleForm.time) return toast.error("Please enter date and time")
    await supabase.from("driver_vetting_appointments").update({
      appointment_date: rescheduleForm.date,
      appointment_time: rescheduleForm.time,
      status: "rescheduled",
      updated_at: new Date().toISOString()
    }).eq("id", rescheduling)
    toast.success("Appointment rescheduled")
    setRescheduling(null)
    setRescheduleForm({ date:"", time:"" })
    load()
  }

  const pending = appointments.filter(a=>["scheduled","rescheduled"].includes(a.status))
  const completed = appointments.filter(a=>a.status==="completed")

  const filtered = tab === "pending" ? pending : completed

  return (
    <div>
      <div style={{ fontFamily:"Syne", fontSize:isMobile?16:20, fontWeight:800, color:"#000", marginBottom:4 }}>Driver Vetting</div>
      <div style={{ fontSize:12, color:"#888", marginBottom:"1.5rem" }}>Review applications and conduct vetting appointments</div>

      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginBottom:"1.5rem" }}>
        {[
          { label:"Pending appointments", value:pending.length, color:"#e6821e" },
          { label:"Completed", value:completed.length, color:"#1d9e75" },
          { label:"Total applicants", value:appointments.length, color:"#378add" },
        ].map(s=>(
          <div key={s.label} style={{ background:"#f8f8f8", borderRadius:10, padding:"0.75rem", border:"1px solid #eeeeee" }}>
            <div style={{ fontFamily:"Syne", fontSize:20, fontWeight:800, color:s.color }}>{s.value}</div>
            <div style={{ fontSize:10, color:"#888", marginTop:2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", gap:6, marginBottom:"1rem" }}>
        {[{k:"pending",l:`Pending (${pending.length})`},{k:"completed",l:`Completed (${completed.length})`}].map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k)}
            style={{ padding:"7px 14px", borderRadius:8, border:"none", fontSize:12, cursor:"pointer", background:tab===t.k?"#8b5cf6":"#f8f8f8", color:tab===t.k?"#fff":"#666", fontFamily:"DM Sans,sans-serif", fontWeight:tab===t.k?700:400 }}>
            {t.l}
          </button>
        ))}
      </div>

      {loading&&<div style={{ color:"#888", fontSize:13 }}>Loading...</div>}

      {/* Selected appointment detail */}
      {selected&&(
        <div style={{ background:"#f8f8f8", border:"1px solid #8b5cf640", borderRadius:12, padding:"1.25rem", marginBottom:"1rem" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"1rem" }}>
            <div>
              <div style={{ fontFamily:"Syne", fontSize:15, fontWeight:800, color:"#000" }}>{selected.driver?.first_name} {selected.driver?.last_name}</div>
              <div style={{ fontSize:11, color:"#888" }}>{selected.driver?.email} · {selected.driver?.phone}</div>
              <div style={{ fontSize:11, color:"#888" }}>Vehicle: {selected.driver?.driver_vehicle_type} · {selected.appointment_date} at {selected.appointment_time}</div>
            </div>
            <button onClick={()=>setSelected(null)} style={{ background:"none", border:"none", fontSize:18, color:"#888", cursor:"pointer" }}>×</button>
          </div>

          {/* Documents */}
          <div style={{ marginBottom:"1rem" }}>
            <div style={{ fontSize:12, fontWeight:600, color:"#000", marginBottom:8 }}>📄 Submitted Documents</div>
            {documents.length===0&&<div style={{ fontSize:11, color:"#888" }}>No documents uploaded yet</div>}
            {documents.map(doc=>(
              <div key={doc.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", background:"#ffffff", borderRadius:8, padding:"0.6rem 0.75rem", marginBottom:6, border:"1px solid #eeeeee" }}>
                <div>
                  <div style={{ fontSize:12, fontWeight:600, color:"#000" }}>{doc.type.replace(/_/g," ").replace(/\b\w/g,l=>l.toUpperCase())}</div>
                  <a href={doc.document_url} target="_blank" rel="noopener noreferrer" style={{ fontSize:10, color:"#378add" }}>View document →</a>
                </div>
                <div style={{ display:"flex", gap:6 }}>
                  <button onClick={()=>verifyDocument(doc.id, true)} disabled={doc.is_verified}
                    style={{ background:doc.is_verified?"#f0fdf4":"#ffffff", border:`1px solid ${doc.is_verified?"#1d9e7540":"#dddddd"}`, borderRadius:6, color:doc.is_verified?"#1d9e75":"#555", fontSize:10, padding:"3px 8px", cursor:doc.is_verified?"default":"pointer" }}>
                    {doc.is_verified?"✓ Verified":"Verify"}
                  </button>
                  {doc.is_verified&&<button onClick={()=>verifyDocument(doc.id, false)}
                    style={{ background:"none", border:"1px solid #e24b4a30", borderRadius:6, color:"#e24b4a", fontSize:10, padding:"3px 8px", cursor:"pointer" }}>
                    Unverify
                  </button>}
                </div>
              </div>
            ))}
          </div>

          {/* Assessment */}
          {selected.status!=="completed"&&(
            <div>
              <div style={{ fontSize:12, fontWeight:600, color:"#000", marginBottom:8 }}>📝 Assessment Result</div>
              <div style={{ display:"flex", gap:8, marginBottom:10 }}>
                {["passed","failed","conditional"].map(r=>(
                  <button key={r} onClick={()=>setResult(r)}
                    style={{ flex:1, background:result===r?(r==="passed"?"#1d9e75":r==="failed"?"#e24b4a":"#e6821e"):"#ffffff", border:`1px solid ${result===r?(r==="passed"?"#1d9e75":r==="failed"?"#e24b4a":"#e6821e"):"#eeeeee"}`, borderRadius:8, padding:"8px", cursor:"pointer", color:result===r?"#fff":"#555", fontSize:12, fontWeight:result===r?700:400, textTransform:"capitalize" }}>
                    {r==="passed"?"✓ Passed":r==="failed"?"✗ Failed":"⚠️ Conditional"}
                  </button>
                ))}
              </div>
              <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Assessment notes (shared with driver if rejected)..."
                style={{ width:"100%", background:"#ffffff", border:"1px solid #e5e5e5", borderRadius:8, padding:"10px 12px", color:"#000", fontSize:12, outline:"none", resize:"vertical", minHeight:80, marginBottom:10, fontFamily:"DM Sans,sans-serif" }}/>
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={()=>{ setRescheduling(selected.id); setRescheduleForm({ date:selected.appointment_date||"", time:selected.appointment_time||"" }) }}
                  style={{ flex:1, background:"none", border:"1px solid #e6821e40", borderRadius:8, color:"#e6821e", fontSize:12, padding:"9px", cursor:"pointer" }}>
                  Reschedule
                </button>
                <button onClick={submitAssessment} disabled={saving||!result}
                  style={{ flex:2, background:saving||!result?"#e0e0e0":"#8b5cf6", border:"none", borderRadius:8, color:saving||!result?"#555":"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"9px 20px", cursor:saving||!result?"not-allowed":"pointer" }}>
                  {saving?"Saving...":"Submit Assessment"}
                </button>
              </div>
            </div>
          )}
          {selected.status==="completed"&&(
            <div style={{ background:selected.assessment_result==="passed"?"#f0fdf4":"#fff5f5", borderRadius:8, padding:"0.75rem" }}>
              <div style={{ fontSize:12, fontWeight:600, color:selected.assessment_result==="passed"?"#1d9e75":"#e24b4a" }}>
                Result: {selected.assessment_result?.toUpperCase()}
              </div>
              {selected.assessment_notes&&<div style={{ fontSize:11, color:"#555", marginTop:4 }}>{selected.assessment_notes}</div>}
            </div>
          )}
        </div>
      )}

      {/* Reschedule Modal */}
      {rescheduling&&(
        <div style={{ background:"#fff8f0", border:"1px solid #e6821e40", borderRadius:12, padding:"1.25rem", marginBottom:"1rem" }}>
          <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, color:"#e6821e", marginBottom:12 }}>📅 Reschedule Appointment</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
            <div>
              <label style={{ fontSize:11, color:"#666", display:"block", marginBottom:4 }}>New date</label>
              <input type="date" value={rescheduleForm.date} onChange={e=>setRescheduleForm(f=>({...f,date:e.target.value}))}
                style={{ width:"100%", background:"#ffffff", border:"1px solid #e5e5e5", borderRadius:8, padding:"9px 12px", fontSize:12, outline:"none" }}/>
            </div>
            <div>
              <label style={{ fontSize:11, color:"#666", display:"block", marginBottom:4 }}>New time</label>
              <input type="time" value={rescheduleForm.time} onChange={e=>setRescheduleForm(f=>({...f,time:e.target.value}))}
                style={{ width:"100%", background:"#ffffff", border:"1px solid #e5e5e5", borderRadius:8, padding:"9px 12px", fontSize:12, outline:"none" }}/>
            </div>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={rescheduleAppointment} style={{ background:"#e6821e", border:"none", borderRadius:8, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"9px 20px", cursor:"pointer" }}>Confirm reschedule</button>
            <button onClick={()=>setRescheduling(null)} style={{ background:"none", border:"1px solid #ddd", borderRadius:8, color:"#888", fontSize:12, padding:"9px 16px", cursor:"pointer" }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Search */}
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by driver name..."
        style={{ width:"100%", background:"#f8f8f8", border:"1px solid #eeeeee", borderRadius:8, padding:"9px 12px", fontSize:12, outline:"none", marginBottom:10, fontFamily:"DM Sans,sans-serif" }}/>

      {/* Appointments list */}
      {filtered.filter(a=>`${a.driver?.first_name} ${a.driver?.last_name}`.toLowerCase().includes(search.toLowerCase())).map(appt=>(
        <div key={appt.id} onClick={()=>selectAppointment(appt)}
          style={{ background:"#f8f8f8", border:`1px solid ${selected?.id===appt.id?"#8b5cf6":"#eeeeee"}`, borderRadius:10, padding:"1rem", marginBottom:8, cursor:"pointer" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
            <div>
              <div style={{ fontSize:13, fontWeight:600, color:"#000", marginBottom:2 }}>{appt.driver?.first_name} {appt.driver?.last_name}</div>
              <div style={{ fontSize:11, color:"#888", marginBottom:2 }}>📅 {appt.appointment_date} · ⏰ {appt.appointment_time}</div>
              <div style={{ fontSize:11, color:"#888" }}>Vehicle: {appt.driver?.driver_vehicle_type}</div>
            </div>
            <div style={{ textAlign:"right" }}>
              <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, background:`${STATUS_COLORS[appt.status]||"#888"}20`, color:STATUS_COLORS[appt.status]||"#888", fontWeight:600 }}>{appt.status}</span>
              {appt.assessment_result&&<div style={{ fontSize:10, color:appt.assessment_result==="passed"?"#1d9e75":"#e24b4a", marginTop:4, fontWeight:600 }}>{appt.assessment_result}</div>}
            </div>
          </div>
        </div>
      ))}
      {!loading&&filtered.length===0&&(
        <div style={{ color:"#888", fontSize:13, textAlign:"center", padding:"2rem" }}>
          No {tab} appointments
        </div>
      )}
    </div>
  )
}

