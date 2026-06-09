import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import toast from "react-hot-toast"
const DEFAULTS = [
  {name:"Basic Wash",price:500,duration:30,description:"Exterior rinse and dry"},
  {name:"Standard Wash",price:800,duration:45,description:"Exterior wash, rinse, dry and windows"},
  {name:"Premium Wash",price:1200,duration:60,description:"Full exterior + interior vacuum"},
  {name:"Full Detailing",price:3500,duration:120,description:"Complete interior & exterior detailing"},
]
export default function WashPackages() {
  const { user } = useAuth()
  const [packages, setPackages] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({name:"",price:"",duration:60,description:""})
  const [saving, setSaving] = useState(false)
  useEffect(()=>{if(user)load()},[user])
  async function load() {
    const {data} = await supabase.from("services").select("*").eq("provider_id",user.id).order("created_at",{ascending:false})
    setPackages(data||[]); setLoading(false)
  }
  async function save(e) {
    e.preventDefault(); setSaving(true)
    try {
      await supabase.from("services").insert({provider_id:user.id,name:form.name,price:Number(form.price),duration_minutes:Number(form.duration),description:form.description,category:"car_wash",is_active:true})
      toast.success("Package added!"); setForm({name:"",price:"",duration:60,description:""}); setShowForm(false); load()
    } catch(err){toast.error(err.message)} finally{setSaving(false)}
  }
  async function toggle(id,cur){await supabase.from("services").update({is_active:!cur}).eq("id",id);load()}
  async function del(id){if(!confirm("Delete?"))return;await supabase.from("services").delete().eq("id",id);toast.success("Deleted");load()}
  const inp={width:"100%",background:"#f5f5f5",border:"1px solid #e0e0e0",borderRadius:8,padding:"10px 12px",color:"#000",fontSize:13,outline:"none",marginBottom:10}
  const lbl={fontSize:11,color:"#666",textTransform:"uppercase",letterSpacing:"0.05em",display:"block",marginBottom:4}
  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1.5rem"}}>
        <div><div style={{fontFamily:"Syne",fontSize:18,fontWeight:800,color:"#000"}}>✨ Wash Packages</div><div style={{fontSize:12,color:"#777"}}>Manage your service packages</div></div>
        <button onClick={()=>setShowForm(f=>!f)} style={{background:"#e6821e",border:"none",borderRadius:9,color:"#fff",fontFamily:"Syne,sans-serif",fontSize:13,fontWeight:700,padding:"9px 18px",cursor:"pointer"}}>+ Add package</button>
      </div>
      {packages.length===0&&!showForm&&(
        <div style={{background:"#fff8f0",border:"1px solid #fed7aa",borderRadius:12,padding:"1.25rem",marginBottom:"1.5rem"}}>
          <div style={{fontFamily:"Syne",fontSize:13,fontWeight:700,color:"#e6821e",marginBottom:8}}>💡 Suggested packages</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            {DEFAULTS.map(p=>(
              <div key={p.name} onClick={()=>{setForm({name:p.name,price:p.price,duration:p.duration,description:p.description});setShowForm(true)}} style={{background:"#fff",border:"1px solid #e5e5e5",borderRadius:10,padding:"0.75rem",cursor:"pointer"}}>
                <div style={{fontSize:13,fontWeight:700,color:"#000"}}>{p.name}</div>
                <div style={{fontSize:11,color:"#666"}}>KES {p.price.toLocaleString()} · {p.duration} min</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {showForm&&(
        <div style={{background:"#f5f5f5",border:"1px solid #eeeeee",borderRadius:12,padding:"1.25rem",marginBottom:"1.5rem"}}>
          <div style={{fontFamily:"Syne",fontSize:14,fontWeight:700,marginBottom:"1rem",color:"#000"}}>New package</div>
          <form onSubmit={save}>
            <label style={lbl}>Package name</label><input style={inp} placeholder="e.g. Premium Wash" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} required/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <div><label style={lbl}>Price (KES)</label><input style={inp} type="number" value={form.price} onChange={e=>setForm(f=>({...f,price:e.target.value}))} required/></div>
              <div><label style={lbl}>Duration (min)</label><input style={inp} type="number" value={form.duration} onChange={e=>setForm(f=>({...f,duration:e.target.value}))} required/></div>
            </div>
            <label style={lbl}>Description</label>
            <textarea style={{...inp,resize:"vertical",minHeight:70}} value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))}/>
            <div style={{display:"flex",gap:8}}>
              <button type="submit" disabled={saving} style={{background:saving?"#ccc":"#e6821e",border:"none",borderRadius:9,color:"#fff",fontFamily:"Syne,sans-serif",fontSize:13,fontWeight:700,padding:"10px 20px",cursor:saving?"not-allowed":"pointer"}}>{saving?"Saving...":"Save"}</button>
              <button type="button" onClick={()=>setShowForm(false)} style={{background:"none",border:"1px solid #ddd",borderRadius:9,color:"#666",fontSize:13,padding:"10px 16px",cursor:"pointer"}}>Cancel</button>
            </div>
          </form>
        </div>
      )}
      {loading&&<div style={{color:"#777",fontSize:13}}>Loading...</div>}
      {!loading&&packages.length===0&&<div style={{textAlign:"center",padding:"2rem",color:"#888",fontSize:13}}>No packages yet</div>}
      {packages.map(p=>(
        <div key={p.id} style={{background:"#fff",border:"1px solid #eeeeee",borderRadius:12,padding:"1rem",marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{flex:1}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
              <div style={{fontFamily:"Syne",fontSize:14,fontWeight:700,color:"#000"}}>{p.name}</div>
              <span style={{fontSize:10,padding:"2px 8px",borderRadius:10,background:p.is_active?"#f0fdf4":"#f5f5f5",color:p.is_active?"#1d9e75":"#888"}}>{p.is_active?"Active":"Inactive"}</span>
            </div>
            <div style={{fontSize:13,color:"#e6821e",fontWeight:700}}>KES {Number(p.price).toLocaleString()}</div>
            <div style={{fontSize:11,color:"#888"}}>⏱ {p.duration_minutes} min · {p.description}</div>
          </div>
          <div style={{display:"flex",gap:6}}>
            <button onClick={()=>toggle(p.id,p.is_active)} style={{background:"none",border:`1px solid ${p.is_active?"#e24b4a40":"#1d9e7540"}`,borderRadius:7,color:p.is_active?"#e24b4a":"#1d9e75",fontSize:11,padding:"5px 10px",cursor:"pointer"}}>{p.is_active?"Deactivate":"Activate"}</button>
            <button onClick={()=>del(p.id)} style={{background:"none",border:"1px solid #e24b4a40",borderRadius:7,color:"#e24b4a",fontSize:11,padding:"5px 10px",cursor:"pointer"}}>Delete</button>
          </div>
        </div>
      ))}
    </div>
  )
}

