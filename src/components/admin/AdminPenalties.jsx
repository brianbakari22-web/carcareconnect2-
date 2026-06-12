import { useState, useEffect } from "react"
import { supabase } from "../../lib/supabase"
import toast from "react-hot-toast"

const VIOLATION_TYPES = [
  { key:"no_show", label:"No Show", color:"#e6821e" },
  { key:"cancellation", label:"Repeated Cancellation", color:"#378add" },
  { key:"abuse", label:"Abusive Behavior", color:"#e24b4a" },
  { key:"false_claim", label:"False Claim", color:"#8b5cf6" },
  { key:"fraud", label:"Fraud/Scam", color:"#e24b4a" },
  { key:"other", label:"Other", color:"#888" },
]

const PENALTY_RULES = {
  1: { type:"warning", label:"Warning", color:"#e6821e", hours:0 },
  2: { type:"suspension", label:"Suspension", color:"#378add", hours:24 },
  3: { type:"permanent_ban", label:"Permanent Ban", color:"#e24b4a", hours:0 },
}

export default function AdminPenalties() {
  const [users, setUsers] = useState([])
  const [violations, setViolations] = useState([])
  const [penalties, setPenalties] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState("violations")
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState("")
  const [form, setForm] = useState({ user_id:"", role:"", violation_type:"no_show", description:"", booking_id:"" })
  const [suspendHours, setSuspendHours] = useState(24)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: v }, { data: p }, { data: u }] = await Promise.all([
      supabase.from("user_violations").select("*, profiles!user_id(first_name,last_name,role)").order("created_at",{ascending:false}),
      supabase.from("user_penalties").select("*, profiles!user_id(first_name,last_name,role)").order("created_at",{ascending:false}),
      supabase.from("profiles").select("id,first_name,last_name,role,is_suspended,is_banned,violation_count,warning_count").order("first_name"),
    ])
    setViolations(v||[])
    setPenalties(p||[])
    setUsers(u||[])
    setLoading(false)
  }

  async function submitViolation() {
    if (!form.user_id || !form.violation_type) return toast.error("Select a user and violation type")
    
    // Get current violation count
    const { data: profile } = await supabase.from("profiles").select("violation_count,warning_count,role").eq("id", form.user_id).single()
    const currentCount = (profile?.violation_count||0) + 1
    const penaltyLevel = Math.min(currentCount, 3)
    const penalty = PENALTY_RULES[penaltyLevel]

    // Insert violation
    const { data: violation, error: vErr } = await supabase.from("user_violations").insert({
      user_id: form.user_id,
      role: form.role || profile?.role,
      violation_type: form.violation_type,
      description: form.description,
      booking_id: form.booking_id || null,
    }).select().single()
    if (vErr) return toast.error(vErr.message)

    // Calculate suspension expiry
    const suspExpiry = penalty.type === "suspension"
      ? new Date(Date.now() + suspendHours * 3600000).toISOString()
      : null

    // Insert penalty
    await supabase.from("user_penalties").insert({
      user_id: form.user_id,
      role: form.role || profile?.role,
      penalty_level: penaltyLevel,
      penalty_type: penalty.type,
      reason: form.description,
      violation_id: violation.id,
      suspension_hours: penalty.type === "suspension" ? suspendHours : null,
      suspension_expires_at: suspExpiry,
      is_active: true,
    })

    // Update profile
    const updates = {
      violation_count: currentCount,
      is_suspended: penalty.type === "suspension",
      is_banned: penalty.type === "permanent_ban",
      suspension_expires_at: suspExpiry,
    }
    if (penalty.type === "warning") updates.warning_count = (profile?.warning_count||0) + 1
    await supabase.from("profiles").update(updates).eq("id", form.user_id)

    // Update driver_status if driver
    if ((form.role||profile?.role) === "driver") {
      await supabase.from("driver_status").upsert({
        driver_id: form.user_id,
        is_suspended: penalty.type === "suspension" || penalty.type === "permanent_ban",
        suspension_expires_at: suspExpiry,
      }, { onConflict:"driver_id" })
    }

    // Send notification
    await supabase.from("notifications").insert({
      user_id: form.user_id,
      title: `Account ${penalty.label}`,
      message: penalty.type === "warning"
        ? `You have received a warning for: ${form.description||form.violation_type}. Further violations will result in suspension.`
        : penalty.type === "suspension"
        ? `Your account has been suspended for ${suspendHours} hours due to: ${form.description||form.violation_type}.`
        : `Your account has been permanently banned due to: ${form.description||form.violation_type}. Contact support to appeal.`,
      type: penalty.type === "warning" ? "warning" : "error",
    })

    toast.success(`${penalty.label} issued successfully!`)
    setShowForm(false)
    setForm({ user_id:"", role:"", violation_type:"no_show", description:"", booking_id:"" })
    load()
  }

  async function removeRestriction(userId) {
    if (!confirm("Remove suspension/ban from this user?")) return
    await supabase.from("profiles").update({ is_suspended:false, is_banned:false, suspension_expires_at:null }).eq("id", userId)
    await supabase.from("driver_status").update({ is_suspended:false, suspension_expires_at:null }).eq("driver_id", userId)
    await supabase.from("user_penalties").update({ is_active:false }).eq("user_id", userId).eq("is_active", true)
    await supabase.from("notifications").insert({
      user_id: userId,
      title: "Account restriction removed",
      message: "Your account restriction has been lifted. You can now use the platform normally.",
      type: "success",
    })
    toast.success("Restriction removed")
    load()
  }

  const filteredUsers = users.filter(u =>
    `${u.first_name} ${u.last_name}`.toLowerCase().includes(search.toLowerCase())
  )

  const suspendedUsers = users.filter(u => u.is_suspended || u.is_banned)

  return (
    <div style={{ padding:"1.5rem", fontFamily:"DM Sans,sans-serif" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1.5rem" }}>
        <div>
          <div style={{ fontFamily:"Syne", fontSize:22, fontWeight:800 }}>Penalties & Violations</div>
          <div style={{ fontSize:13, color:"#888", marginTop:2 }}>Manage user violations and enforce platform policies</div>
        </div>
        <button onClick={()=>setShowForm(true)}
          style={{ background:"#e24b4a", border:"none", borderRadius:10, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"10px 20px", cursor:"pointer" }}>
          + Issue Violation
        </button>
      </div>

      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:"1.5rem" }}>
        {[
          { label:"Total violations", value:violations.length, color:"#e6821e", icon:"⚠️" },
          { label:"Active penalties", value:penalties.filter(p=>p.is_active).length, color:"#e24b4a", icon:"🚫" },
          { label:"Suspended users", value:suspendedUsers.filter(u=>u.is_suspended).length, color:"#378add", icon:"⏸️" },
          { label:"Banned users", value:suspendedUsers.filter(u=>u.is_banned).length, color:"#e24b4a", icon:"❌" },
        ].map(s=>(
          <div key={s.label} style={{ background:"#fff", border:"1px solid #eee", borderRadius:12, padding:"1rem", display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ fontSize:24 }}>{s.icon}</div>
            <div>
              <div style={{ fontFamily:"Syne", fontSize:22, fontWeight:800, color:s.color }}>{s.value}</div>
              <div style={{ fontSize:11, color:"#888" }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Issue violation form */}
      {showForm&&(
        <div style={{ background:"#fff", border:"2px solid #e24b4a", borderRadius:14, padding:"1.5rem", marginBottom:"1.5rem" }}>
          <div style={{ fontFamily:"Syne", fontSize:16, fontWeight:800, color:"#e24b4a", marginBottom:"1rem" }}>Issue Violation</div>
          
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
            <div>
              <label style={{ fontSize:12, color:"#888", display:"block", marginBottom:4 }}>Search User</label>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by name..."
                style={{ width:"100%", border:"1px solid #eee", borderRadius:8, padding:"8px 10px", fontSize:13, outline:"none" }}/>
              {search && filteredUsers.length > 0 && (
                <div style={{ background:"#fff", border:"1px solid #eee", borderRadius:8, maxHeight:150, overflowY:"auto", marginTop:4 }}>
                  {filteredUsers.slice(0,5).map(u=>(
                    <div key={u.id} onClick={()=>{ setForm(f=>({...f, user_id:u.id, role:u.role})); setSearch(`${u.first_name} ${u.last_name}`) }}
                      style={{ padding:"8px 12px", cursor:"pointer", fontSize:13, borderBottom:"1px solid #f5f5f5" }}>
                      {u.first_name} {u.last_name} <span style={{ color:"#888", fontSize:11 }}>({u.role})</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label style={{ fontSize:12, color:"#888", display:"block", marginBottom:4 }}>Violation Type</label>
              <select value={form.violation_type} onChange={e=>setForm(f=>({...f,violation_type:e.target.value}))}
                style={{ width:"100%", border:"1px solid #eee", borderRadius:8, padding:"8px 10px", fontSize:13, outline:"none" }}>
                {VIOLATION_TYPES.map(v=>(
                  <option key={v.key} value={v.key}>{v.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ marginBottom:12 }}>
            <label style={{ fontSize:12, color:"#888", display:"block", marginBottom:4 }}>Description / Reason</label>
            <textarea value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))}
              placeholder="Describe the violation in detail..."
              style={{ width:"100%", border:"1px solid #eee", borderRadius:8, padding:"8px 10px", fontSize:13, outline:"none", height:70, resize:"vertical" }}/>
          </div>

          <div style={{ marginBottom:12 }}>
            <label style={{ fontSize:12, color:"#888", display:"block", marginBottom:4 }}>Suspension hours (if 2nd offense)</label>
            <select value={suspendHours} onChange={e=>setSuspendHours(Number(e.target.value))}
              style={{ border:"1px solid #eee", borderRadius:8, padding:"8px 10px", fontSize:13, outline:"none" }}>
              <option value={24}>24 hours</option>
              <option value={48}>48 hours</option>
              <option value={72}>72 hours</option>
              <option value={168}>7 days</option>
              <option value={336}>14 days</option>
            </select>
          </div>

          {form.user_id && (
            <div style={{ background:"#fff8f0", border:"1px solid #e6821e30", borderRadius:8, padding:"0.75rem", marginBottom:12 }}>
              {(() => {
                const u = users.find(x=>x.id===form.user_id)
                const count = (u?.violation_count||0) + 1
                const level = Math.min(count, 3)
                const p = PENALTY_RULES[level]
                return (
                  <div style={{ fontSize:13 }}>
                    <span style={{ color:"#e6821e", fontWeight:600 }}>Penalty preview: </span>
                    <span style={{ color:p.color, fontWeight:700 }}>{p.label}</span>
                    <span style={{ color:"#888" }}> (violation #{count} for this user)</span>
                  </div>
                )
              })()}
            </div>
          )}

          <div style={{ display:"flex", gap:10 }}>
            <button onClick={submitViolation}
              style={{ background:"#e24b4a", border:"none", borderRadius:8, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"10px 24px", cursor:"pointer" }}>
              Issue Violation & Penalty
            </button>
            <button onClick={()=>{ setShowForm(false); setSearch("") }}
              style={{ background:"none", border:"1px solid #ddd", borderRadius:8, color:"#555", fontSize:13, padding:"10px 18px", cursor:"pointer" }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display:"flex", gap:8, marginBottom:"1rem" }}>
        {[
          { k:"violations", l:`Violations (${violations.length})` },
          { k:"penalties", l:`Active Penalties (${penalties.filter(p=>p.is_active).length})` },
          { k:"suspended", l:`Restricted Users (${suspendedUsers.length})` },
        ].map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k)}
            style={{ padding:"8px 16px", borderRadius:20, border:"none", fontSize:12, cursor:"pointer", background:tab===t.k?"#e24b4a":"#f0f0f0", color:tab===t.k?"#fff":"#555", fontWeight:tab===t.k?700:400 }}>
            {t.l}
          </button>
        ))}
      </div>

      {loading && <div style={{ color:"#888", fontSize:13 }}>Loading...</div>}

      {/* Violations tab */}
      {tab==="violations"&&!loading&&(
        <div>
          {violations.length===0&&<div style={{ color:"#888", textAlign:"center", padding:"2rem" }}>No violations recorded</div>}
          {violations.map(v=>(
            <div key={v.id} style={{ background:"#fff", border:"1px solid #eee", borderRadius:12, padding:"1rem", marginBottom:8 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                <div>
                  <div style={{ fontSize:14, fontWeight:600, color:"#000" }}>
                    {v.profiles?.first_name} {v.profiles?.last_name}
                    <span style={{ fontSize:11, color:"#888", marginLeft:8 }}>({v.profiles?.role})</span>
                  </div>
                  <div style={{ fontSize:12, color:"#888", marginTop:2 }}>{v.description}</div>
                  <div style={{ fontSize:11, color:"#aaa", marginTop:2 }}>{new Date(v.created_at).toLocaleString("en-KE")}</div>
                </div>
                <div style={{ background:VIOLATION_TYPES.find(x=>x.key===v.violation_type)?.color+"20", color:VIOLATION_TYPES.find(x=>x.key===v.violation_type)?.color, padding:"3px 10px", borderRadius:20, fontSize:11, fontWeight:600, flexShrink:0 }}>
                  {VIOLATION_TYPES.find(x=>x.key===v.violation_type)?.label||v.violation_type}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Penalties tab */}
      {tab==="penalties"&&!loading&&(
        <div>
          {penalties.filter(p=>p.is_active).length===0&&<div style={{ color:"#888", textAlign:"center", padding:"2rem" }}>No active penalties</div>}
          {penalties.filter(p=>p.is_active).map(p=>(
            <div key={p.id} style={{ background:"#fff", border:`1px solid ${PENALTY_RULES[p.penalty_level]?.color||"#eee"}30`, borderRadius:12, padding:"1rem", marginBottom:8 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                <div>
                  <div style={{ fontSize:14, fontWeight:600, color:"#000" }}>
                    {p.profiles?.first_name} {p.profiles?.last_name}
                    <span style={{ fontSize:11, color:"#888", marginLeft:8 }}>({p.profiles?.role})</span>
                  </div>
                  <div style={{ fontSize:12, color:"#888", marginTop:2 }}>{p.reason}</div>
                  {p.suspension_expires_at&&<div style={{ fontSize:11, color:"#378add", marginTop:2 }}>Expires: {new Date(p.suspension_expires_at).toLocaleString("en-KE")}</div>}
                  <div style={{ fontSize:11, color:"#aaa", marginTop:2 }}>{new Date(p.created_at).toLocaleString("en-KE")}</div>
                </div>
                <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:6 }}>
                  <span style={{ background:PENALTY_RULES[p.penalty_level]?.color+"20", color:PENALTY_RULES[p.penalty_level]?.color, padding:"3px 10px", borderRadius:20, fontSize:11, fontWeight:600 }}>
                    {p.penalty_type?.replace("_"," ").toUpperCase()}
                  </span>
                  <button onClick={()=>removeRestriction(p.user_id)}
                    style={{ background:"#f0fdf4", border:"1px solid #1d9e7540", borderRadius:6, color:"#1d9e75", fontSize:11, padding:"4px 10px", cursor:"pointer" }}>
                    Lift restriction
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Suspended users tab */}
      {tab==="suspended"&&!loading&&(
        <div>
          {suspendedUsers.length===0&&<div style={{ color:"#888", textAlign:"center", padding:"2rem" }}>No restricted users</div>}
          {suspendedUsers.map(u=>(
            <div key={u.id} style={{ background:"#fff", border:`1px solid ${u.is_banned?"#e24b4a":"#378add"}30`, borderRadius:12, padding:"1rem", marginBottom:8 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div>
                  <div style={{ fontSize:14, fontWeight:600, color:"#000" }}>
                    {u.first_name} {u.last_name}
                    <span style={{ fontSize:11, color:"#888", marginLeft:8 }}>({u.role})</span>
                  </div>
                  <div style={{ fontSize:12, color:"#888", marginTop:2 }}>Violations: {u.violation_count||0} · Warnings: {u.warning_count||0}</div>
                  {u.suspension_expires_at&&<div style={{ fontSize:11, color:"#378add", marginTop:2 }}>Suspended until: {new Date(u.suspension_expires_at).toLocaleString("en-KE")}</div>}
                </div>
                <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:6 }}>
                  <span style={{ background:u.is_banned?"#e24b4a20":"#378add20", color:u.is_banned?"#e24b4a":"#378add", padding:"3px 10px", borderRadius:20, fontSize:11, fontWeight:600 }}>
                    {u.is_banned?"BANNED":"SUSPENDED"}
                  </span>
                  <button onClick={()=>removeRestriction(u.id)}
                    style={{ background:"#f0fdf4", border:"1px solid #1d9e7540", borderRadius:6, color:"#1d9e75", fontSize:11, padding:"4px 10px", cursor:"pointer" }}>
                    Lift restriction
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
