import useIsMobile from "../../lib/useIsMobile"
import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import toast from "react-hot-toast"

export default function CustomerVehicles() {
  const isMobile = useIsMobile()
  const { user } = useAuth()
  const [vehicles, setVehicles] = useState([])
  const [form, setForm] = useState({make:"",model:"",year:"",color:"",license_plate:"",photo_url:"",current_mileage:"",last_service_date:"",last_oil_change_date:""})
  const [editing, setEditing] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (user) load() }, [user])

  async function load() {
    const { data } = await supabase.from("vehicles").select("*").eq("user_id", user.id).order("is_default",{ascending:false})
    setVehicles(data||[]); setLoading(false)
  }

  async function save(e) {
    e.preventDefault()
    const payload = {...form, year:parseInt(form.year), user_id:user.id, current_mileage: form.current_mileage?parseInt(form.current_mileage):null, last_service_date: form.last_service_date||null, last_oil_change_date: form.last_oil_change_date||null}
    if (editing) {
      const {error} = await supabase.from("vehicles").update(payload).eq("id",editing).eq("user_id",user.id)
      if (error) return toast.error(error.message)
      toast.success("Vehicle updated"); setEditing(null)
    } else {
      const {error} = await supabase.from("vehicles").insert(payload)
      if (error) return toast.error(error.message)
      toast.success("Vehicle added")
    }
    setForm({make:"",model:"",year:"",color:"",license_plate:""}); load()
  }

  async function remove(id) {
    if (!confirm("Remove this vehicle?")) return
    await supabase.from("vehicles").delete().eq("id",id).eq("user_id",user.id)
    toast.success("Vehicle removed"); load()
  }

  async function setDefault(id) {
    await supabase.from("vehicles").update({is_default:false}).eq("user_id",user.id)
    await supabase.from("vehicles").update({is_default:true}).eq("id",id).eq("user_id",user.id)
    toast.success("Default vehicle set"); load()
  }

  function getMaintenanceStatus(v) {
    const alerts = []
    const today = new Date()
    if (v.last_service_date) {
      const monthsSince = (today - new Date(v.last_service_date)) / (1000*60*60*24*30)
      if (monthsSince >= 6) alerts.push({ type:"service", level:"overdue", text:"Full service overdue (6+ months)" })
      else if (monthsSince >= 5) alerts.push({ type:"service", level:"due-soon", text:"Full service due soon" })
    } else {
      alerts.push({ type:"service", level:"unknown", text:"No service history — add last service date" })
    }
    if (v.last_oil_change_date) {
      const monthsSince = (today - new Date(v.last_oil_change_date)) / (1000*60*60*24*30)
      if (monthsSince >= 3) alerts.push({ type:"oil", level:"overdue", text:"Oil change overdue (3+ months)" })
      else if (monthsSince >= 2.5) alerts.push({ type:"oil", level:"due-soon", text:"Oil change due soon" })
    }
    if (v.current_mileage && v.last_service_mileage) {
      const kmSince = v.current_mileage - v.last_service_mileage
      if (kmSince >= 10000) alerts.push({ type:"service-km", level:"overdue", text:"Service overdue (10,000+ km since last service)" })
      else if (kmSince >= 8000) alerts.push({ type:"service-km", level:"due-soon", text:"Service due soon (approaching 10,000km)" })
    }
    if (v.current_mileage && v.last_oil_change_mileage) {
      const kmSince = v.current_mileage - v.last_oil_change_mileage
      if (kmSince >= 5000) alerts.push({ type:"oil-km", level:"overdue", text:"Oil change overdue (5,000+ km since last)" })
      else if (kmSince >= 4000) alerts.push({ type:"oil-km", level:"due-soon", text:"Oil change due soon (approaching 5,000km)" })
    }
    return alerts
  }
  const inp = {width:"100%",background:"#ffffff",border:"1px solid #e5e5e5",borderRadius:8,padding:"10px 12px",color:"#000000",fontSize:13,outline:"none",marginBottom:10,fontFamily:"'DM Sans',sans-serif"}
  const lbl = {fontSize:11,color:"#666",textTransform:"uppercase",letterSpacing:"0.05em",display:"block",marginBottom:4}

  return (
    <div>
      {loading&&<div style={{color:"#777777",fontSize:13}}>Loading...</div>}
      {vehicles.map(v=>(
        <div key={v.id} style={{background:"#ffffff",border:`1px solid ${v.is_default?"#e6821e40":"#eeeeee"}`,borderRadius:10,padding:"1rem",marginBottom:10,display:"flex",alignItems:"center",gap:14}}>
          <div style={{width:54,height:54,background:"#fff8f0",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,overflow:"hidden",flexShrink:0}}>
            {v.photo_url ? <img src={v.photo_url} alt="Vehicle" style={{width:"100%",height:"100%",objectFit:"cover"}}/> : "🚗"}
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:14,fontWeight:500}}>{v.make} {v.model}</div>
            <div style={{fontSize:11,color:"#777777",marginTop:2}}>{v.year} · {v.color} · {v.license_plate}</div>
            {v.is_default&&<div style={{fontSize:10,color:"#e6821e",marginTop:3}}>Default vehicle</div>}
            {v.current_mileage&&<div style={{fontSize:11,color:"#888",marginTop:3}}>{Number(v.current_mileage).toLocaleString()} km</div>}
            {getMaintenanceStatus(v).filter(a=>a.level!=="unknown").map((a,i)=>(
              <div key={i} style={{fontSize:10,color:a.level==="overdue"?"#e24b4a":"#e6821e",background:a.level==="overdue"?"#fff5f5":"#fff8f0",padding:"2px 8px",borderRadius:10,marginTop:4,display:"inline-block",marginRight:4}}>
                {a.level==="overdue"?"⚠️ ":"⏰ "}{a.text}
              </div>
            ))}
          </div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {!v.is_default&&<button onClick={()=>setDefault(v.id)} style={{background:"none",border:"1px solid #dddddd",borderRadius:7,color:"#555555",fontSize:11,padding:"5px 10px",cursor:"pointer"}}>Set default</button>}
            <button onClick={()=>{setEditing(v.id);setForm({make:v.make,model:v.model,year:String(v.year),color:v.color||"",license_plate:v.license_plate,photo_url:v.photo_url||"",current_mileage:v.current_mileage?String(v.current_mileage):"",last_service_date:v.last_service_date||"",last_oil_change_date:v.last_oil_change_date||""})}} style={{background:"none",border:"1px solid #dddddd",borderRadius:7,color:"#555555",fontSize:11,padding:"5px 10px",cursor:"pointer"}}>Edit</button>
            <button onClick={()=>remove(v.id)} style={{background:"none",border:"1px solid #e24b4a40",borderRadius:7,color:"#e24b4a",fontSize:11,padding:"5px 10px",cursor:"pointer"}}>Remove</button>
          </div>
        </div>
      ))}
      <div style={{background:"#ffffff",border:"1px solid #eeeeee",borderRadius:10,padding:"1.25rem",marginTop:"1rem"}}>
        <div style={{fontFamily:"Syne",fontSize:14,fontWeight:700,marginBottom:"1rem"}}>{editing?"Edit vehicle":"Add a vehicle"}</div>
        <form onSubmit={save}>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:10}}>
            <div><label style={lbl}>Make</label><input style={inp} placeholder="Toyota" value={form.make} onChange={e=>setForm(f=>({...f,make:e.target.value}))} required/></div>
            <div><label style={lbl}>Model</label><input style={inp} placeholder="Camry" value={form.model} onChange={e=>setForm(f=>({...f,model:e.target.value}))} required/></div>
            <div><label style={lbl}>Year</label><input style={inp} placeholder="2020" type="number" min="1990" max="2026" value={form.year} onChange={e=>setForm(f=>({...f,year:e.target.value}))} required/></div>
            <div><label style={lbl}>Color</label><input style={inp} placeholder="Silver" value={form.color} onChange={e=>setForm(f=>({...f,color:e.target.value}))}/></div>
          </div>
          <div><label style={lbl}>License plate</label><input style={inp} placeholder="KDA 123A" value={form.license_plate} onChange={e=>setForm(f=>({...f,license_plate:e.target.value}))} required/></div>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr 1fr",gap:10}}>
            <div><label style={lbl}>Current mileage (km)</label><input style={inp} placeholder="45000" type="number" value={form.current_mileage} onChange={e=>setForm(f=>({...f,current_mileage:e.target.value}))}/></div>
            <div><label style={lbl}>Last full service</label><input style={inp} type="date" value={form.last_service_date} onChange={e=>setForm(f=>({...f,last_service_date:e.target.value}))}/></div>
            <div><label style={lbl}>Last oil change</label><input style={inp} type="date" value={form.last_oil_change_date} onChange={e=>setForm(f=>({...f,last_oil_change_date:e.target.value}))}/></div>
          </div>
          <label style={lbl}>Vehicle photo (optional)</label>
          <div style={{ marginBottom:10 }}>
            {form.photo_url&&<img src={form.photo_url} alt="Vehicle" style={{ width:"100%", maxHeight:150, objectFit:"cover", borderRadius:8, marginBottom:8 }}/>}
            <input type="file" accept="image/*" onChange={async(e)=>{
              const file = e.target.files[0]
              if (!file) return
              const ext = file.name.split(".").pop()
              const path = `${user.id}/vehicle-${Date.now()}.${ext}`
              const { error } = await supabase.storage.from("provider-photos").upload(path, file, { upsert:true })
              if (error) return toast.error(error.message)
              const { data } = supabase.storage.from("provider-photos").getPublicUrl(path)
              setForm(f=>({...f, photo_url:data.publicUrl}))
              toast.success("Photo ready!")
            }} style={{ width:"100%", background:"#ffffff", border:"1px solid #e5e5e5", borderRadius:8, padding:"8px", color:"#555555", fontSize:12, marginBottom:8 }}/>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button type="submit" style={{background:"#e6821e",border:"none",borderRadius:8,color:"#fff",fontFamily:"Syne,sans-serif",fontSize:13,fontWeight:700,padding:"10px 20px",cursor:"pointer"}}>{editing?"Update vehicle":"Add vehicle"}</button>
            {editing&&<button type="button" onClick={()=>{setEditing(null);setForm({make:"",model:"",year:"",color:"",license_plate:""})}} style={{background:"none",border:"1px solid #dddddd",borderRadius:8,color:"#555555",fontSize:13,padding:"10px 20px",cursor:"pointer"}}>Cancel</button>}
          </div>
        </form>
      </div>
    </div>
  )
}




