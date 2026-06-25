import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import toast from "react-hot-toast"
const STATUS_COLORS = { pending:"#e6821e", confirmed:"#378add", "in-progress":"#8b5cf6", completed:"#1d9e75", cancelled:"#e24b4a" }
export default function WashQueue() {
  const { user } = useAuth()
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(null)
  useEffect(() => { if (user) { load(); const sub = supabase.channel("wash-queue").on("postgres_changes",{event:"*",schema:"public",table:"bookings",filter:`provider_id=eq.${user.id}`},()=>load()).subscribe(); return ()=>supabase.removeChannel(sub) } }, [user])
  async function load() {
    const { data } = await supabase.from("bookings").select("*, profiles!bookings_customer_id_fkey(first_name,last_name), vehicles(make,model,color,license_plate)").eq("provider_id",user.id).in("status",["pending","confirmed","in-progress"]).eq("is_archived",false).order("booking_date",{ascending:true})
    setBookings(data||[]); setLoading(false)
  }
  async function updateStatus(id, status) {
    await supabase.from("bookings").update({status}).eq("id",id)
    if (status==="completed") {
      const b = bookings.find(x=>x.id===id)
      if (b?.customer_id) await supabase.from("notifications").insert({ user_id:b.customer_id, title:"Car wash complete! 🚿", message:`Your ${b.service_name} is done! Come pick up your sparkling clean car.`, type:"success" })
    }
    toast.success(`Updated to ${status}`); load()
  }
  async function uploadPhoto(id, file, type) {
    setUploading(id+type)
    const path = `wash/${id}-${type}-${Date.now()}.${file.name.split(".").pop()}`
    await supabase.storage.from("provider-photos").upload(path, file, {upsert:true})
    const { data } = supabase.storage.from("provider-photos").getPublicUrl(path)
    await supabase.from("bookings").update({[type==="before"?"before_photo_url":"after_photo_url"]:data.publicUrl}).eq("id",id)
    toast.success(`${type} photo uploaded!`); setUploading(null); load()
  }
  if (loading) return <div style={{color:"#777",fontSize:13}}>Loading...</div>
  return (
    <div>
      <div style={{fontFamily:"Syne",fontSize:18,fontWeight:800,color:"#000",marginBottom:4}}>🚿 Active Wash Queue</div>
      <div style={{fontSize:12,color:"#777",marginBottom:"1.5rem"}}>{bookings.length} active booking{bookings.length!==1?"s":""}</div>
      {bookings.length===0&&<div style={{textAlign:"center",padding:"3rem",background:"#f5f5f5",borderRadius:12}}><div style={{fontSize:40,marginBottom:10}}>🚗</div><div style={{fontSize:14,color:"#888"}}>No active bookings right now</div></div>}
      {bookings.map(b=>(
        <div key={b.id} style={{background:"#fff",border:`2px solid ${STATUS_COLORS[b.status]||"#eee"}30`,borderRadius:14,padding:"1.25rem",marginBottom:12,borderLeft:`4px solid ${STATUS_COLORS[b.status]||"#eee"}`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
            <div>
              <div style={{fontFamily:"Syne",fontSize:15,fontWeight:700,color:"#000"}}>{b.service_name}</div>
              <div style={{fontSize:12,color:"#666"}}>👤 {b.profiles?.first_name} {b.profiles?.last_name}</div>
              {b.vehicles&&<div style={{fontSize:12,color:"#666"}}>🚗 {b.vehicles.color} {b.vehicles.make} {b.vehicles.model} · {b.vehicles.license_plate}</div>}
              <div style={{fontSize:11,color:"#888"}}>📅 {b.booking_date} · {b.booking_time}</div>
            </div>
            <span style={{fontSize:11,padding:"3px 10px",borderRadius:20,background:`${STATUS_COLORS[b.status]}20`,color:STATUS_COLORS[b.status],fontWeight:600}}>{b.status}</span>
          </div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
            {b.status==="pending"&&<button onClick={()=>updateStatus(b.id,"confirmed")} style={{background:"#378add",border:"none",borderRadius:8,color:"#fff",fontSize:12,fontWeight:600,padding:"7px 14px",cursor:"pointer"}}>✓ Confirm</button>}
            {b.status==="confirmed"&&<button onClick={()=>updateStatus(b.id,"in-progress")} style={{background:"#8b5cf6",border:"none",borderRadius:8,color:"#fff",fontSize:12,fontWeight:600,padding:"7px 14px",cursor:"pointer"}}>🚿 Start Wash</button>}
            {b.status==="in-progress"&&<button onClick={()=>updateStatus(b.id,"completed")} style={{background:"#1d9e75",border:"none",borderRadius:8,color:"#fff",fontSize:12,fontWeight:600,padding:"7px 14px",cursor:"pointer"}}>✅ Complete</button>}
            <button onClick={()=>updateStatus(b.id,"cancelled")} style={{background:"none",border:"1px solid #e24b4a40",borderRadius:8,color:"#e24b4a",fontSize:12,padding:"7px 14px",cursor:"pointer"}}>Cancel</button>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            {["before","after"].map(type=>(
              <div key={type} style={{background:"#f5f5f5",borderRadius:8,padding:"0.75rem",textAlign:"center"}}>
                <div style={{fontSize:11,color:"#666",marginBottom:6}}>📷 {type==="before"?"Before":"After"} photo</div>
                {b[type==="before"?"before_photo_url":"after_photo_url"]
                  ? <img src={b[type==="before"?"before_photo_url":"after_photo_url"]} alt={type} style={{width:"100%",height:80,objectFit:"cover",borderRadius:6}}/>
                  : <label style={{cursor:"pointer",fontSize:11,color:"#378add"}}>+ Upload<input type="file" accept="image/*" style={{display:"none"}} onChange={e=>e.target.files[0]&&uploadPhoto(b.id,e.target.files[0],type)}/></label>}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

