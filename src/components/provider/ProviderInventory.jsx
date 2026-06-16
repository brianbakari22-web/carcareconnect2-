import { useEffect, useState, useRef } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import useIsMobile from "../../lib/useIsMobile"
import toast from "react-hot-toast"

const CATEGORIES = [
  { key:"parts", label:"Parts", icon:"⚙️", desc:"Engine, brake, suspension parts" },
  { key:"accessories", label:"Accessories", icon:"✨", desc:"Mats, cameras, audio, lights" },
  { key:"tyres", label:"Tyres", icon:"🛞", desc:"All tyre brands and sizes" },
  { key:"tools", label:"Tools", icon:"🔧", desc:"Mechanical tools and equipment" },
  { key:"oils", label:"Oils & Fluids", icon:"🛢️", desc:"Engine oil, brake fluid, coolant" },
  { key:"electrical", label:"Electrical", icon:"⚡", desc:"Batteries, bulbs, wiring" },
  { key:"body", label:"Body Parts", icon:"🚗", desc:"Bumpers, doors, mirrors, glass" },
  { key:"other", label:"Other", icon:"≡ƒôª", desc:"Other automotive items" },
]

const EMPTY = {
  name:"", description:"", category:"parts", subcategory:"",
  price:"", stock_quantity:"", unit:"piece", brand:"",
  compatible_cars:"", is_active:true, photos:[]
}

