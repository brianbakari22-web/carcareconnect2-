import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import toast from "react-hot-toast"

export default function CustomerVehicles() {
  const { user } = useAuth()
  const [vehicles, setVehicles] = useState([])
  const [form, setForm] = useState({make:"",model:"",year:"",color:"",license_plate:""})
  const [editing, setEditing] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (user) load() }, [user])

  async function load() {
    const { data } = await supabase.from("vehicles").select("*").eq("user_id", user.id).order("is_default",{ascending:false})
    setVehicles(data||[]); setLoading(false)
  }

  async function save(e) {
    e.preventDefault()
    const payload = {...form, year:parseInt(form.year), user_id:user.id}
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

  const inp = {width:"100%",background:"#111",border:"1px solid #222",borderRadius:8,padding:"10px 12px",color:"#f0ede6",fontSize:13,outline:"none",marginBottom:10,fontFamily:"'DM Sans',sans-serif"}
  const lbl = {fontSize:11,color:"#666",textTransform:"uppercase",letterSpacing:"0.05em",display:"block",marginBottom:4}

  return (
    <div>
      {loading&&<div style={{color:"#555",fontSize:13}}>Loading...</div>}
      {vehicles.map(v=>(
        <div key={v.id} style={{background:"#111",border:`1px solid ${v.is_default?"#e6821e40":"#1e1e1e"}`,borderRadius:10,padding:"1rem",marginBottom:10,display:"flex",alignItems:"center",gap:14}}>
          <div style={{width:44,height:44,background:"#1a1208",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>🚗</div>
          <div style={{flex:1}}>
            <div style={{fontSize:14,fontWeight:500}}>{v.make} {v.model}</div>
            <div style={{fontSize:11,color:"#555",marginTop:2}}>{v.year} · {v.color} · {v.license_plate}</div>
            {v.is_default&&<div style={{fontSize:10,color:"#e6821e",marginTop:3}}>Default vehicle</div>}
          </div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {!v.is_default&&<button onClick={()=>setDefault(v.id)} style={{background:"none",border:"1px solid #333",borderRadius:7,color:"#888",fontSize:11,padding:"5px 10px",cursor:"pointer"}}>Set default</button>}
            <button onClick={()=>{setEditing(v.id);setForm({make:v.make,model:v.model,year:String(v.year),color:v.color||"",license_plate:v.license_plate})}} style={{background:"none",border:"1px solid #333",borderRadius:7,color:"#888",fontSize:11,padding:"5px 10px",cursor:"pointer"}}>Edit</button>
            <button onClick={()=>remove(v.id)} style={{background:"none",border:"1px solid #e24b4a40",borderRadius:7,color:"#e24b4a",fontSize:11,padding:"5px 10px",cursor:"pointer"}}>Remove</button>
          </div>
        </div>
      ))}
      <div style={{background:"#111",border:"1px solid #1e1e1e",borderRadius:10,padding:"1.25rem",marginTop:"1rem"}}>
        <div style={{fontFamily:"Syne",fontSize:14,fontWeight:700,marginBottom:"1rem"}}>{editing?"Edit vehicle":"Add a vehicle"}</div>
        <form onSubmit={save}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div><label style={lbl}>Make</label><input style={inp} placeholder="Toyota" value={form.make} onChange={e=>setForm(f=>({...f,make:e.target.value}))} required/></div>
            <div><label style={lbl}>Model</label><input style={inp} placeholder="Camry" value={form.model} onChange={e=>setForm(f=>({...f,model:e.target.value}))} required/></div>
            <div><label style={lbl}>Year</label><input style={inp} placeholder="2020" type="number" min="1990" max="2026" value={form.year} onChange={e=>setForm(f=>({...f,year:e.target.value}))} required/></div>
            <div><label style={lbl}>Color</label><input style={inp} placeholder="Silver" value={form.color} onChange={e=>setForm(f=>({...f,color:e.target.value}))}/></div>
          </div>
          <div><label style={lbl}>License plate</label><input style={inp} placeholder="KDA 123A" value={form.license_plate} onChange={e=>setForm(f=>({...f,license_plate:e.target.value}))} required/></div>
          <div style={{display:"flex",gap:8}}>
            <button type="submit" style={{background:"#e6821e",border:"none",borderRadius:8,color:"#fff",fontFamily:"Syne,sans-serif",fontSize:13,fontWeight:700,padding:"10px 20px",cursor:"pointer"}}>{editing?"Update vehicle":"Add vehicle"}</button>
            {editing&&<button type="button" onClick={()=>{setEditing(null);setForm({make:"",model:"",year:"",color:"",license_plate:""})}} style={{background:"none",border:"1px solid #333",borderRadius:8,color:"#888",fontSize:13,padding:"10px 20px",cursor:"pointer"}}>Cancel</button>}
          </div>
        </form>
      </div>
    </div>
  )
}
