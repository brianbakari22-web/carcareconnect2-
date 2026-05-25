import useIsMobile from "../../lib/useIsMobile"
import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import toast from "react-hot-toast"

export default function AdminLoyalty() {
  const isMobile = useIsMobile()
  const [loyalty, setLoyalty] = useState([])
  const [loading, setLoading] = useState(true)
  const [adjusting, setAdjusting] = useState(null)
  const [adjustForm, setAdjustForm] = useState({ points:"", reason:"" })

  useEffect(() => { load() }, [])

  async function load() {
    const { data: lp } = await supabase.from("loyalty_points")
      .select("*, profile_public(first_name,last_name,business_name,role)")
      .order("points",{ascending:false})
    setLoyalty(lp||[])
    setLoading(false)
  }

  async function adjustPoints(e) {
    e.preventDefault()
    const pts = parseInt(adjustForm.points)
    if (isNaN(pts)) return toast.error("Enter a valid number")
    const current = loyalty.find(l=>l.user_id===adjusting)
    const newPoints = Math.max(0, (current?.points||0) + pts)
    const newLifetime = pts > 0 ? (current?.lifetime_points||0) + pts : current?.lifetime_points||0
    const { error } = await supabase.from("loyalty_points").upsert({
      user_id: adjusting,
      points: newPoints,
      lifetime_points: newLifetime
    })
    if (error) return toast.error(error.message)
    await supabase.from("notifications").insert({
      user_id: adjusting,
      title: pts>0?"Loyalty points added":"Loyalty points deducted",
      message: `${Math.abs(pts)} points ${pts>0?"added to":"deducted from"} your account. ${adjustForm.reason?`Reason: ${adjustForm.reason}`:""}`,
      type: pts>0?"success":"info"
    })
    toast.success(`Points ${pts>0?"added":"deducted"} successfully`)
    setAdjusting(null)
    setAdjustForm({ points:"", reason:"" })
    load()
  }

  function getTier(points) {
    if (points>=10000) return { name:"Platinum", color:"#d4537e" }
    if (points>=5000) return { name:"Gold", color:"#e6821e" }
    if (points>=1000) return { name:"Silver", color:"#aaa" }
    return { name:"Bronze", color:"#cd7f32" }
  }

  const inp = { width:"100%", background:"#111", border:"1px solid #222", borderRadius:8, padding:"10px 12px", color:"#f0ede6", fontSize:13, outline:"none", fontFamily:"'DM Sans',sans-serif", marginBottom:10 }

  return (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(3,1fr)", gap:10, marginBottom:"1.5rem" }}>
        {[
          { label:"Total members", value:loyalty.length },
          { label:"Total points issued", value:loyalty.reduce((s,l)=>s+(l.lifetime_points||0),0).toLocaleString(), color:"#e6821e" },
          { label:"Platinum members", value:loyalty.filter(l=>l.points>=10000).length, color:"#d4537e" },
        ].map(s=>(
          <div key={s.label} style={{ background:"#111", borderRadius:10, padding:"1rem", border:"1px solid #1e1e1e" }}>
            <div style={{ fontSize:11, color:"#555", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:6 }}>{s.label}</div>
            <div style={{ fontFamily:"Syne", fontSize:22, fontWeight:800, color:s.color||"#f0ede6" }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, marginBottom:10, color:"#f0ede6" }}>
        Loyalty leaderboard
      </div>

      {loading&&<div style={{ color:"#555", fontSize:13 }}>Loading...</div>}
      {!loading&&loyalty.length===0&&<div style={{ color:"#444", fontSize:13, textAlign:"center", padding:"2rem" }}>No loyalty members yet</div>}

      {loyalty.map((l,i)=>{
        const tier = getTier(l.points||0)
        const profile = l.profile_public
        const name = profile?.business_name||`${profile?.first_name||""} ${profile?.last_name||""}`.trim()||"User"
        return (
          <div key={l.user_id} style={{ background:"#111", border:`1px solid ${adjusting===l.user_id?"#e6821e40":"#1e1e1e"}`, borderRadius:10, padding:"1rem", marginBottom:8 }}>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <div style={{ width:32, height:32, borderRadius:"50%", background:`${tier.color}20`, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"Syne", fontSize:14, fontWeight:800, color:tier.color, flexShrink:0 }}>
                {i+1}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:2 }}>
                  <div style={{ fontSize:13, fontWeight:500, color:"#f0ede6", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{name}</div>
                  <span style={{ fontSize:10, padding:"1px 6px", borderRadius:10, background:`${tier.color}20`, color:tier.color, flexShrink:0 }}>{tier.name}</span>
                </div>
                <div style={{ fontSize:11, color:"#555" }}>
                  {(l.points||0).toLocaleString()} pts · lifetime {(l.lifetime_points||0).toLocaleString()}
                </div>
              </div>
              <button onClick={()=>setAdjusting(adjusting===l.user_id?null:l.user_id)}
                style={{ background:"none", border:"1px solid #333", borderRadius:7, color:"#888", fontSize:11, padding:"5px 10px", cursor:"pointer", flexShrink:0 }}>
                {adjusting===l.user_id?"Close":"Adjust"}
              </button>
            </div>

            {adjusting===l.user_id&&(
              <div style={{ marginTop:12, paddingTop:12, borderTop:"1px solid #1e1e1e" }}>
                <div style={{ fontSize:12, color:"#555", marginBottom:10 }}>
                  Current balance: <span style={{ color:"#e6821e", fontWeight:600 }}>{(l.points||0).toLocaleString()} points</span>
                </div>
                <form onSubmit={adjustPoints}>
                  <label style={{ fontSize:11, color:"#666", textTransform:"uppercase", letterSpacing:"0.05em", display:"block", marginBottom:4 }}>Points to add (use negative to deduct)</label>
                  <input style={inp} type="number" placeholder="e.g. 500 or -200" value={adjustForm.points} onChange={e=>setAdjustForm(f=>({...f,points:e.target.value}))} required/>
                  <label style={{ fontSize:11, color:"#666", textTransform:"uppercase", letterSpacing:"0.05em", display:"block", marginBottom:4 }}>Reason</label>
                  <input style={inp} placeholder="e.g. Promotional bonus, correction" value={adjustForm.reason} onChange={e=>setAdjustForm(f=>({...f,reason:e.target.value}))}/>
                  <div style={{ display:"flex", gap:8 }}>
                    <button type="submit" style={{ background:"#e6821e", border:"none", borderRadius:8, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"9px 20px", cursor:"pointer" }}>Apply adjustment</button>
                    <button type="button" onClick={()=>setAdjusting(null)} style={{ background:"none", border:"1px solid #333", borderRadius:8, color:"#888", fontSize:13, padding:"9px 20px", cursor:"pointer" }}>Cancel</button>
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


