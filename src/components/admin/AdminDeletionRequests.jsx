import { RefreshIcon, DeleteIcon, WarningIcon } from "../../lib/cccIcons"
import { useState, useEffect } from "react"
import { useAuth } from "../../contexts/AuthContext"
import { supabase } from "../../lib/supabase"
import toast from "react-hot-toast"

export default function AdminDeletionRequests() {
  const { user, profile } = useAuth()
  if (!user || profile?.role !== "admin") return null
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState("pending")

  useEffect(() => { load() }, [filter])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from("deletion_requests")
      .select("*, profiles(first_name, last_name, role, marketplace_rating)")
      .eq("status", filter)
      .order("scheduled_for", { ascending: true })
    setRequests(data||[])
    setLoading(false)
  }

  async function cancelDeletion(id, userId) {
    if(!window.confirm("Cancel this deletion request? The user will be notified.")) return
    try {
      await supabase.from("deletion_requests").update({ status:"cancelled" }).eq("id", id)
      await supabase.from("notifications").insert({
        user_id: userId,
        type: "account_deletion",
        title: "Account deletion cancelled ✅",
        message: "Your account deletion request has been cancelled by our team. Your account is safe.",
      })
      toast.success("Deletion cancelled and user notified")
      load()
    } catch(e) { toast.error(e.message) }
  }

  async function processDeletion(id, userId) {
    if(!window.confirm("Permanently delete this account? This CANNOT be undone.")) return
    try {
      // Anonymize profile data
      await supabase.from("profiles").update({
        first_name: "Deleted",
        last_name: "User",
        city: null,
        avatar_url: null,
        business_name: null,
        latitude: null,
        longitude: null,
      }).eq("id", userId)
      // Delete sensitive data
      await supabase.from("profile_sensitive").delete().eq("id", userId)
      // Mark deletion as completed
      await supabase.from("deletion_requests").update({ status:"completed" }).eq("id", id)
      toast.success("Account data deleted successfully")
      load()
    } catch(e) { toast.error(e.message) }
  }

  const STATUS_COLORS = {
    pending: { bg:"#fff8f0", color:"#e6821e", label:"Pending" },
    processing: { bg:"#eff6ff", color:"#378add", label:"Processing" },
    completed: { bg:"#f0fdf4", color:"#1d9e75", label:"Completed" },
    cancelled: { bg:"#f5f5f5", color:"#888", label:"Cancelled" },
  }

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1rem" }}>
        <div>
          <div style={{ fontFamily:"Syne", fontSize:20, fontWeight:800 }}>Account Deletion Requests</div>
          <div style={{ fontSize:12, color:"#888" }}>Manage user account deletion requests</div>
        </div>
        <button onClick={load} style={{ padding:"6px 14px", borderRadius:8, border:"0.5px solid #ddd", background:"#f5f5f5", fontSize:12, cursor:"pointer" }}>
          <><RefreshIcon size={13} color="currentColor"/> Refresh</>
        </button>
      </div>

      {/* Filter tabs */}
      <div style={{ display:"flex", gap:6, marginBottom:"1rem" }}>
        {["pending","processing","completed","cancelled"].map(s=>(
          <button key={s} onClick={()=>setFilter(s)}
            style={{ padding:"6px 14px", borderRadius:8, border:"0.5px solid "+(filter===s?"#e6821e":"#ddd"), background:filter===s?"#e6821e":"#fff", color:filter===s?"#fff":"#555", fontSize:12, cursor:"pointer", textTransform:"capitalize" }}>
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign:"center", padding:"3rem", color:"#888" }}>Loading...</div>
      ) : requests.length === 0 ? (
        <div style={{ textAlign:"center", padding:"3rem", color:"#888" }}>
          <div style={{ fontSize:48, marginBottom:12 }}>✅</div>
          <div style={{ fontWeight:600 }}>No {filter} deletion requests</div>
        </div>
      ) : (
        <div>
          {requests.map(r => {
            const s = STATUS_COLORS[r.status] || STATUS_COLORS.pending
            const hoursLeft = Math.ceil((new Date(r.scheduled_for) - new Date()) / 3600000)
            const isOverdue = hoursLeft < 0
            return (
              <div key={r.id} style={{ background:"#fff", border:"0.5px solid "+(isOverdue?"#e24b4a":"#eee"), borderRadius:12, padding:"1rem", marginBottom:10 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                  <div>
                    <div style={{ fontFamily:"Syne", fontSize:15, fontWeight:700 }}>
                      {r.profiles?.first_name} {r.profiles?.last_name}
                      <span style={{ marginLeft:8, fontSize:11, padding:"2px 8px", borderRadius:8, background:"#f5f5f5", color:"#888" }}>{r.profiles?.role}</span>
                    </div>
                    <div style={{ fontSize:12, color:"#888", marginTop:2 }}>ID: {r.user_id?.slice(0,8)}...</div>
                  </div>
                  <span style={{ fontSize:11, padding:"3px 10px", borderRadius:8, background:s.bg, color:s.color, fontWeight:600 }}>{s.label}</span>
                </div>

                <div style={{ display:"flex", gap:16, fontSize:12, color:"#888", marginBottom:12 }}>
                  <span>Requested: {new Date(r.requested_at).toLocaleString()}</span>
                  <span style={{ color:isOverdue?"#e24b4a":"#555" }}>
                    Due: {new Date(r.scheduled_for).toLocaleString()}
                    {r.status==="pending" && (isOverdue ? " ⚠️ OVERDUE" : " ("+hoursLeft+"h left)")}
                  </span>
                </div>

                {r.reason && <div style={{ fontSize:12, color:"#555", background:"#f9f9f9", padding:"6px 10px", borderRadius:6, marginBottom:10 }}>{r.reason}</div>}

                {r.status==="pending"&&(
                  <div style={{ display:"flex", gap:8 }}>
                    <button onClick={()=>processDeletion(r.id, r.user_id)}
                      style={{ background:"#e24b4a", border:"none", borderRadius:8, color:"#fff", fontSize:12, fontWeight:600, padding:"8px 16px", cursor:"pointer" }}>
                      <><DeleteIcon size={13} color="currentColor"/> Delete Account</>
                    </button>
                    <button onClick={()=>cancelDeletion(r.id, r.user_id)}
                      style={{ background:"#f0fdf4", border:"1px solid #1d9e7540", borderRadius:8, color:"#1d9e75", fontSize:12, fontWeight:600, padding:"8px 16px", cursor:"pointer" }}>
                      ✓ Cancel Request
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
