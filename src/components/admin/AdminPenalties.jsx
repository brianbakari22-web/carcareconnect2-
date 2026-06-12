import { useState, useEffect } from "react"
import { supabase } from "../../lib/supabase"
import toast from "react-hot-toast"

const VIOLATION_TYPES = [
  { key:"no_show",      label:"No Show",                icon:"🕐", color:"#e6821e" },
  { key:"cancellation", label:"Repeated Cancellation",  icon:"❌", color:"#378add" },
  { key:"abuse",        label:"Abusive Behavior",       icon:"🚫", color:"#e24b4a" },
  { key:"false_claim",  label:"False Claim",            icon:"⚠️", color:"#8b5cf6" },
  { key:"fraud",        label:"Fraud / Scam",           icon:"🔴", color:"#e24b4a" },
  { key:"other",        label:"Other",                  icon:"📋", color:"#888888" },
]

const PENALTY_RULES = {
  1: { type:"warning",       label:"Warning",       icon:"⚠️", color:"#e6821e", bg:"#fff8f0" },
  2: { type:"suspension",    label:"Suspension",    icon:"⏸️", color:"#378add", bg:"#eff6ff" },
  3: { type:"permanent_ban", label:"Permanent Ban", icon:"🚫", color:"#e24b4a", bg:"#fff5f5" },
}

const ROLE_COLORS = { customer:"#e6821e", provider:"#378add", driver:"#1d9e75", admin:"#8b5cf6" }

function Badge({ label, color, bg, icon }) {
  return (
    <span style={{ background:bg||color+"15", color, padding:"3px 10px", borderRadius:20, fontSize:11, fontWeight:600, display:"inline-flex", alignItems:"center", gap:4 }}>
      {icon&&<span>{icon}</span>}{label}
    </span>
  )
}

