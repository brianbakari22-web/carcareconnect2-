import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import useIsMobile from "../../lib/useIsMobile"
import toast from "react-hot-toast"

const FUEL_LABELS = { empty:"Empty", quarter:"1/4", half:"1/2", three_quarter:"3/4", full:"Full" }

export default function CustomerVehicleReports() {
  const { user } = useAuth()
  const isMobile = useIsMobile()
  const [bookings, setBookings] = useState([])
  const [reports, setReports] = useState({})
  const [alerts, setAlerts] = useState([])
  const [disputes, setDisputes] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [showDispute, setShowDispute] = useState(null)
  const [disputeForm, setDisputeForm] = useState({ type:"mileage", description:"" })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => { if (user) load() }, [user])

  async function load() {
    const { data: bks } = await supabase.from("bookings")
      .select("id,service_name,booking_date,booking_number,status,is_concierge,service_category,vehicles(make,model,license_plate)")
      .eq("customer_id", user.id)
      .order("created_at", { ascending:false })
      .limit(30)

    setBookings(bks||[])

    if (bks?.length) {
      const ids = bks.map(b=>b.id)
      const [{ data: reps }, { data: alts }, { data: disps }] = await Promise.all([
        supabase.from("vehicle_condition_reports").select("*").in("booking_id", ids),
        supabase.from("mileage_alerts").select("*").in("booking_id", ids),
        supabase.from("vehicle_disputes").select("*").eq("customer_id", user.id),
      ])

      const repMap = {}
      reps?.forEach(r => {
        if (!repMap[r.booking_id]) repMap[r.booking_id] = {}
        repMap[r.booking_id][r.report_type] = r
      })
      setReports(repMap)
      setAlerts(alts||[])
      setDisputes(disps||[])
    }
    setLoading(false)
  }

  async function submitDispute(e) {
    e.preventDefault()
    if (!disputeForm.description) return toast.error("Please describe the dispute")
    setSubmitting(true)
    try {
      const { error } = await supabase.from("vehicle_disputes").insert({
        booking_id: showDispute,
        customer_id: user.id,
        dispute_type: disputeForm.type,
        description: disputeForm.description,
        status: "open",
      })
      if (error) throw error
      toast.success("Dispute submitted — admin will review within 24 hours")
      setShowDispute(null)
      setDisputeForm({ type:"mileage", description:"" })
      load()
    } catch(err) {
      toast.error(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  function getAlert(bookingId) { return alerts.find(a=>a.booking_id===bookingId) }
  function getDispute(bookingId) { return disputes.find(d=>d.booking_id===bookingId) }
  function canDispute(bookingId) {
    const bk = bookings.find(b=>b.id===bookingId)
    if (!bk) return false
    const report = reports[bookingId]?.dropoff
    if (!report) return false
    const hours = (Date.now() - new Date(report.created_at).getTime()) / 3600000
    return hours <= 24 && !getDispute(bookingId)
  }

  const inp = { width:"100%", background:"#ffffff", border:"1px solid #e5e5e5", borderRadius:8, padding:"11px 12px", color:"#000000", fontSize:13, outline:"none", fontFamily:"'DM Sans',sans-serif" }
  const lbl = { fontSize:11, color:"#666", textTransform:"uppercase", letterSpacing:"0.05em", display:"block", marginBottom:4 }

  return (
    <div>
      <div style={{ fontFamily:"Syne", fontSize:isMobile?16:18, fontWeight:800, color:"#000000", marginBottom:4 }}>Vehicle reports</div>
      <div style={{ fontSize:12, color:"#777777", marginBottom:"1.25rem" }}>Condition reports for your vehicles during service</div>

      {loading&&<div style={{ color:"#777777", fontSize:13 }}>Loading...</div>}
      {!loading&&bookings.length===0&&(
        <div style={{ color:"#888888", fontSize:13, textAlign:"center", padding:"3rem" }}>
          <div style={{ fontSize:32, marginBottom:10 }}>🚗</div>
          No vehicle reports yet
        </div>
      )}

      {bookings.map(b=>{
        const bReports = reports[b.id]||{}
        const alert = getAlert(b.id)
        const dispute = getDispute(b.id)
        const pickup = bReports.pickup
        const dropoff = bReports.dropoff
        return (
          <div key={b.id} style={{ background:"#ffffff", border:`1px solid ${alert&&!dispute?"#e6821e40":"#eeeeee"}`, borderRadius:12, padding:isMobile?"0.9rem":"1.1rem", marginBottom:10 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
              <div>
                <div style={{ fontSize:13, fontWeight:600, color:"#000000", marginBottom:2 }}>{b.service_name}</div>
                <div style={{ fontSize:11, color:"#777777" }}>#{b.booking_number} · {b.booking_date}</div>
                {b.vehicles&&<div style={{ fontSize:11, color:"#378add", marginTop:2 }}>🚗 {b.vehicles.make} {b.vehicles.model} — {b.vehicles.license_plate}</div>}
              </div>
              <button onClick={()=>setSelected(selected===b.id?null:b.id)}
                style={{ background:"none", border:"1px solid #dddddd", borderRadius:7, color:"#666", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>
                {selected===b.id?"Hide":"View reports"}
              </button>
            </div>

            {alert&&(
              <div style={{ background:"#fff8f0", border:"1px solid #e6821e40", borderRadius:8, padding:"0.75rem", marginBottom:8 }}>
                <div style={{ fontSize:12, color:"#e6821e", fontWeight:600, marginBottom:2 }}>⚠️ Mileage alert</div>
                <div style={{ fontSize:11, color:"#555555" }}>
                  Vehicle driven {alert.difference}km during service (pickup: {alert.pickup_odometer}km → dropoff: {alert.dropoff_odometer}km)
                </div>
                {dispute?(
                  <div style={{ fontSize:11, color:"#777777", marginTop:4 }}>
                    Dispute {dispute.status} — {dispute.status==="resolved"?"Resolved":dispute.status==="dismissed"?"Dismissed":"Under review"}
                  </div>
                ):canDispute(b.id)&&(
                  <button onClick={()=>setShowDispute(b.id)}
                    style={{ background:"#e6821e", border:"none", borderRadius:7, color:"#fff", fontSize:11, fontWeight:600, padding:"5px 12px", cursor:"pointer", marginTop:6 }}>
                    Dispute this
                  </button>
                )}
              </div>
            )}

            {selected===b.id&&(
              <div style={{ borderTop:"1px solid #eeeeee", paddingTop:10 }}>
                <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:10 }}>
                  {[{ report:pickup, type:"Pickup" }, { report:dropoff, type:"Dropoff" }].map(({ report, type })=>(
                    <div key={type} style={{ background:"#ffffff", borderRadius:10, padding:"0.9rem" }}>
                      <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, color:type==="Pickup"?"#378add":"#1d9e75", marginBottom:8 }}>{type} report</div>
                      {report?(
                        <div>
                          <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:4 }}>
                            <span style={{ color:"#777777" }}>Odometer</span>
                            <span style={{ color:"#000000", fontWeight:600 }}>{report.odometer_reading?.toLocaleString()} km</span>
                          </div>
                          <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:8 }}>
                            <span style={{ color:"#777777" }}>Fuel level</span>
                            <span style={{ color:"#000000" }}>{FUEL_LABELS[report.fuel_level]||report.fuel_level}</span>
                          </div>
                          <div style={{ fontSize:11, color:"#777777", marginBottom:4 }}>Condition:</div>
                          <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginBottom:4 }}>
                            {["has_scratches","has_dents","has_broken_lights","has_missing_parts","dirty_interior","dirty_exterior"].filter(k=>report[k]).map(k=>(
                              <span key={k} style={{ fontSize:10, padding:"2px 7px", borderRadius:10, background:"#fff5f5", color:"#e24b4a" }}>
                                {k.replace("has_","").replace("_"," ")}
                              </span>
                            ))}
                            {!["has_scratches","has_dents","has_broken_lights","has_missing_parts","dirty_interior","dirty_exterior"].some(k=>report[k])&&(
                              <span style={{ fontSize:10, color:"#1d9e75" }}>✓ No issues found</span>
                            )}
                          </div>
                          {report.condition_notes&&<div style={{ fontSize:11, color:"#777777", fontStyle:"italic" }}>&quot;{report.condition_notes}&quot;</div>}
                          <div style={{ fontSize:10, color:"#888888", marginTop:4 }}>{new Date(report.created_at).toLocaleString()}</div>
                        </div>
                      ):(
                        <div style={{ fontSize:12, color:"#888888", textAlign:"center", padding:"1rem" }}>No {type.toLowerCase()} report yet</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {showDispute===b.id&&(
              <div style={{ marginTop:10, background:"#fff8f0", border:"1px solid #e6821e30", borderRadius:10, padding:"1rem" }}>
                <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, color:"#e6821e", marginBottom:"1rem" }}>Raise a dispute</div>
                <form onSubmit={submitDispute}>
                  <div style={{ marginBottom:12 }}>
                    <label style={lbl}>Dispute type</label>
                    <select value={disputeForm.type} onChange={e=>setDisputeForm(f=>({...f,type:e.target.value}))} style={inp}>
                      <option value="mileage">Excessive mileage</option>
                      <option value="condition">Vehicle condition</option>
                      <option value="fuel">Fuel level discrepancy</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div style={{ marginBottom:12 }}>
                    <label style={lbl}>Description</label>
                    <textarea value={disputeForm.description} onChange={e=>setDisputeForm(f=>({...f,description:e.target.value}))}
                      placeholder="Describe your concern in detail..."
                      style={{ ...inp, resize:"vertical", minHeight:80 }} required/>
                  </div>
                  <div style={{ display:"flex", gap:8 }}>
                    <button type="submit" disabled={submitting}
                      style={{ background:submitting?"#555555":"#e6821e", border:"none", borderRadius:8, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:12, fontWeight:700, padding:"9px 18px", cursor:submitting?"not-allowed":"pointer" }}>
                      {submitting?"Submitting...":"Submit dispute"}
                    </button>
                    <button type="button" onClick={()=>setShowDispute(null)}
                      style={{ background:"none", border:"1px solid #dddddd", borderRadius:8, color:"#666", fontSize:12, padding:"9px 14px", cursor:"pointer" }}>
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}



