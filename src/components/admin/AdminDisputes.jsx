import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import useIsMobile from "../../lib/useIsMobile"
import toast from "react-hot-toast"
import { useAuth } from "../../contexts/AuthContext"

const FUEL_LABELS = { empty:"Empty", quarter:"1/4", half:"1/2", three_quarter:"3/4", full:"Full" }

export default function AdminDisputes() {
  const { user } = useAuth()
  const isMobile = useIsMobile()
  const [disputes, setDisputes] = useState([])
  const [alerts, setAlerts] = useState([])
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState("disputes")
  const [selected, setSelected] = useState(null)
  const [adminNotes, setAdminNotes] = useState("")
  const [resolving, setResolving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: disps }, { data: alts }, { data: reps }] = await Promise.all([
      supabase.from("vehicle_disputes").select("*, bookings(service_name,booking_number,booking_date), profiles(first_name,last_name,email)").order("created_at",{ascending:false}),
      supabase.from("mileage_alerts").select("*, bookings(service_name,booking_number,customer_id)").order("created_at",{ascending:false}),
      supabase.from("vehicle_condition_reports").select("*, profiles(first_name,last_name,role)").order("created_at",{ascending:false}).limit(50),
    ])
    setDisputes(disps||[])
    setAlerts(alts||[])
    setReports(reps||[])
    setLoading(false)
  }

  async function resolveDispute(id, status) {
    setResolving(true)
    try {
      const { error } = await supabase.from("vehicle_disputes").update({
        status,
        admin_notes: adminNotes,
        resolved_by: user.id,
        resolved_at: new Date().toISOString(),
      }).eq("id",id)
      if (error) throw error
      toast.success(`Dispute ${status}`)
      setSelected(null)
      setAdminNotes("")
      load()
    } catch(err) { toast.error(err.message) }
    finally { setResolving(false) }
  }

  const open = disputes.filter(d=>d.status==="open").length
  const underReview = disputes.filter(d=>d.status==="under_review").length
  const highMileage = alerts.filter(a=>a.difference>30).length

  const TABS = [
    { k:"disputes", l:`Disputes (${disputes.length})` },
    { k:"alerts", l:`Mileage alerts (${alerts.length})` },
    { k:"reports", l:`Condition reports (${reports.length})` },
  ]

  return (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(4,1fr)", gap:10, marginBottom:"1.5rem" }}>
        {[
          { label:"Open disputes", value:open, color:"#e24b4a" },
          { label:"Under review", value:underReview, color:"#e6821e" },
          { label:"Mileage alerts", value:highMileage, color:"#8b5cf6" },
          { label:"Total reports", value:reports.length, color:"#378add" },
        ].map(s=>(
          <div key={s.label} style={{ background:"#f8f8f8", borderRadius:10, padding:isMobile?"0.75rem":"1rem", border:"1px solid #eeeeee" }}>
            <div style={{ fontSize:10, color:"#888", textTransform:"uppercase", marginBottom:4 }}>{s.label}</div>
            <div style={{ fontFamily:"Syne", fontSize:isMobile?16:20, fontWeight:800, color:s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display:"flex", gap:6, marginBottom:"1.25rem", flexWrap:"wrap" }}>
        {TABS.map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k)}
            style={{ padding:"8px 16px", borderRadius:8, border:"none", fontSize:12, cursor:"pointer", background:tab===t.k?"#8b5cf6":"#f8f8f8", color:tab===t.k?"#fff":"#666", fontFamily:"'DM Sans',sans-serif", fontWeight:tab===t.k?700:400 }}>
            {t.l}
          </button>
        ))}
      </div>

      {/* DISPUTES */}
      {tab==="disputes"&&(
        <div>
          {loading&&<div style={{ color:"#888", fontSize:13 }}>Loading...</div>}
          {!loading&&disputes.length===0&&<div style={{ color:"#888", fontSize:13, textAlign:"center", padding:"2rem" }}>No disputes yet</div>}
          {disputes.map(d=>(
            <div key={d.id} style={{ background:"#f8f8f8", border:`1px solid ${d.status==="open"?"#e24b4a30":d.status==="resolved"?"#1d9e7530":"#eeeeee"}`, borderRadius:12, padding:"1rem", marginBottom:8 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4, flexWrap:"wrap" }}>
                    <div style={{ fontSize:13, fontWeight:600, color:"#000000" }}>{d.dispute_type?.replace("_"," ").toUpperCase()} dispute</div>
                    <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, background:d.status==="open"?"#1a0808":d.status==="resolved"?"#071a12":"#1a1208", color:d.status==="open"?"#e24b4a":d.status==="resolved"?"#1d9e75":"#e6821e" }}>{d.status}</span>
                  </div>
                  <div style={{ fontSize:12, color:"#888", marginBottom:2 }}>📋 {d.bookings?.service_name} — #{d.bookings?.booking_number}</div>
                  <div style={{ fontSize:11, color:"#888", marginBottom:2 }}>👤 {d.profiles?.first_name} {d.profiles?.last_name}</div>
                  <div style={{ fontSize:11, color:"#888", lineHeight:1.5 }}>"{d.description}"</div>
                  {d.admin_notes&&<div style={{ fontSize:11, color:"#378add", marginTop:4 }}>Admin: "{d.admin_notes}"</div>}
                  <div style={{ fontSize:10, color:"#888", marginTop:4 }}>{new Date(d.created_at).toLocaleString()}</div>
                </div>
                {d.status==="open"&&(
                  <button onClick={()=>setSelected(selected===d.id?null:d.id)}
                    style={{ background:"#f5f3ff", border:"1px solid #8b5cf640", borderRadius:7, color:"#8b5cf6", fontSize:11, padding:"5px 10px", cursor:"pointer", flexShrink:0 }}>
                    Review
                  </button>
                )}
              </div>

              {selected===d.id&&(
                <div style={{ borderTop:"1px solid #eeeeee", paddingTop:10 }}>
                  <div style={{ marginBottom:10 }}>
                    <label style={{ fontSize:11, color:"#888", display:"block", marginBottom:4 }}>Admin notes</label>
                    <textarea value={adminNotes} onChange={e=>setAdminNotes(e.target.value)}
                      placeholder="Add resolution notes..."
                      style={{ width:"100%", background:"#ffffff", border:"1px solid #222", borderRadius:8, padding:"9px 12px", color:"#000000", fontSize:12, outline:"none", resize:"vertical", minHeight:60, fontFamily:"'DM Sans',sans-serif" }}/>
                  </div>
                  <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                    <button onClick={()=>resolveDispute(d.id,"under_review")} disabled={resolving}
                      style={{ background:"#fff8f0", border:"1px solid #e6821e40", borderRadius:7, color:"#e6821e", fontSize:12, padding:"7px 14px", cursor:"pointer" }}>
                      Mark under review
                    </button>
                    <button onClick={()=>resolveDispute(d.id,"resolved")} disabled={resolving}
                      style={{ background:"#f0fdf4", border:"1px solid #1d9e7540", borderRadius:7, color:"#1d9e75", fontSize:12, padding:"7px 14px", cursor:"pointer" }}>
                      Resolve
                    </button>
                    <button onClick={()=>resolveDispute(d.id,"dismissed")} disabled={resolving}
                      style={{ background:"none", border:"1px solid #e24b4a30", borderRadius:7, color:"#e24b4a", fontSize:12, padding:"7px 14px", cursor:"pointer" }}>
                      Dismiss
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* MILEAGE ALERTS */}
      {tab==="alerts"&&(
        <div>
          {alerts.length===0&&<div style={{ color:"#888", fontSize:13, textAlign:"center", padding:"2rem" }}>No mileage alerts</div>}
          {alerts.map(a=>(
            <div key={a.id} style={{ background:"#f8f8f8", border:`1px solid ${a.difference>30?"#e6821e30":"#eeeeee"}`, borderRadius:10, padding:"1rem", marginBottom:8 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:"#000000", marginBottom:4 }}>{a.bookings?.service_name}</div>
                  <div style={{ fontSize:11, color:"#888", marginBottom:4 }}>#{a.bookings?.booking_number}</div>
                  <div style={{ display:"flex", gap:16, flexWrap:"wrap" }}>
                    <div>
                      <div style={{ fontSize:10, color:"#888" }}>Pickup</div>
                      <div style={{ fontSize:13, color:"#000000", fontWeight:600 }}>{a.pickup_odometer?.toLocaleString()} km</div>
                    </div>
                    <div>
                      <div style={{ fontSize:10, color:"#888" }}>Dropoff</div>
                      <div style={{ fontSize:13, color:"#000000", fontWeight:600 }}>{a.dropoff_odometer?.toLocaleString()} km</div>
                    </div>
                    <div>
                      <div style={{ fontSize:10, color:"#888" }}>Difference</div>
                      <div style={{ fontSize:13, fontWeight:800, color:a.difference>30?"#e24b4a":"#1d9e75" }}>{a.difference} km</div>
                    </div>
                  </div>
                </div>
                <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, background:a.difference>30?"#1a0808":"#071a12", color:a.difference>30?"#e24b4a":"#1d9e75" }}>
                  {a.difference>30?"⚠️ Alert":"✓ Normal"}
                </span>
              </div>
              <div style={{ fontSize:10, color:"#888", marginTop:6 }}>{new Date(a.created_at).toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}

      {/* CONDITION REPORTS */}
      {tab==="reports"&&(
        <div>
          {reports.length===0&&<div style={{ color:"#888", fontSize:13, textAlign:"center", padding:"2rem" }}>No condition reports yet</div>}
          {reports.map(r=>(
            <div key={r.id} style={{ background:"#f8f8f8", border:`1px solid ${r.report_type==="pickup"?"#378add20":"#1d9e7520"}`, borderRadius:10, padding:"1rem", marginBottom:8 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                <div>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4, flexWrap:"wrap" }}>
                    <span style={{ fontSize:14 }}>{r.report_type==="pickup"?"🚗":"✅"}</span>
                    <div style={{ fontSize:13, fontWeight:600, color:r.report_type==="pickup"?"#378add":"#1d9e75" }}>
                      {r.report_type==="pickup"?"Pickup":"Dropoff"} report
                    </div>
                    <span style={{ fontSize:10, color:"#888" }}>by {r.profiles?.first_name} {r.profiles?.last_name} ({r.profiles?.role})</span>
                  </div>
                  <div style={{ fontSize:11, color:"#888", marginBottom:4 }}>
                    Odometer: {r.odometer_reading?.toLocaleString()} km · Fuel: {FUEL_LABELS[r.fuel_level]||r.fuel_level}
                  </div>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
                    {["has_scratches","has_dents","has_broken_lights","has_missing_parts","dirty_interior","dirty_exterior"].filter(k=>r[k]).map(k=>(
                      <span key={k} style={{ fontSize:10, padding:"1px 7px", borderRadius:10, background:"#fff5f5", color:"#e24b4a" }}>
                        {k.replace("has_","").replace("_"," ")}
                      </span>
                    ))}
                    {!["has_scratches","has_dents","has_broken_lights","has_missing_parts","dirty_interior","dirty_exterior"].some(k=>r[k])&&(
                      <span style={{ fontSize:10, color:"#1d9e75" }}>✓ No issues</span>
                    )}
                  </div>
                  {r.condition_notes&&<div style={{ fontSize:11, color:"#888", marginTop:4, fontStyle:"italic" }}>"{r.condition_notes}"</div>}
                </div>
                <div style={{ fontSize:10, color:"#888", flexShrink:0 }}>{new Date(r.created_at).toLocaleString()}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
