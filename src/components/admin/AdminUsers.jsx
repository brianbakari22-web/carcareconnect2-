import useIsMobile from "../../lib/useIsMobile"
import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import AdminUserDetail from "./AdminUserDetail"
import toast from "react-hot-toast"

export default function AdminUsers() {
  const isMobile = useIsMobile()
  const [users, setUsers] = useState([])
  const [filter, setFilter] = useState("all")
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [viewingUser, setViewingUser] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from("profiles")
      .select("*").order("created_at",{ascending:false})
    setUsers(data||[])
    setLoading(false)
  }

  async function toggleActive(id, is_active) {
    await supabase.from("profiles").update({ is_active:!is_active }).eq("id",id)
    toast.success(is_active?"User suspended":"User activated")
    load()
  }

  async function toggleVerified(id, is_verified) {
    await supabase.from("profiles").update({ is_verified:!is_verified }).eq("id",id)
    toast.success(is_verified?"Verification removed":"User verified")
    load()
  }

  async function deleteUser(id, name) {
    if (!confirm(`Delete ${name}? This cannot be undone.`)) return
    const { error } = await supabase.from("profiles").delete().eq("id",id)
    if (error) return toast.error(error.message)
    toast.success("User deleted")
    setSelected(null)
    load()
  }

  async function resetPassword(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth`
    })
    if (error) return toast.error(error.message)
    toast.success(`Password reset email sent to ${email}`)
  }

  const RC = { customer:"#e6821e", provider:"#378add", driver:"#1d9e75", admin:"#8b5cf6" }

  const filtered = users.filter(u => {
    const matchRole = filter==="all" || u.role===filter
    const matchSearch = `${u.first_name} ${u.last_name} ${u.email||""} ${u.city||""}`.toLowerCase().includes(search.toLowerCase())
    return matchRole && matchSearch
  })

  if (viewingUser) return <AdminUserDetail userId={viewingUser} onBack={()=>setViewingUser(null)} />

  return (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(4,1fr)", gap:10, marginBottom:"1.5rem" }}>
        {["customer","provider","driver","admin"].map(r=>(
          <div key={r} style={{ background:"#111", borderRadius:10, padding:"0.9rem", border:"1px solid #1e1e1e" }}>
            <div style={{ fontSize:10, color:"#555", textTransform:"uppercase", marginBottom:4 }}>{r}s</div>
            <div style={{ fontFamily:"Syne", fontSize:20, fontWeight:800, color:RC[r] }}>{users.filter(u=>u.role===r).length}</div>
          </div>
        ))}
      </div>

      <div style={{ display:"flex", gap:8, marginBottom:"1rem", flexWrap:"wrap" }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, email, city..."
          style={{ flex:1, minWidth:180, background:"#111", border:"1px solid #222", borderRadius:8, padding:"9px 12px", color:"#f0ede6", fontSize:13, outline:"none", fontFamily:"'DM Sans',sans-serif" }}/>
        {["all","customer","provider","driver","admin"].map(r=>(
          <button key={r} onClick={()=>setFilter(r)}
            style={{ padding:"8px 14px", borderRadius:7, border:"none", fontSize:12, cursor:"pointer", background:filter===r?"#e6821e":"#111", color:filter===r?"#fff":"#666", fontFamily:"'DM Sans',sans-serif" }}>
            {r.charAt(0).toUpperCase()+r.slice(1)}
          </button>
        ))}
      </div>

      <div style={{ fontSize:12, color:"#555", marginBottom:10 }}>{filtered.length} user{filtered.length!==1?"s":""}</div>

      {loading&&<div style={{ color:"#555", fontSize:13 }}>Loading...</div>}
      {filtered.map(u=>(
        <div key={u.id} style={{ background:"#111", border:`1px solid ${!u.is_active?"#e24b4a20":"#1e1e1e"}`, borderRadius:10, padding:"1rem", marginBottom:8 }}>
          <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:selected===u.id?10:0 }}>
            <div style={{ width:40, height:40, borderRadius:"50%", background:`${RC[u.role]}20`, border:`1px solid ${RC[u.role]}40`, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"Syne", fontSize:14, fontWeight:800, color:RC[u.role], flexShrink:0 }}>
              {u.first_name?.[0]}{u.last_name?.[0]}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
                <div style={{ fontSize:13, fontWeight:500, color:u.is_active?"#f0ede6":"#555" }}>{u.first_name} {u.last_name}</div>
                {u.business_name&&<div style={{ fontSize:11, color:"#666" }}>· {u.business_name}</div>}
                <span style={{ fontSize:10, padding:"1px 7px", borderRadius:10, background:`${RC[u.role]}20`, color:RC[u.role] }}>{u.role}</span>
                {u.is_verified&&<span style={{ fontSize:10, color:"#1d9e75" }}>✓</span>}
                {!u.is_active&&<span style={{ fontSize:10, color:"#e24b4a", background:"#1a0808", padding:"1px 7px", borderRadius:10 }}>Suspended</span>}
              </div>
              <div style={{ fontSize:11, color:"#444", marginTop:2 }}>
                {u.city&&`${u.city} · `}Joined {new Date(u.created_at).toLocaleDateString()}
              </div>
            </div>
            <div style={{ display:"flex", gap:6, flexShrink:0 }}>
              <button onClick={()=>setViewingUser(u.id)}
                style={{ background:"#160a2e", border:"1px solid #8b5cf640", borderRadius:7, color:"#8b5cf6", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>
                View detail
              </button>
              <button onClick={()=>setSelected(selected===u.id?null:u.id)}
                style={{ background:"none", border:"1px solid #333", borderRadius:7, color:"#666", fontSize:11, padding:"5px 10px", cursor:"pointer", flexShrink:0 }}>
                {selected===u.id?"Close":"Manage"}
              </button>
            </div>
          </div>

          {selected===u.id&&(
            <div style={{ borderTop:"1px solid #1e1e1e", paddingTop:10, display:"flex", gap:8, flexWrap:"wrap" }}>
              <button onClick={()=>toggleVerified(u.id, u.is_verified)}
                style={{ background:"#071a12", border:"1px solid #1d9e7540", borderRadius:7, color:"#1d9e75", fontSize:12, padding:"6px 12px", cursor:"pointer" }}>
                {u.is_verified?"Remove verification":"✓ Verify"}
              </button>
              <button onClick={()=>toggleActive(u.id, u.is_active)}
                style={{ background:u.is_active?"#1a0808":"#071a12", border:`1px solid ${u.is_active?"#e24b4a40":"#1d9e7540"}`, borderRadius:7, color:u.is_active?"#e24b4a":"#1d9e75", fontSize:12, padding:"6px 12px", cursor:"pointer" }}>
                {u.is_active?"Suspend":"Activate"}
              </button>
              <button onClick={()=>resetPassword(u.email)}
                style={{ background:"#0c1f2e", border:"1px solid #378add40", borderRadius:7, color:"#378add", fontSize:12, padding:"6px 12px", cursor:"pointer" }}>
                Reset password
              </button>
              <button onClick={()=>deleteUser(u.id, `${u.first_name} ${u.last_name}`)}
                style={{ background:"none", border:"1px solid #e24b4a40", borderRadius:7, color:"#e24b4a", fontSize:12, padding:"6px 12px", cursor:"pointer" }}>
                Delete user
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}


