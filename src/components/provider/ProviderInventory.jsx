import { useEffect, useState, useRef } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import useIsMobile from "../../lib/useIsMobile"
import PhotoLightbox from "../shared/PhotoLightbox"
import toast from "react-hot-toast"

const CATEGORIES = [
  { key:"parts", label:"Parts", icon:"⚙️" },
  { key:"accessories", label:"Accessories", icon:"✨" },
  { key:"tyres", label:"Tyres", icon:"🛞" },
  { key:"tools", label:"Tools", icon:"🔧" },
  { key:"oils", label:"Oils & Fluids", icon:"🛢️" },
  { key:"electrical", label:"Electrical", icon:"⚡" },
  { key:"body", label:"Body Parts", icon:"🚗" },
  { key:"other", label:"Other", icon:"📦" },
]

const UNITS = ["piece","set","pair","litre","kg","box","roll"]

const EMPTY = {
  name:"", description:"", category:"parts", subcategory:"",
  price:"", stock_quantity:"", unit:"piece", brand:"",
  compatible_cars:"", is_active:true, photos:[], video_url:""
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
  const [uploadingVideo, setUploadingVideo] = useState(false)
  const [photoPreview, setPhotoPreview] = useState(null)
  const photoRef = useRef(null)
  const [search, setSearch] = useState("")
  const [catFilter, setCatFilter] = useState("all")
  const [lightbox, setLightbox] = useState({ open:false, photos:[], index:0 })
  const [tab, setTab] = useState("inventory")

  useEffect(() => {
    if (!user) return
    load()
    const sub = supabase.channel("provider-inventory-live")
      .on("postgres_changes", { event:"*", schema:"public", table:"inventory", filter:"provider_id=eq."+user.id }, () => load())
      .on("postgres_changes", { event:"*", schema:"public", table:"orders", filter:"provider_id=eq."+user.id }, () => { toast("New order received! 🛒", { duration:5000 }); load() })
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [user])

  async function load() {
    const { data } = await supabase.from("inventory").select("*").eq("provider_id", user.id).order("created_at", { ascending:false })
    setItems(data||[])
    setLoading(false)
  }

  async function uploadItemPhoto(file) {
    if (!file) return null
    setUploadingPhoto(true)
    try {
      const ext = file.name.split(".").pop()
      const path = user.id + "/item-" + Date.now() + "." + ext
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
        video_url: form.video_url||null,
      }
      if (editing) {
        await supabase.from("inventory").update(payload).eq("id", editing)
        toast.success("Item updated!")
      } else {
        await supabase.from("inventory").insert(payload)
        toast.success("Item added to inventory!")
      }
      setShowForm(false); setEditing(null); setForm(EMPTY); setPhotoPreview(null); load()
    } catch(e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  async function toggleActive(item) {
    await supabase.from("inventory").update({ is_active:!item.is_active }).eq("id", item.id)
    toast.success(item.is_active?"Item hidden from marketplace":"Item visible in marketplace")
    load()
  }

  async function deleteItem(id) {
    if (!confirm("Delete this item? This cannot be undone.")) return
    await supabase.from("inventory").delete().eq("id", id)
    toast.success("Item deleted")
    load()
  }

  async function updateStock(id, qty) {
    await supabase.from("inventory").update({ stock_quantity:qty, updated_at:new Date().toISOString() }).eq("id", id)
    if (qty<=3&&qty>0) toast("⚠️ Low stock — only "+qty+" left!", { icon:"⚠️", duration:5000 })
    if (qty===0) toast.error("Out of stock — customers cannot order this item")
    load()
  }

  function startEdit(item) {
    setEditing(item.id)
    setForm({...item, compatible_cars:item.compatible_cars?.join(", ")||""})
    setPhotoPreview(null)
    setShowForm(true)
    window.scrollTo(0,0)
  }

  const filtered = items.filter(i=>{
    const matchCat = catFilter==="all"||i.category===catFilter
    const matchSearch = !search || i.name.toLowerCase().includes(search.toLowerCase()) || (i.brand||"").toLowerCase().includes(search.toLowerCase())
    return matchCat&&matchSearch
  })

  const totalItems = items.length
  const activeItems = items.filter(i=>i.is_active).length
  const lowStock = items.filter(i=>i.stock_quantity<=5&&i.stock_quantity>0&&i.is_active).length
  const outOfStock = items.filter(i=>i.stock_quantity===0&&i.is_active).length
  const totalValue = items.reduce((s,i)=>s+Number(i.price||0)*Number(i.stock_quantity||0),0)

  const inp = { width:"100%", background:"#f8f8f8", border:"1px solid #e5e5e5", borderRadius:8, padding:"10px 12px", color:"#000", fontSize:13, outline:"none", fontFamily:"DM Sans,sans-serif", marginBottom:10 }
  const lbl = { fontSize:11, color:"#666", display:"block", marginBottom:4, textTransform:"uppercase", letterSpacing:"0.05em" }

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"1.25rem", flexWrap:"wrap", gap:10 }}>
        <div>
          <div style={{ fontFamily:"Syne", fontSize:isMobile?16:20, fontWeight:800, color:"#000" }}>Inventory</div>
          <div style={{ fontSize:12, color:"#777" }}>Manage your parts, accessories and products</div>
        </div>
        <button onClick={()=>{ setShowForm(true); setEditing(null); setForm(EMPTY); setPhotoPreview(null) }}
          style={{ background:"linear-gradient(135deg,#e6821e,#f09840)", border:"none", borderRadius:10, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"10px 20px", cursor:"pointer", boxShadow:"0 4px 12px rgba(230,130,30,0.3)" }}>
          + Add item
        </button>
      </div>

      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, marginBottom:"1.25rem" }}>
        {[
          { label:"Total", value:totalItems, color:"#000", bg:"#f8f8f8" },
          { label:"Active", value:activeItems, color:"#1d9e75", bg:"#f0fdf4" },
          { label:"Low stock", value:lowStock, color:lowStock>0?"#e6821e":"#888", bg:lowStock>0?"#fff8f0":"#f8f8f8" },
          { label:"Out of stock", value:outOfStock, color:outOfStock>0?"#e24b4a":"#888", bg:outOfStock>0?"#fff5f5":"#f8f8f8" },
        ].map(s=>(
          <div key={s.label} style={{ background:s.bg, borderRadius:12, padding:"0.75rem", border:"1px solid #eeeeee", textAlign:"center" }}>
            <div style={{ fontFamily:"Syne", fontSize:isMobile?16:20, fontWeight:800, color:s.color }}>{s.value}</div>
            <div style={{ fontSize:10, color:"#888", marginTop:2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Stock value banner */}
      <div style={{ background:"linear-gradient(135deg,#e6821e,#f09840)", borderRadius:12, padding:"0.85rem 1.25rem", marginBottom:"1.25rem", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div style={{ fontSize:12, color:"rgba(255,255,255,0.85)" }}>Total stock value</div>
        <div style={{ fontFamily:"Syne", fontSize:18, fontWeight:800, color:"#fff" }}>KES {totalValue.toLocaleString()}</div>
      </div>

      {/* Alerts */}
      {(lowStock>0||outOfStock>0)&&(
        <div style={{ background:"#fff8f0", border:"1px solid #e6821e30", borderRadius:10, padding:"0.75rem 1rem", marginBottom:"1rem", display:"flex", gap:8, alignItems:"center" }}>
          <span style={{ fontSize:16 }}>⚠️</span>
          <div style={{ fontSize:12, color:"#e6821e" }}>
            {outOfStock>0&&<span style={{ color:"#e24b4a", fontWeight:600 }}>{outOfStock} out of stock</span>}
            {outOfStock>0&&lowStock>0&&" · "}
            {lowStock>0&&<span>{lowStock} low on stock</span>}
          </div>
        </div>
      )}

      {/* Add/Edit Form */}
      {showForm&&(
        <div style={{ background:"#ffffff", border:"1px solid #e6821e30", borderRadius:14, padding:"1.25rem", marginBottom:"1.5rem", boxShadow:"0 4px 16px rgba(230,130,30,0.1)" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1.25rem" }}>
            <div style={{ fontFamily:"Syne", fontSize:15, fontWeight:800, color:"#000" }}>{editing?"✏️ Edit item":"📦 Add new item"}</div>
            <button onClick={()=>{ setShowForm(false); setEditing(null); setForm(EMPTY); setPhotoPreview(null) }}
              style={{ background:"#f0f0f0", border:"none", borderRadius:"50%", width:30, height:30, cursor:"pointer", fontSize:16, display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
          </div>
          <form onSubmit={save}>
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:10 }}>
              <div>
                <label style={lbl}>Item name *</label>
                <input style={inp} value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} required placeholder="e.g. Toyota Vitz Brake Pads"/>
              </div>
              <div>
                <label style={lbl}>Brand</label>
                <input style={inp} value={form.brand} onChange={e=>setForm(f=>({...f,brand:e.target.value}))} placeholder="e.g. Bosch, Genuine Toyota"/>
              </div>
              <div>
                <label style={lbl}>Category</label>
                <select style={inp} value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}>
                  {CATEGORIES.map(c=><option key={c.key} value={c.key}>{c.icon} {c.label}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Subcategory</label>
                <input style={inp} value={form.subcategory} onChange={e=>setForm(f=>({...f,subcategory:e.target.value}))} placeholder="e.g. Front brake pads"/>
              </div>
              <div>
                <label style={lbl}>Price (KES) *</label>
                <input type="number" style={inp} value={form.price} onChange={e=>setForm(f=>({...f,price:e.target.value}))} required placeholder="0" min="0"/>
              </div>
              <div>
                <label style={lbl}>Stock & unit</label>
                <div style={{ display:"flex", gap:6 }}>
                  <input type="number" style={{...inp, marginBottom:0, flex:1}} value={form.stock_quantity} onChange={e=>setForm(f=>({...f,stock_quantity:e.target.value}))} placeholder="0" min="0"/>
                  <select style={{...inp, marginBottom:0, width:"auto"}} value={form.unit} onChange={e=>setForm(f=>({...f,unit:e.target.value}))}>
                    {UNITS.map(u=><option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div>
              <label style={lbl}>Compatible cars</label>
              <input style={inp} value={form.compatible_cars} onChange={e=>setForm(f=>({...f,compatible_cars:e.target.value}))} placeholder="e.g. Toyota Vitz, Toyota Axio, Toyota Fielder"/>
            </div>
            <div>
              <label style={lbl}>Description</label>
              <textarea style={{...inp, resize:"vertical", minHeight:70}} value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="Describe this item..."/>
            </div>

            {/* Photo upload */}
            <div style={{ marginBottom:12 }}>
              <label style={lbl}>Item photo</label>
              {(photoPreview||form.photos?.[0])&&(
                <div style={{ position:"relative", marginBottom:8 }}>
                  <img src={photoPreview||form.photos[0]} alt="Preview" style={{ width:"100%", maxHeight:160, objectFit:"cover", borderRadius:10 }}/>
                  <button type="button" onClick={()=>{ setPhotoPreview(null); setForm(f=>({...f,photos:[]})); if(photoRef.current) photoRef.current.value="" }}
                    style={{ position:"absolute", top:6, right:6, background:"rgba(0,0,0,0.5)", border:"none", borderRadius:"50%", width:24, height:24, color:"#fff", fontSize:12, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
                </div>
              )}
              <label style={{ display:"block", width:"100%", background:"#f8f8f8", border:"2px dashed #e5e5e5", borderRadius:10, padding:"12px", color:"#888", fontSize:12, cursor:"pointer", textAlign:"center" }}>
                {uploadingPhoto?"⏳ Uploading...":"📷 " +(photoPreview||form.photos?.[0]?"Tap to change photo":"Tap to upload photo")}
                <input ref={photoRef} type="file" accept="image/*" style={{ display:"none" }}
                  onChange={e=>{ const f=e.target.files[0]; if(f) setPhotoPreview(URL.createObjectURL(f)) }}/>
              </label>
            <div style={{ marginBottom:12 }}>
              <label style={lbl}>Video (optional)</label>
              {form.video_url&&(
                <div style={{ position:"relative", marginBottom:8 }}>
                  <video src={form.video_url} controls style={{ width:"100%", maxHeight:160, borderRadius:10 }}/>
                  <button type="button" onClick={()=>setForm(f=>({...f,video_url:""}))}
                    style={{ position:"absolute", top:6, right:6, background:"rgba(0,0,0,0.5)", border:"none", borderRadius:"50%", width:24, height:24, color:"#fff", fontSize:12, cursor:"pointer" }}>×</button>
                </div>
              )}
              <label style={{ display:"block", width:"100%", background:"#f8f8f8", border:"2px dashed #e5e5e5", borderRadius:10, padding:"12px", color:"#888", fontSize:12, cursor:"pointer", textAlign:"center" }}>
                {uploadingVideo?"⏳ Uploading video...":"🎥 " +(form.video_url?"Tap to change video":"Tap to upload video (max 50MB)")}
                <input type="file" accept="video/*" style={{ display:"none" }} onChange={async e=>{
                  const file = e.target.files[0]
                  if (!file) return
                  if (file.size > 50*1024*1024) return toast.error("Video must be under 50MB")
                  setUploadingVideo(true)
                  try {
                    const ext = file.name.split(".").pop()
                    const path = user.id + "/video-" + Date.now() + "." + ext
                    const { error } = await supabase.storage.from("provider-photos").upload(path, file, { upsert:true })
                    if (error) throw error
                    const { data } = supabase.storage.from("provider-photos").getPublicUrl(path)
                    setForm(f=>({...f,video_url:data.publicUrl}))
                    toast.success("Video uploaded!")
                  } catch(e) { toast.error(e.message) }
                  finally { setUploadingVideo(false) }
                }}/>
              </label>
            </div>
            </div>

            <div style={{ display:"flex", gap:8 }}>
              <button type="submit" disabled={saving}
                style={{ flex:1, background:saving?"#ccc":"linear-gradient(135deg,#e6821e,#f09840)", border:"none", borderRadius:10, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:14, fontWeight:700, padding:"12px", cursor:saving?"not-allowed":"pointer", boxShadow:"0 4px 12px rgba(230,130,30,0.3)" }}>
                {saving?"Saving...":(editing?"Update item":"Add item")}
              </button>
              <button type="button" onClick={()=>{ setShowForm(false); setEditing(null); setForm(EMPTY); setPhotoPreview(null) }}
                style={{ background:"none", border:"1px solid #ddd", borderRadius:10, color:"#666", fontSize:13, padding:"12px 20px", cursor:"pointer" }}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search and filter */}
      <div style={{ marginBottom:"1rem" }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by name, brand..."
          style={{ width:"100%", background:"#ffffff", border:"1px solid #e5e5e5", borderRadius:10, padding:"10px 14px", color:"#000", fontSize:13, outline:"none", marginBottom:10 }}/>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
          <button onClick={()=>setCatFilter("all")}
            style={{ padding:"6px 12px", borderRadius:8, border:"none", fontSize:11, cursor:"pointer", background:catFilter==="all"?"#e6821e":"#f0f0f0", color:catFilter==="all"?"#fff":"#555", fontWeight:catFilter==="all"?700:400 }}>
            🔍 All
          </button>
          {CATEGORIES.map(c=>(
            <button key={c.key} onClick={()=>setCatFilter(c.key)}
              style={{ padding:"6px 12px", borderRadius:8, border:"none", fontSize:11, cursor:"pointer", background:catFilter===c.key?"#e6821e":"#f0f0f0", color:catFilter===c.key?"#fff":"#555", fontWeight:catFilter===c.key?700:400 }}>
              {c.icon} {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Items count */}
      {!loading&&<div style={{ fontSize:11, color:"#888", marginBottom:10 }}>{filtered.length} item{filtered.length!==1?"s":""} {catFilter!=="all"?"in "+catFilter:""}</div>}

      {loading&&<div style={{ color:"#777", fontSize:13, textAlign:"center", padding:"2rem" }}>Loading inventory...</div>}
      {!loading&&filtered.length===0&&(
        <div style={{ textAlign:"center", padding:"3rem", color:"#888" }}>
          <div style={{ fontSize:40, marginBottom:10 }}>📦</div>
          <div style={{ fontSize:14, fontWeight:600, color:"#555", marginBottom:6 }}>No items found</div>
          <div style={{ fontSize:12 }}>Add your first item or try a different filter</div>
        </div>
      )}

      {/* Items list */}
      {filtered.map(item=>(
        <div key={item.id} style={{ background:"#ffffff", border:"1px solid "+(item.stock_quantity===0?"#e24b4a20":item.stock_quantity<=5?"#e6821e20":"#eeeeee"), borderRadius:12, padding:"1rem", marginBottom:10, opacity:item.is_active?1:0.6 }}>
          <div style={{ display:"flex", gap:12, alignItems:"flex-start" }}>
            {/* Photo */}
            <div style={{ width:60, height:60, borderRadius:10, overflow:"hidden", flexShrink:0, background:"#f8f8f8", border:"1px solid #eee", display:"flex", alignItems:"center", justifyContent:"center", fontSize:24 }}>
              {item.photos?.[0] ? <img src={item.photos[0]} alt="" style={{ width:"100%", height:"100%", objectFit:"cover", cursor:"zoom-in" }} onClick={()=>setLightbox({ open:true, photos:item.photos, index:0 })}/> : CATEGORIES.find(c=>c.key===item.category)?.icon||"📦"}
            </div>

            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 }}>
                <div style={{ flex:1, minWidth:0, marginRight:8 }}>
                  <div style={{ fontSize:14, fontWeight:700, color:"#000", marginBottom:2 }}>{item.name}</div>
                  <div style={{ display:"flex", gap:4, flexWrap:"wrap", marginBottom:4 }}>
                    {item.brand&&<span style={{ fontSize:10, color:"#555", background:"#f5f5f5", padding:"2px 7px", borderRadius:6 }}>{item.brand}</span>}
                    <span style={{ fontSize:10, color:"#888", background:"#f5f5f5", padding:"2px 7px", borderRadius:6 }}>{CATEGORIES.find(c=>c.key===item.category)?.icon} {item.category}</span>
                    {!item.is_active&&<span style={{ fontSize:10, color:"#888", background:"#f5f5f5", padding:"2px 7px", borderRadius:6 }}>Hidden</span>}
                    {item.stock_quantity===0&&<span style={{ fontSize:10, color:"#e24b4a", background:"#fff5f5", padding:"2px 7px", borderRadius:6 }}>❌ Out of stock</span>}
                    {item.stock_quantity>0&&item.stock_quantity<=5&&<span style={{ fontSize:10, color:"#e6821e", background:"#fff8f0", padding:"2px 7px", borderRadius:6 }}>⚠️ Low: {item.stock_quantity}</span>}
                  </div>
                  {item.compatible_cars?.length>0&&<div style={{ fontSize:10, color:"#888" }}>🚗 {item.compatible_cars.slice(0,3).join(", ")}</div>}
                </div>
                <div style={{ textAlign:"right", flexShrink:0 }}>
                  <div style={{ fontFamily:"Syne", fontSize:16, fontWeight:800, color:"#e6821e" }}>KES {Number(item.price).toLocaleString()}</div>
                  <div style={{ fontSize:10, color:"#888" }}>per {item.unit}</div>
                </div>
              </div>

              {/* Stock stepper */}
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
                <div style={{ fontSize:11, color:"#666" }}>Stock:</div>
                <div style={{ display:"flex", alignItems:"center", gap:6, background:"#f8f8f8", borderRadius:8, padding:"4px 8px" }}>
                  <button onClick={()=>updateStock(item.id, Math.max(0,item.stock_quantity-1))}
                    style={{ background:"none", border:"none", color:"#e24b4a", cursor:"pointer", fontSize:16, lineHeight:1, padding:"0 4px", fontWeight:700 }}>−</button>
                  <span style={{ fontSize:13, fontWeight:700, color:"#000", minWidth:24, textAlign:"center" }}>{item.stock_quantity}</span>
                  <button onClick={()=>updateStock(item.id, item.stock_quantity+1)}
                    style={{ background:"none", border:"none", color:"#1d9e75", cursor:"pointer", fontSize:16, lineHeight:1, padding:"0 4px", fontWeight:700 }}>+</button>
                  <span style={{ fontSize:10, color:"#888" }}>{item.unit}s</span>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                <button onClick={()=>startEdit(item)}
                  style={{ background:"#eff6ff", border:"1px solid #378add40", borderRadius:7, color:"#378add", fontSize:11, fontWeight:600, padding:"5px 12px", cursor:"pointer" }}>
                  ✏️ Edit
                </button>
                <button onClick={()=>toggleActive(item)}
                  style={{ background:item.is_active?"#fff8f0":"#f0fdf4", border:"1px solid "+(item.is_active?"#e6821e40":"#1d9e7540"), borderRadius:7, color:item.is_active?"#e6821e":"#1d9e75", fontSize:11, fontWeight:600, padding:"5px 12px", cursor:"pointer" }}>
                  {item.is_active?"👁 Hide":"👁 Show"}
                </button>
                <button onClick={()=>deleteItem(item.id)}
                  style={{ background:"#fff5f5", border:"1px solid #e24b4a30", borderRadius:7, color:"#e24b4a", fontSize:11, fontWeight:600, padding:"5px 12px", cursor:"pointer" }}>
                  🗑 Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}
      {lightbox.open&&<PhotoLightbox photos={lightbox.photos} currentIndex={lightbox.index} onClose={()=>setLightbox(l=>({...l,open:false}))} onPrev={()=>setLightbox(l=>({...l,index:Math.max(0,l.index-1)}))} onNext={()=>setLightbox(l=>({...l,index:Math.min(l.photos.length-1,l.index+1)}))}/>}
    </div>
  )
}
