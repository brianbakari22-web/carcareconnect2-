import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import toast from "react-hot-toast"
const ROLES = {washer:"🚿 Washer",supervisor:"≡ƒæö Supervisor",cashier:"≡ƒÆ░ Cashier",detailer:"✨ Detailer"}
const SHIFTS = {morning:"≡ƒîà Morning (6am-2pm)",afternoon:"ΓÿÇ∩╕Å Afternoon (2pm-10pm)",fullday:"≡ƒòÉ Full Day"}
export default function StaffManagement() {
  const { user } = useAuth()
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({name:"",phone:"",role:"washer",shift:"morning"})
  const [saving, setSaving] = useState(false)
  useEffect(()=>{if(user)load()},[user])
  async function load() {
    const {data} = await supabase.from("provider_staff").select("*").eq("provider_id",user.id).order("created_at",{ascending:false})
    setStaff(data||[]); setLoading(false)
  }
  async function save(e) {
    e.preventDefault(); setSaving(true)
    try {
      await supabase.from("provider_staff").insert({provider_id:user.id,name:form.name,phone:form.phone,role:form.role,shift:form.shift,is_active:true})
      toast.success("Staff added!"); setForm({name:"",phone:"",role:"washer",shift:"morning"}); setShowForm(false); load()
    } catch(err){toast.error(err.message)} finally{setSaving(false)}
  }
  async function toggle(id,cur){await supabase.from("provider_staff").update({is_active:!cur}).eq("id",id);load()}
  async function del(id){if(!confirm("Remove staff?"))return;await supabase.from("provider_staff").delete().eq("id",id);toast.success("Removed");load()}
  const inp={width:"100%",background:"#f5f5f5",border:"1px solid #e0e0e0",borderRadius:8,padding:"10px 12px",color:"#000",fontSize:13,outline:"none",marginBottom:10}
  const lbl={fontSize:11,color:"#666",textTransform:"uppercase",letterSpacing:"0.05em",display:"block",marginBottom:4}
  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1.5rem"}}>
        <div><div style={{fontFamily:"Syne",fontSize:18,fontWeight:800,color:"#000"}}>≡ƒæÑ Staff Management</div><div style={{fontSize:12,color:"#777"}}>{staff.filter(s=>s.is_active).length} active staff</div></div>
        <button onClick={()=>setShowForm(f=>!f)} style={{background:"#e6821e",border:"none",borderRadius:9,color:"#fff",fontFamily:"Syne,sans-serif",fontSize:13,fontWeight:700,padding:"9px 18px",cursor:"pointer"}}>+ Add staff</button>
      </div>
      {showForm&&(
        <div style={{background:"#f5f5f5",border:"1px solid #eeeeee",borderRadius:12,padding:"1.25rem",marginBottom:"1.5rem"}}>
          <form onSubmit={save}>
            <label style={lbl}>Full name</label><input style={inp} placeholder="e.g. John Kamau" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} required/>
            <label style={lbl}>Phone</label><input style={inp} placeholder="+254 700 000 000" value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} required/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <div><label style={lbl}>Role</label><select style={inp} value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))}>{Object.entries(ROLES).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></div>
              <div><label style={lbl}>Shift</label><select style={inp} value={form.shift} onChange={e=>setForm(f=>({...f,shift:e.target.value}))}>{Object.entries(SHIFTS).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></div>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button type="submit" disabled={saving} style={{background:saving?"#ccc":"#e6821e",border:"none",borderRadius:9,color:"#fff",fontFamily:"Syne,sans-serif",fontSize:13,fontWeight:700,padding:"10px 20px",cursor:"pointer"}}>{saving?"Saving...":"Add staff"}</button>
              <button type="button" onClick={()=>setShowForm(false)} style={{background:"none",border:"1px solid #ddd",borderRadius:9,color:"#666",fontSize:13,padding:"10px 16px",cursor:"pointer"}}>Cancel</button>
            </div>
          </form>
        </div>
      )}
      {loading&&<div style={{color:"#777",fontSize:13}}>Loading...</div>}
      {!loading&&staff.length===0&&<div style={{textAlign:"center",padding:"3rem",background:"#f5f5f5",borderRadius:12}}><div style={{fontSize:40,marginBottom:10}}>≡ƒæÑ</div><div style={{fontSize:14,color:"#888"}}>No staff added yet</div></div>}
      {staff.map(s=>(
        <div key={s.id} style={{background:"#fff",border:"1px solid #eeeeee",borderRadius:12,padding:"1rem",marginBottom:8,display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:44,height:44,borderRadius:"50%",background:s.is_active?"#f0fdf4":"#f5f5f5",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>{ROLES[s.role]?.split(" ")[0]||"≡ƒæñ"}</div>
          <div style={{flex:1}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:2}}>
              <div style={{fontFamily:"Syne",fontSize:14,fontWeight:700,color:"#000"}}>{s.name}</div>
              <span style={{fontSize:10,padding:"2px 8px",borderRadius:10,background:s.is_active?"#f0fdf4":"#f5f5f5",color:s.is_active?"#1d9e75":"#888"}}>{s.is_active?"Active":"Off duty"}</span>
            </div>
            <div style={{fontSize:11,color:"#666"}}>{ROLES[s.role]} · {SHIFTS[s.shift]}</div>
            <div style={{fontSize:11,color:"#888"}}>≡ƒô₧ {s.phone}</div>
          </div>
          <div style={{display:"flex",gap:6}}>
            <button onClick={()=>toggle(s.id,s.is_active)} style={{background:"none",border:`1px solid ${s.is_active?"#e24b4a40":"#1d9e7540"}`,borderRadius:7,color:s.is_active?"#e24b4a":"#1d9e75",fontSize:11,padding:"5px 10px",cursor:"pointer"}}>{s.is_active?"Off duty":"On duty"}</button>
            <button onClick={()=>del(s.id)} style={{background:"none",border:"1px solid #e24b4a40",borderRadius:7,color:"#e24b4a",fontSize:11,padding:"5px 10px",cursor:"pointer"}}>Remove</button>
          </div>
        </div>
      ))}
    </div>
  )
}
