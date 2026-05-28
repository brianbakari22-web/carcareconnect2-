import { useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import useIsMobile from "../../lib/useIsMobile"
import toast from "react-hot-toast"

const FUEL_LEVELS = [
  { key:"empty", label:"Empty" },
  { key:"quarter", label:"1/4" },
  { key:"half", label:"1/2" },
  { key:"three_quarter", label:"3/4" },
  { key:"full", label:"Full" },
]

const CHECKLIST = [
  { key:"has_scratches", label:"Scratches visible" },
  { key:"has_dents", label:"Dents visible" },
  { key:"has_broken_lights", label:"Broken lights" },
  { key:"has_missing_parts", label:"Missing parts" },
  { key:"dirty_interior", label:"Dirty interior" },
  { key:"dirty_exterior", label:"Dirty exterior" },
]

export default function VehicleConditionReport({ bookingId, reportType, onComplete, vehicleInfo }) {
  const { user } = useAuth()
  const isMobile = useIsMobile()
  const [form, setForm] = useState({
    odometer_reading:"",
    fuel_level:"half",
    has_scratches:false,
    has_dents:false,
    has_broken_lights:false,
    has_missing_parts:false,
    dirty_interior:false,
    dirty_exterior:false,
    condition_notes:"",
  })
  const [saving, setSaving] = useState(false)

  async function submit(e) {
    e.preventDefault()
    if (!form.odometer_reading) return toast.error("Odometer reading required")
    setSaving(true)
    try {
      const { error } = await supabase.from("vehicle_condition_reports").insert({
        booking_id: bookingId,
        report_type: reportType,
        reported_by: user.id,
        odometer_reading: parseInt(form.odometer_reading),
        fuel_level: form.fuel_level,
        has_scratches: form.has_scratches,
        has_dents: form.has_dents,
        has_broken_lights: form.has_broken_lights,
        has_missing_parts: form.has_missing_parts,
        dirty_interior: form.dirty_interior,
        dirty_exterior: form.dirty_exterior,
        condition_notes: form.condition_notes,
      })
      if (error) throw error

      if (reportType==="dropoff") {
        const { data: pickup } = await supabase.from("vehicle_condition_reports")
          .select("odometer_reading").eq("booking_id", bookingId).eq("report_type","pickup").maybeSingle()
        if (pickup) {
          const diff = parseInt(form.odometer_reading) - pickup.odometer_reading
          if (diff > 0) {
            await supabase.from("mileage_alerts").insert({
              booking_id: bookingId,
              pickup_odometer: pickup.odometer_reading,
              dropoff_odometer: parseInt(form.odometer_reading),
              difference: diff,
              alert_sent: diff > 30,
            })
            if (diff > 30) {
              const { data: booking } = await supabase.from("bookings").select("customer_id").eq("id", bookingId).single()
              if (booking) {
                await supabase.from("notifications").insert({
                  user_id: booking.customer_id,
                  title: "Mileage alert ⚠️",
                  message: `Your vehicle was driven ${diff}km during service. This exceeds the 30km threshold. You can dispute this in your booking details.`,
                  type: "warning",
                })
              }
              toast("Mileage alert sent to customer", { icon:"⚠️" })
            }
          }
        }
      }

      toast.success(`${reportType==="pickup"?"Pickup":"Dropoff"} report saved`)
      onComplete()
    } catch(err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const inp = { width:"100%", background:"#111", border:"1px solid #222", borderRadius:8, padding:"11px 12px", color:"#f0ede6", fontSize:13, outline:"none", fontFamily:"'DM Sans',sans-serif" }
  const lbl = { fontSize:11, color:"#666", textTransform:"uppercase", letterSpacing:"0.05em", display:"block", marginBottom:4 }

  return (
    <div style={{ background:"#111", border:`1px solid ${reportType==="pickup"?"#378add40":"#1d9e7540"}`, borderRadius:12, padding:"1.25rem" }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:"1.25rem" }}>
        <span style={{ fontSize:22 }}>{reportType==="pickup"?"🚗":"✅"}</span>
        <div>
          <div style={{ fontFamily:"Syne", fontSize:15, fontWeight:800, color:reportType==="pickup"?"#378add":"#1d9e75" }}>
            {reportType==="pickup"?"Vehicle Pickup Report":"Vehicle Dropoff Report"}
          </div>
          {vehicleInfo&&<div style={{ fontSize:11, color:"#555" }}>{vehicleInfo}</div>}
        </div>
      </div>

      <form onSubmit={submit}>
        {/* Odometer */}
        <div style={{ marginBottom:16 }}>
          <label style={lbl}>Odometer reading (km) *</label>
          <input type="number" value={form.odometer_reading} onChange={e=>setForm(f=>({...f,odometer_reading:e.target.value}))}
            placeholder="e.g. 45230" required style={inp}/>
          <div style={{ fontSize:10, color:"#444", marginTop:4 }}>Enter the exact reading from the dashboard</div>
        </div>

        {/* Fuel level */}
        <div style={{ marginBottom:16 }}>
          <label style={lbl}>Fuel level</label>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:6 }}>
            {FUEL_LEVELS.map(f=>(
              <button key={f.key} type="button" onClick={()=>setForm(fm=>({...fm,fuel_level:f.key}))}
                style={{ background:form.fuel_level===f.key?"#0c1f2e":"#0f0f0f", border:`1px solid ${form.fuel_level===f.key?"#378add":"#222"}`, borderRadius:8, padding:"8px 4px", cursor:"pointer", textAlign:"center" }}>
                <div style={{ fontSize:10, color:form.fuel_level===f.key?"#378add":"#555", fontWeight:form.fuel_level===f.key?700:400 }}>{f.label}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Condition checklist */}
        <div style={{ marginBottom:16 }}>
          <label style={lbl}>Vehicle condition</label>
          <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr 1fr":"repeat(3,1fr)", gap:8 }}>
            {CHECKLIST.map(c=>(
              <label key={c.key} style={{ display:"flex", alignItems:"center", gap:8, padding:"8px", background:"#0f0f0f", borderRadius:8, cursor:"pointer", border:`1px solid ${form[c.key]?"#e24b4a30":"#1a1a1a"}` }}>
                <input type="checkbox" checked={form[c.key]} onChange={e=>setForm(f=>({...f,[c.key]:e.target.checked}))}
                  style={{ accentColor:"#e24b4a", width:14, height:14, flexShrink:0 }}/>
                <span style={{ fontSize:11, color:form[c.key]?"#e24b4a":"#666" }}>{c.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div style={{ marginBottom:16 }}>
          <label style={lbl}>Additional notes</label>
          <textarea value={form.condition_notes} onChange={e=>setForm(f=>({...f,condition_notes:e.target.value}))}
            placeholder="Any other observations about the vehicle condition..."
            style={{ ...inp, resize:"vertical", minHeight:70 }}/>
        </div>

        <button type="submit" disabled={saving}
          style={{ width:"100%", background:saving?"#333":reportType==="pickup"?"#378add":"#1d9e75", border:"none", borderRadius:9, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:14, fontWeight:700, padding:"13px", cursor:saving?"not-allowed":"pointer" }}>
          {saving?"Saving report...":reportType==="pickup"?"Save pickup report ✓":"Save dropoff report ✓"}
        </button>
      </form>
    </div>
  )
}