export default function AdminPenalties() {
  const [users, setUsers] = useState([])
  const [violations, setViolations] = useState([])
  const [penalties, setPenalties] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState("overview")
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState("")
  const [searchResults, setSearchResults] = useState([])
  const [selectedUser, setSelectedUser] = useState(null)
  const [form, setForm] = useState({ user_id:"", role:"", violation_type:"no_show", description:"" })
  const [suspendHours, setSuspendHours] = useState(24)

  useEffect(() => { load() }, [])
  useEffect(() => {
    if (search.length > 1) {
      const results = users.filter(u => `${u.first_name} ${u.last_name} ${u.role}`.toLowerCase().includes(search.toLowerCase()))
      setSearchResults(results.slice(0,6))
    } else {
      setSearchResults([])
    }
  }, [search, users])

  async function load() {
    setLoading(true)
    const [{ data: v }, { data: p }, { data: u }] = await Promise.all([
      supabase.from("user_violations").select("*, profiles!user_id(first_name,last_name,role)").order("created_at",{ascending:false}),
      supabase.from("user_penalties").select("*, profiles!user_id(first_name,last_name,role)").order("created_at",{ascending:false}),
      supabase.from("profiles").select("id,first_name,last_name,role,is_suspended,is_banned,violation_count,warning_count,suspension_expires_at").order("first_name"),
    ])
    setViolations(v||[])
    setPenalties(p||[])
    setUsers(u||[])
    setLoading(false)
  }

  async function submitViolation() {
    if (!form.user_id) return toast.error("Please select a user")
    if (!form.description.trim()) return toast.error("Please provide a description")
    const { data: profile } = await supabase.from("profiles").select("violation_count,warning_count,role").eq("id", form.user_id).single()
    const currentCount = (profile?.violation_count||0) + 1
    const penaltyLevel = Math.min(currentCount, 3)
    const penalty = PENALTY_RULES[penaltyLevel]
    const { data: violation, error: vErr } = await supabase.from("user_violations").insert({
      user_id: form.user_id, role: form.role||profile?.role,
      violation_type: form.violation_type, description: form.description,
    }).select().single()
    if (vErr) return toast.error(vErr.message)
    const suspExpiry = penalty.type==="suspension" ? new Date(Date.now()+suspendHours*3600000).toISOString() : null
    await supabase.from("user_penalties").insert({
      user_id: form.user_id, role: form.role||profile?.role,
      penalty_level: penaltyLevel, penalty_type: penalty.type,
      reason: form.description, violation_id: violation.id,
      suspension_hours: penalty.type==="suspension"?suspendHours:null,
      suspension_expires_at: suspExpiry, is_active: true,
    })
    await supabase.from("profiles").update({
      violation_count: currentCount,
      is_suspended: penalty.type==="suspension",
      is_banned: penalty.type==="permanent_ban",
      suspension_expires_at: suspExpiry,
      warning_count: penalty.type==="warning"?(profile?.warning_count||0)+1:profile?.warning_count||0,
    }).eq("id", form.user_id)
    if ((form.role||profile?.role)==="driver") {
      await supabase.from("driver_status").upsert({
        driver_id: form.user_id,
        is_suspended: penalty.type==="suspension"||penalty.type==="permanent_ban",
        suspension_expires_at: suspExpiry,
      }, { onConflict:"driver_id" })
    }
    await supabase.from("notifications").insert({
      user_id: form.user_id,
      title: `Account ${penalty.label}`,
      message: penalty.type==="warning"
        ? `Warning issued: ${form.description}. Further violations will result in suspension.`
        : penalty.type==="suspension"
        ? `Your account has been suspended for ${suspendHours} hours: ${form.description}`
        : `Your account has been permanently banned: ${form.description}. Contact support to appeal.`,
      type: penalty.type==="warning"?"warning":"error",
    })
    toast.success(`${penalty.label} issued!`)
    setShowForm(false)
    setForm({ user_id:"", role:"", violation_type:"no_show", description:"" })
    setSelectedUser(null)
    setSearch("")
    load()
  }

  async function removeRestriction(userId, userName) {
    if (!confirm(`Remove all restrictions from ${userName}?`)) return
    await supabase.from("profiles").update({ is_suspended:false, is_banned:false, suspension_expires_at:null }).eq("id", userId)
    await supabase.from("driver_status").update({ is_suspended:false, suspension_expires_at:null }).eq("driver_id", userId)
    await supabase.from("user_penalties").update({ is_active:false }).eq("user_id", userId).eq("is_active", true)
    await supabase.from("notifications").insert({
      user_id: userId, title:"Account restriction removed",
      message:"Your account restriction has been lifted. You can now use the platform normally.", type:"success",
    })
    toast.success("Restriction removed")
    load()
  }

  const activePenalties = penalties.filter(p=>p.is_active)
  const suspendedUsers = users.filter(u=>u.is_suspended||u.is_banned)
  const recentViolations = violations.slice(0,5)

  const inp = { width:"100%", border:"1px solid #e5e5e5", borderRadius:10, padding:"10px 12px", fontSize:13, outline:"none", fontFamily:"DM Sans,sans-serif", background:"#fafafa" }

  return (
    <div style={{ fontFamily:"DM Sans,sans-serif" }}>
      {/* Header */}
      <div style={{ background:"#e24b4a", borderRadius:16, padding:"1.5rem", marginBottom:"1.5rem", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div>
          <div style={{ fontFamily:"Syne", fontSize:22, fontWeight:800, color:"#fff" }}>Penalties & Violations</div>
          <div style={{ fontSize:13, color:"rgba(255,255,255,0.8)", marginTop:2 }}>Manage user violations and enforce platform policies</div>
        </div>
        <button onClick={()=>setShowForm(!showForm)}
          style={{ background:"#fff", border:"none", borderRadius:10, color:"#e24b4a", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"10px 20px", cursor:"pointer" }}>
          {showForm?"✕ Cancel":"+ Issue Violation"}
        </button>
      </div>

      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:"1.5rem" }}>
        {[
          { label:"Total violations", value:violations.length, color:"#e6821e", icon:"⚠️", bg:"#fff8f0" },
          { label:"Active penalties", value:activePenalties.length, color:"#e24b4a", icon:"🚫", bg:"#fff5f5" },
          { label:"Suspended", value:suspendedUsers.filter(u=>u.is_suspended&&!u.is_banned).length, color:"#378add", icon:"⏸️", bg:"#eff6ff" },
          { label:"Banned", value:suspendedUsers.filter(u=>u.is_banned).length, color:"#e24b4a", icon:"❌", bg:"#fff5f5" },
        ].map(s=>(
          <div key={s.label} style={{ background:s.bg, border:`1px solid ${s.color}20`, borderRadius:14, padding:"1rem" }}>
            <div style={{ fontSize:28, marginBottom:6 }}>{s.icon}</div>
            <div style={{ fontFamily:"Syne", fontSize:26, fontWeight:800, color:s.color }}>{s.value}</div>
            <div style={{ fontSize:12, color:"#888", marginTop:2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Issue violation form */}
      {showForm&&(
        <div style={{ background:"#fff", border:"2px solid #e24b4a20", borderRadius:16, padding:"1.5rem", marginBottom:"1.5rem", boxShadow:"0 4px 20px rgba(226,75,74,0.08)" }}>
          <div style={{ fontFamily:"Syne", fontSize:16, fontWeight:800, marginBottom:"1.25rem", display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ background:"#e24b4a", color:"#fff", borderRadius:8, padding:"4px 10px", fontSize:13 }}>New Violation</span>
            <span style={{ color:"#888", fontSize:13, fontWeight:400 }}>System will auto-assign penalty based on violation count</span>
          </div>

          {/* User search */}
          <div style={{ marginBottom:14, position:"relative" }}>
            <label style={{ fontSize:12, color:"#888", display:"block", marginBottom:4, fontWeight:600 }}>Search & Select User *</label>
            <input value={search} onChange={e=>{ setSearch(e.target.value); if(!e.target.value){setSelectedUser(null);setForm(f=>({...f,user_id:"",role:""}))}} }
              placeholder="Type name or role to search..."
              style={{ ...inp, border:selectedUser?"1px solid #1d9e75":"1px solid #e5e5e5" }}/>
            {selectedUser&&(
              <div style={{ position:"absolute", right:10, top:32, color:"#1d9e75", fontSize:13 }}>✓ Selected</div>
            )}
            {searchResults.length>0&&!selectedUser&&(
              <div style={{ position:"absolute", top:"100%", left:0, right:0, background:"#fff", border:"1px solid #eee", borderRadius:10, boxShadow:"0 8px 24px rgba(0,0,0,0.1)", zIndex:10, overflow:"hidden" }}>
                {searchResults.map(u=>(
                  <div key={u.id} onClick={()=>{ setSelectedUser(u); setForm(f=>({...f,user_id:u.id,role:u.role})); setSearch(`${u.first_name} ${u.last_name}`); setSearchResults([]) }}
                    style={{ padding:"10px 14px", cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"center", borderBottom:"1px solid #f5f5f5" }}
                    onMouseEnter={e=>e.currentTarget.style.background="#f8f8f8"}
                    onMouseLeave={e=>e.currentTarget.style.background="#fff"}>
                    <div>
                      <div style={{ fontSize:13, fontWeight:600, color:"#000" }}>{u.first_name} {u.last_name}</div>
                      <div style={{ fontSize:11, color:"#888" }}>{u.violation_count||0} violations · {u.warning_count||0} warnings</div>
                    </div>
                    <Badge label={u.role} color={ROLE_COLORS[u.role]||"#888"}/>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Selected user preview */}
          {selectedUser&&(
            <div style={{ background:"#f8f8f8", borderRadius:10, padding:"0.85rem 1rem", marginBottom:14, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <div style={{ width:36, height:36, borderRadius:8, background:ROLE_COLORS[selectedUser.role]||"#e6821e", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontFamily:"Syne", fontWeight:800, fontSize:14 }}>
                  {selectedUser.first_name[0]}{selectedUser.last_name[0]}
                </div>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:"#000" }}>{selectedUser.first_name} {selectedUser.last_name}</div>
                  <div style={{ fontSize:11, color:"#888" }}>{selectedUser.role} · {selectedUser.violation_count||0} past violations</div>
                </div>
              </div>
              {(() => {
                const count = (selectedUser.violation_count||0) + 1
                const level = Math.min(count, 3)
                const p = PENALTY_RULES[level]
                return (
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontSize:11, color:"#888", marginBottom:2 }}>This violation will trigger:</div>
                    <Badge label={p.label} color={p.color} icon={p.icon} bg={p.bg}/>
                  </div>
                )
              })()}
            </div>
          )}

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:14 }}>
            <div>
              <label style={{ fontSize:12, color:"#888", display:"block", marginBottom:4, fontWeight:600 }}>Violation Type *</label>
              <select value={form.violation_type} onChange={e=>setForm(f=>({...f,violation_type:e.target.value}))} style={inp}>
                {VIOLATION_TYPES.map(v=>(<option key={v.key} value={v.key}>{v.icon} {v.label}</option>))}
              </select>
            </div>
            <div>
              <label style={{ fontSize:12, color:"#888", display:"block", marginBottom:4, fontWeight:600 }}>Suspension duration (if 2nd offense)</label>
              <select value={suspendHours} onChange={e=>setSuspendHours(Number(e.target.value))} style={inp}>
                <option value={24}>24 hours</option>
                <option value={48}>48 hours</option>
                <option value={72}>72 hours (3 days)</option>
                <option value={168}>7 days</option>
                <option value={336}>14 days</option>
                <option value={720}>30 days</option>
              </select>
            </div>
          </div>

          <div style={{ marginBottom:16 }}>
            <label style={{ fontSize:12, color:"#888", display:"block", marginBottom:4, fontWeight:600 }}>Description / Evidence *</label>
            <textarea value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))}
              placeholder="Describe the violation clearly. This will be sent to the user and kept on record..."
              style={{ ...inp, height:80, resize:"vertical" }}/>
          </div>

          <div style={{ display:"flex", gap:10 }}>
            <button onClick={submitViolation}
              style={{ background:"#e24b4a", border:"none", borderRadius:10, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"11px 24px", cursor:"pointer" }}>
              Issue Violation & Apply Penalty
            </button>
            <button onClick={()=>{ setShowForm(false); setSearch(""); setSelectedUser(null) }}
              style={{ background:"#f5f5f5", border:"none", borderRadius:10, color:"#555", fontSize:13, padding:"11px 18px", cursor:"pointer" }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display:"flex", gap:8, marginBottom:"1.25rem" }}>
        {[
          { k:"overview", l:"Overview" },
          { k:"violations", l:`Violations (${violations.length})` },
          { k:"penalties", l:`Active Penalties (${activePenalties.length})` },
          { k:"restricted", l:`Restricted Users (${suspendedUsers.length})` },
        ].map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k)}
            style={{ padding:"8px 18px", borderRadius:20, border:"none", fontSize:12, cursor:"pointer", background:tab===t.k?"#e24b4a":"#f0f0f0", color:tab===t.k?"#fff":"#555", fontWeight:tab===t.k?700:400 }}>
            {t.l}
          </button>
        ))}
      </div>

      {loading&&<div style={{ color:"#888", fontSize:13, textAlign:"center", padding:"2rem" }}>Loading...</div>}

      {/* OVERVIEW TAB */}
      {tab==="overview"&&!loading&&(
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
          {/* Recent violations */}
          <div style={{ background:"#fff", border:"1px solid #eee", borderRadius:14, padding:"1rem" }}>
            <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:800, marginBottom:"1rem", display:"flex", justifyContent:"space-between" }}>
              Recent Violations
              <button onClick={()=>setTab("violations")} style={{ background:"none", border:"none", color:"#e6821e", fontSize:12, cursor:"pointer" }}>View all →</button>
            </div>
            {recentViolations.length===0&&<div style={{ color:"#888", fontSize:13, textAlign:"center", padding:"1rem" }}>No violations yet</div>}
            {recentViolations.map(v=>(
              <div key={v.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:"0.5px solid #f5f5f5" }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:500 }}>{v.profiles?.first_name} {v.profiles?.last_name}</div>
                  <div style={{ fontSize:11, color:"#888" }}>{new Date(v.created_at).toLocaleDateString("en-KE")}</div>
                </div>
                <Badge label={VIOLATION_TYPES.find(x=>x.key===v.violation_type)?.label||v.violation_type} color={VIOLATION_TYPES.find(x=>x.key===v.violation_type)?.color||"#888"}/>
              </div>
            ))}
          </div>

          {/* Policy reminder */}
          <div style={{ background:"#fff", border:"1px solid #eee", borderRadius:14, padding:"1rem" }}>
            <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:800, marginBottom:"1rem" }}>Penalty Policy</div>
            {Object.entries(PENALTY_RULES).map(([level,p])=>(
              <div key={level} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 0", borderBottom:"0.5px solid #f5f5f5" }}>
                <div style={{ width:28, height:28, borderRadius:8, background:p.bg, border:`1px solid ${p.color}30`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, flexShrink:0 }}>{p.icon}</div>
                <div>
                  <div style={{ fontSize:12, fontWeight:600, color:p.color }}>{level === "1"?"1st violation":level==="2"?"2nd violation":"3rd+ violation"} → {p.label}</div>
                  <div style={{ fontSize:11, color:"#888" }}>
                    {p.type==="warning"?"Notification sent to user":p.type==="suspension"?"Account temporarily disabled":"Permanent platform ban"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VIOLATIONS TAB */}
      {tab==="violations"&&!loading&&(
        <div>
          {violations.length===0&&<div style={{ color:"#888", textAlign:"center", padding:"2rem", background:"#f8f8f8", borderRadius:12 }}>No violations recorded yet</div>}
          {violations.map(v=>(
            <div key={v.id} style={{ background:"#fff", border:"1px solid #eee", borderRadius:12, padding:"1rem", marginBottom:8 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                <div style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
                  <div style={{ width:36, height:36, borderRadius:8, background:ROLE_COLORS[v.profiles?.role]+"20", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0 }}>
                    {VIOLATION_TYPES.find(x=>x.key===v.violation_type)?.icon||"⚠️"}
                  </div>
                  <div>
                    <div style={{ fontSize:13, fontWeight:600, color:"#000" }}>
                      {v.profiles?.first_name} {v.profiles?.last_name}
                      <span style={{ marginLeft:8 }}><Badge label={v.profiles?.role||""} color={ROLE_COLORS[v.profiles?.role]||"#888"}/></span>
                    </div>
                    <div style={{ fontSize:12, color:"#555", marginTop:2 }}>{v.description}</div>
                    <div style={{ fontSize:11, color:"#aaa", marginTop:2 }}>{new Date(v.created_at).toLocaleString("en-KE")}</div>
                  </div>
                </div>
                <Badge label={VIOLATION_TYPES.find(x=>x.key===v.violation_type)?.label||v.violation_type} color={VIOLATION_TYPES.find(x=>x.key===v.violation_type)?.color||"#888"}/>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* PENALTIES TAB */}
      {tab==="penalties"&&!loading&&(
        <div>
          {activePenalties.length===0&&<div style={{ color:"#888", textAlign:"center", padding:"2rem", background:"#f8f8f8", borderRadius:12 }}>No active penalties</div>}
          {activePenalties.map(p=>(
            <div key={p.id} style={{ background:"#fff", border:`1px solid ${PENALTY_RULES[p.penalty_level]?.color||"#eee"}20`, borderRadius:12, padding:"1rem", marginBottom:8 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                <div style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
                  <div style={{ width:36, height:36, borderRadius:8, background:PENALTY_RULES[p.penalty_level]?.bg||"#f5f5f5", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>
                    {PENALTY_RULES[p.penalty_level]?.icon||"⚠️"}
                  </div>
                  <div>
                    <div style={{ fontSize:13, fontWeight:600, color:"#000" }}>
                      {p.profiles?.first_name} {p.profiles?.last_name}
                      <span style={{ marginLeft:8 }}><Badge label={p.profiles?.role||""} color={ROLE_COLORS[p.profiles?.role]||"#888"}/></span>
                    </div>
                    <div style={{ fontSize:12, color:"#555", marginTop:2 }}>{p.reason}</div>
                    {p.suspension_expires_at&&(
                      <div style={{ fontSize:11, color:"#378add", marginTop:2 }}>
                        Expires: {new Date(p.suspension_expires_at).toLocaleString("en-KE")}
                      </div>
                    )}
                    <div style={{ fontSize:11, color:"#aaa", marginTop:2 }}>{new Date(p.created_at).toLocaleString("en-KE")}</div>
                  </div>
                </div>
                <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:8 }}>
                  <Badge label={p.penalty_type?.replace("_"," ").toUpperCase()} color={PENALTY_RULES[p.penalty_level]?.color||"#888"} bg={PENALTY_RULES[p.penalty_level]?.bg}/>
                  <button onClick={()=>removeRestriction(p.user_id, `${p.profiles?.first_name} ${p.profiles?.last_name}`)}
                    style={{ background:"#f0fdf4", border:"1px solid #1d9e7540", borderRadius:8, color:"#1d9e75", fontSize:11, padding:"5px 12px", cursor:"pointer", fontWeight:600 }}>
                    Lift restriction
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* RESTRICTED USERS TAB */}
      {tab==="restricted"&&!loading&&(
        <div>
          {suspendedUsers.length===0&&<div style={{ color:"#888", textAlign:"center", padding:"2rem", background:"#f8f8f8", borderRadius:12 }}>No restricted users</div>}
          {suspendedUsers.map(u=>(
            <div key={u.id} style={{ background:"#fff", border:`1px solid ${u.is_banned?"#e24b4a":"#378add"}20`, borderRadius:12, padding:"1rem", marginBottom:8 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                  <div style={{ width:44, height:44, borderRadius:10, background:u.is_banned?"#fff5f5":"#eff6ff", border:`1px solid ${u.is_banned?"#e24b4a":"#378add"}30`, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"Syne", fontWeight:800, fontSize:16, color:u.is_banned?"#e24b4a":"#378add" }}>
                    {u.first_name?.[0]}{u.last_name?.[0]}
                  </div>
                  <div>
                    <div style={{ fontSize:14, fontWeight:600, color:"#000" }}>{u.first_name} {u.last_name}</div>
                    <div style={{ display:"flex", gap:6, marginTop:4, flexWrap:"wrap" }}>
                      <Badge label={u.role} color={ROLE_COLORS[u.role]||"#888"}/>
                      <span style={{ fontSize:11, color:"#888" }}>⚠️ {u.violation_count||0} violations</span>
                      <span style={{ fontSize:11, color:"#888" }}>🔔 {u.warning_count||0} warnings</span>
                    </div>
                    {u.suspension_expires_at&&(
                      <div style={{ fontSize:11, color:"#378add", marginTop:4 }}>
                        Suspended until: {new Date(u.suspension_expires_at).toLocaleString("en-KE")}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:8 }}>
                  <Badge label={u.is_banned?"BANNED":"SUSPENDED"} color={u.is_banned?"#e24b4a":"#378add"} bg={u.is_banned?"#fff5f5":"#eff6ff"}/>
                  <button onClick={()=>removeRestriction(u.id, `${u.first_name} ${u.last_name}`)}
                    style={{ background:"#f0fdf4", border:"1px solid #1d9e7540", borderRadius:8, color:"#1d9e75", fontSize:11, padding:"5px 12px", cursor:"pointer", fontWeight:600 }}>
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
