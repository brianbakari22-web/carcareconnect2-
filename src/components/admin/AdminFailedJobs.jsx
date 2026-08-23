import { WarningIcon, RefreshIcon, DeleteIcon } from "../../lib/cccIcons"
import { useAuth } from "../../contexts/AuthContext"
import { useState, useEffect } from "react"
import { supabase } from "../../lib/supabase"
import toast from "react-hot-toast"

export default function AdminFailedJobs() {
  const { user, profile } = useAuth()
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState("failed")
  if (!user || profile?.role !== "admin") return null

  useEffect(() => { load() }, [filter])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from("failed_jobs")
      .select("*")
      .eq("status", filter)
      .order("created_at", { ascending: false })
      .limit(50)
    setJobs(data||[])
    setLoading(false)
  }

  async function resolve(id) {
    await supabase.from("failed_jobs").update({ status:"resolved", resolved_at: new Date().toISOString() }).eq("id", id)
    toast.success("Marked as resolved")
    load()
  }

  async function retry(job) {
    await supabase.from("failed_jobs").update({ retry_count: (job.retry_count||0)+1 }).eq("id", job.id)
    toast.success("Retry logged — manually trigger the action")
    load()
  }

  const TYPE_COLORS = {
    payment_callback: "#e24b4a",
    b2c_payout: "#e6821e",
    email: "#378add",
    notification: "#1d9e75",
  }

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1rem" }}>
        <div>
          <div style={{ fontFamily:"Syne", fontSize:20, fontWeight:800, display:"flex", alignItems:"center", gap:8 }}><WarningIcon size={20} color="#e24b4a"/> Failed Jobs</div>
          <div style={{ fontSize:12, color:"#888" }}>Monitor and resolve failed background operations</div>
        </div>
        <div style={{ display:"flex", gap:6 }}>
          {["failed","resolved"].map(s=>(
            <button key={s} onClick={()=>setFilter(s)}
              style={{ padding:"6px 14px", borderRadius:8, border:"0.5px solid "+(filter===s?"#e6821e":"#ddd"), background:filter===s?"#e6821e":"#fff", color:filter===s?"#fff":"#555", fontSize:12, cursor:"pointer", fontWeight:filter===s?600:400, textTransform:"capitalize" }}>
              {s}
            </button>
          ))}
          <button onClick={load} style={{ padding:"6px 14px", borderRadius:8, border:"0.5px solid #ddd", background:"#f5f5f5", fontSize:12, cursor:"pointer" }}>
            <><RefreshIcon size={13} color="currentColor"/> Refresh</>
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign:"center", padding:"3rem", color:"#888" }}>Loading...</div>
      ) : jobs.length === 0 ? (
        <div style={{ textAlign:"center", padding:"3rem", color:"#888" }}>
          <div style={{ fontSize:48, marginBottom:12 }}>✅</div>
          <div style={{ fontWeight:600 }}>No {filter} jobs</div>
          <div style={{ fontSize:13, marginTop:4 }}>All background operations are running smoothly</div>
        </div>
      ) : (
        <div>
          {jobs.map(job=>(
            <div key={job.id} style={{ background:"#fff", border:"0.5px solid #eee", borderRadius:12, padding:"1rem", marginBottom:10 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ fontSize:10, padding:"2px 8px", borderRadius:8, background:TYPE_COLORS[job.job_type]+"20", color:TYPE_COLORS[job.job_type]||"#555", fontWeight:600 }}>
                    {job.job_type}
                  </span>
                  <span style={{ fontSize:11, color:"#888" }}>{new Date(job.created_at).toLocaleString()}</span>
                  {job.retry_count > 0 && <span style={{ fontSize:10, color:"#e6821e" }}>Retry #{job.retry_count}</span>}
                </div>
                {filter==="failed" && (
                  <div style={{ display:"flex", gap:6 }}>
                    <button onClick={()=>retry(job)}
                      style={{ padding:"4px 10px", borderRadius:6, border:"0.5px solid #378add", background:"#eff6ff", color:"#378add", fontSize:11, cursor:"pointer" }}>
                      <><RefreshIcon size={13} color="currentColor"/> Retry</>
                    </button>
                    <button onClick={()=>resolve(job.id)}
                      style={{ padding:"4px 10px", borderRadius:6, border:"0.5px solid #1d9e75", background:"#f0fdf4", color:"#1d9e75", fontSize:11, cursor:"pointer" }}>
                      ✓ Resolve
                    </button>
                  </div>
                )}
              </div>
              <div style={{ fontSize:12, color:"#e24b4a", marginBottom:6, background:"#fff5f5", padding:"6px 10px", borderRadius:6 }}>
                {job.error_message}
              </div>
              {job.payload && (
                <div style={{ fontSize:11, color:"#888", fontFamily:"monospace", background:"#f9f9f9", padding:"6px 10px", borderRadius:6, overflowX:"auto" }}>
                  {JSON.stringify(job.payload, null, 2)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