export default function ProviderInventory() {
  const { user } = useAuth()
  const isMobile = useIsMobile()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [photoPreview, setPhotoPreview] = useState(null)
  const photoRef = useRef(null)
  const [search, setSearch] = useState("")
  const [catFilter, setCatFilter] = useState("all")

  useEffect(() => {
    if (!user) return
    load()
    const sub = supabase.channel("provider-inventory-live")
      .on("postgres_changes", { event:"*", schema:"public", table:"inventory", filter:`provider_id=eq.${user.id}` }, () => load())
      .on("postgres_changes", { event:"*", schema:"public", table:"orders", filter:`provider_id=eq.${user.id}` }, () => { toast("New order received! 🛒", { duration:5000 }); load() })
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [user])

  async function load() {
    const { data } = await supabase.from("inventory")
      .select("*")
      .eq("provider_id", user.id)
      .order("created_at", { ascending:false })
    setItems(data||[])
    setLoading(false)
  }

  async function uploadItemPhoto(file) {
    if (!file) return null
    setUploadingPhoto(true)
    try {
      const ext = file.name.split(".").pop()
      const path = `${user.id}/item-${Date.now()}.${ext}`
      const { error } = await supabase.storage.from("provider-photos").upload(path, file, { upsert:true })
      if (error) throw error
      const { data } = supabase.storage.from("provider-photos").getPublicUrl(path)
      return data.publicUrl
    } catch(e) { toast.error(e.message); return null }
    finally { setUploadingPhoto(false) }
  }

  async function save(e) {
    e.preventDefault()
    setSaving(true)
    try {
      let photoUrl = form.photos?.[0] || null
      if (photoRef.current?.files?.[0]) {
        photoUrl = await uploadItemPhoto(photoRef.current.files[0])
      }
      const payload = {
        ...form,
        provider_id: user.id,
        price: Number(form.price)||0,
        stock_quantity: Number(form.stock_quantity)||0,
        compatible_cars: form.compatible_cars ? form.compatible_cars.split(",").map(s=>s.trim()) : [],
        photos: photoUrl ? [photoUrl] : [],
      }
      if (editing) {
        await supabase.from("inventory").update(payload).eq("id", editing)
        toast.success("Item updated")
      } else {
        await supabase.from("inventory").insert(payload)
        toast.success("Item added to inventory")
      }
      setShowForm(false); setEditing(null); setForm(EMPTY); load()
    } catch(e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  async function toggleActive(item) {
    await supabase.from("inventory").update({ is_active:!item.is_active }).eq("id", item.id)
    toast.success(item.is_active?"Item hidden":"Item visible")
    load()
  }

  async function deleteItem(id) {
    if (!confirm("Delete this item?")) return
    await supabase.from("inventory").delete().eq("id", id)
    toast.success("Item deleted")
    load()
  }

  async function updateStock(id, qty) {
    await supabase.from("inventory").update({ stock_quantity:qty, updated_at:new Date().toISOString() }).eq("id", id)
    if (qty<=3&&qty>0) toast("ΓÜá∩╕Å Low stock warning — only "+qty+" left!", { icon:"ΓÜá∩╕Å", duration:5000 })
    if (qty===0) toast.error("Γ¥î Item out of stock — customers cannot order this item")
    load()
  }

  const filtered = items.filter(i=>{
    const matchCat = catFilter==="all"||i.category===catFilter
    const matchSearch = i.name.toLowerCase().includes(search.toLowerCase())
    return matchCat&&matchSearch
  })

  const totalItems = items.length
  const activeItems = items.filter(i=>i.is_active).length
  const lowStock = items.filter(i=>i.stock_quantity<=5&&i.is_active).length
  const totalValue = items.reduce((s,i)=>s+Number(i.price||0)*Number(i.stock_quantity||0),0)

  const inp = { width:"100%", background:"#ffffff", border:"1px solid #e5e5e5", borderRadius:8, padding:"9px 12px", color:"#000000", fontSize:12, outline:"none", fontFamily:"DM Sans,sans-serif", marginBottom:8 }
  const lbl = { fontSize:11, color:"#666", display:"block", marginBottom:3, textTransform:"uppercase", letterSpacing:"0.05em" }

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1.25rem", flexWrap:"wrap", gap:10 }}>
        <div>
          <div style={{ fontFamily:"Syne", fontSize:isMobile?16:20, fontWeight:800, color:"#000000" }}>Inventory</div>
          <div style={{ fontSize:12, color:"#777777" }}>Manage your parts, accessories and products</div>
        </div>
        <button onClick={()=>{ setShowForm(true); setEditing(null); setForm(EMPTY) }}
          style={{ background:"#e6821e", border:"none", borderRadius:9, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"10px 18px", cursor:"pointer" }}>
          + Add item
        </button>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:"1.5rem" }}>
        {[
          { label:"Total items", value:totalItems, color:"#000000" },
          { label:"Active", value:activeItems, color:"#1d9e75" },
          { label:"Low stock", value:lowStock, color:lowStock>0?"#e24b4a":"#555" },
          { label:"Stock value", value:"KES "+totalValue.toLocaleString(), color:"#e6821e" },
        ].map(s=>(
          <div key={s.label} style={{ background:"#ffffff", borderRadius:10, padding:"0.75rem", border:"1px solid #eeeeee", textAlign:"center" }}>
            <div style={{ fontFamily:"Syne", fontSize:isMobile?13:17, fontWeight:800, color:s.color }}>{s.value}</div>
            <div style={{ fontSize:9, color:"#777777", marginTop:2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {showForm&&(
        <div style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:12, padding:"1.25rem", marginBottom:"1.5rem" }}>
          <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, color:"#000000", marginBottom:"1rem" }}>{editing?"Edit item":"Add new item"}</div>
          <form onSubmit={save}>
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:10 }}>
              <div><label style={lbl}>Item name</label><input style={inp} value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} required placeholder="e.g. Toyota Vitz Brake Pads"/></div>
              <div><label style={lbl}>Brand</label><input style={inp} value={form.brand} onChange={e=>setForm(f=>({...f,brand:e.target.value}))} placeholder="e.g. Bosch, Genuine"/></div>
              <div>
                <label style={lbl}>Category</label>
                <select style={inp} value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}>
                  {CATEGORIES.map(c=><option key={c.key} value={c.key}>{c.icon} {c.label}</option>)}
                </select>
              </div>
              <div><label style={lbl}>Subcategory</label><input style={inp} value={form.subcategory} onChange={e=>setForm(f=>({...f,subcategory:e.target.value}))} placeholder="e.g. Front brake pads"/></div>
              <div><label style={lbl}>Price (KES)</label><input type="number" style={inp} value={form.price} onChange={e=>setForm(f=>({...f,price:e.target.value}))} required placeholder="0"/></div>
              <div>
                <label style={lbl}>Stock quantity</label>
                <div style={{ display:"flex", gap:6 }}>
                  <input type="number" style={{...inp, marginBottom:0}} value={form.stock_quantity} onChange={e=>setForm(f=>({...f,stock_quantity:e.target.value}))} placeholder="0"/>
                  <select style={{...inp, marginBottom:0, width:"auto"}} value={form.unit} onChange={e=>setForm(f=>({...f,unit:e.target.value}))}>
                    {["piece","set","pair","litre","kg","box","roll"].map(u=><option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <label style={lbl}>Compatible cars (comma separated)</label>
            <input style={inp} value={form.compatible_cars} onChange={e=>setForm(f=>({...f,compatible_cars:e.target.value}))} placeholder="e.g. Toyota Vitz, Toyota Axio, Toyota Fielder"/>
            <label style={lbl}>Description</label>
            <textarea style={{...inp, resize:"vertical", minHeight:60}} value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="Describe the item..."/>
            <label style={lbl}>Item photo</label>
            <div style={{ marginBottom:10 }}>
              {photoPreview&&<img src={photoPreview} alt="Preview" style={{ width:"100%", maxHeight:150, objectFit:"cover", borderRadius:8, marginBottom:8 }}/>}
              {!photoPreview&&form.photos?.[0]&&<img src={form.photos[0]} alt="Current" style={{ width:"100%", maxHeight:150, objectFit:"cover", borderRadius:8, marginBottom:8 }}/>}
              <input ref={photoRef} type="file" accept="image/*"
                onChange={e=>{ const f=e.target.files[0]; if(f) setPhotoPreview(URL.createObjectURL(f)) }}
                style={{ width:"100%", background:"#ffffff", border:"1px solid #e5e5e5", borderRadius:8, padding:"8px", color:"#555555", fontSize:12, marginBottom:8 }}/>
              {uploadingPhoto&&<div style={{ fontSize:11, color:"#777777" }}>Uploading photo...</div>}
            </div>
            <div style={{ display:"flex", gap:8, marginTop:4 }}>
              <button type="submit" disabled={saving} style={{ background:saving?"#555555":"#e6821e", border:"none", borderRadius:9, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"10px 24px", cursor:saving?"not-allowed":"pointer" }}>
                {saving?"Saving...":editing?"Update item":"Add item"}
              </button>
              <button type="button" onClick={()=>{ setShowForm(false); setEditing(null); setForm(EMPTY) }} style={{ background:"none", border:"1px solid #dddddd", borderRadius:9, color:"#666", fontSize:13, padding:"10px 18px", cursor:"pointer" }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div style={{ display:"flex", gap:8, marginBottom:"1rem", flexWrap:"wrap" }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search inventory..."
          style={{ flex:1, minWidth:150, background:"#ffffff", border:"1px solid #e5e5e5", borderRadius:8, padding:"8px 12px", color:"#000000", fontSize:12, outline:"none" }}/>
      </div>
      <div style={{ display:"flex", gap:6, marginBottom:"1rem", flexWrap:"wrap" }}>
        {[{k:"all",l:"All"}, ...CATEGORIES].map(c=>(
          <button key={c.key||c.k} onClick={()=>setCatFilter(c.key||c.k)}
            style={{ padding:"5px 10px", borderRadius:7, border:"none", fontSize:11, cursor:"pointer", background:catFilter===(c.key||c.k)?"#e6821e":"#555555", color:catFilter===(c.key||c.k)?"#fff":"#666" }}>
            {c.icon||""} {c.label||c.l}
          </button>
        ))}
      </div>

      {loading&&<div style={{ color:"#777777", fontSize:13 }}>Loading...</div>}
      {!loading&&filtered.length===0&&<div style={{ color:"#888888", fontSize:13, textAlign:"center", padding:"2rem" }}>No items found</div>}

      {filtered.map(item=>(
        <div key={item.id} style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:10, padding:"1rem", marginBottom:8, opacity:item.is_active?1:0.6 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:10 }}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4, flexWrap:"wrap" }}>
                <div style={{ fontSize:13, fontWeight:600, color:"#000000" }}>{item.name}</div>
                {item.brand&&<span style={{ fontSize:10, color:"#555555", background:"#f5f5f5", padding:"1px 6px", borderRadius:6 }}>{item.brand}</span>}
                <span style={{ fontSize:10, color:item.is_active?"#1d9e75":"#555", background:item.is_active?"#f0fdf4":"#ffffff", padding:"1px 6px", borderRadius:6 }}>{item.is_active?"Active":"Hidden"}</span>
                {item.stock_quantity<=5&&item.is_active&&<span style={{ fontSize:10, color:"#e24b4a", background:"#fff5f5", padding:"1px 6px", borderRadius:6 }}>ΓÜá∩╕Å Low stock</span>}
              </div>
              <div style={{ fontSize:11, color:"#777777", marginBottom:4 }}>
                {CATEGORIES.find(c=>c.key===item.category)?.icon} {item.category} {item.subcategory?`· ${item.subcategory}`:""}
              </div>
              {item.compatible_cars?.length>0&&(
                <div style={{ fontSize:10, color:"#888888", marginBottom:4 }}>🚗 {item.compatible_cars.join(", ")}</div>
              )}
              {item.description&&<div style={{ fontSize:11, color:"#777777", fontStyle:"italic" }}>{item.description}</div>}
            </div>
            <div style={{ textAlign:"right", flexShrink:0 }}>
              <div style={{ fontFamily:"Syne", fontSize:15, fontWeight:800, color:"#e6821e" }}>KES {Number(item.price).toLocaleString()}</div>
              <div style={{ fontSize:11, color:"#777777", marginTop:2 }}>/{item.unit}</div>
            </div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:10, flexWrap:"wrap" }}>
            <div style={{ display:"flex", alignItems:"center", gap:6, background:"#ffffff", borderRadius:7, padding:"4px 8px" }}>
              <button onClick={()=>updateStock(item.id, Math.max(0,item.stock_quantity-1))} style={{ background:"none", border:"none", color:"#e6821e", cursor:"pointer", fontSize:16, lineHeight:1, padding:"0 4px" }}>ΓêÆ</button>
              <span style={{ fontSize:12, color:"#000000", minWidth:20, textAlign:"center" }}>{item.stock_quantity}</span>
              <button onClick={()=>updateStock(item.id, item.stock_quantity+1)} style={{ background:"none", border:"none", color:"#1d9e75", cursor:"pointer", fontSize:16, lineHeight:1, padding:"0 4px" }}>+</button>
              <span style={{ fontSize:10, color:"#777777" }}>{item.unit}s</span>
            </div>
            <button onClick={()=>{ setEditing(item.id); setForm({...item, compatible_cars:item.compatible_cars?.join(", ")||""}); setShowForm(true) }}
              style={{ background:"#eff6ff", border:"1px solid #378add40", borderRadius:7, color:"#378add", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>Edit</button>
            <button onClick={()=>toggleActive(item)}
              style={{ background:"none", border:"1px solid #dddddd", borderRadius:7, color:"#666", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>{item.is_active?"Hide":"Show"}</button>
            <button onClick={()=>deleteItem(item.id)}
              style={{ background:"none", border:"1px solid #e24b4a30", borderRadius:7, color:"#e24b4a", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>Delete</button>
          </div>
        </div>
      ))}
    </div>
  )
}





