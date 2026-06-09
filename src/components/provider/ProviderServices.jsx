import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import PhotoManager from "../shared/PhotoManager"
import { useAuth } from "../../contexts/AuthContext"
import { useLanguage } from "../../contexts/LanguageContext"
import useIsMobile from "../../lib/useIsMobile"
import toast from "react-hot-toast"

const GARAGE_CATEGORIES = [
  { key:"shop_standard", label:"Shop Standard", icon:"🏪", desc:"Customer brings car to your shop", color:"#378add", bg:"#eff6ff", border:"#bfdbfe" },
  { key:"shop_premium", label:"Shop Premium", icon:"🏡", desc:"Your mechanic goes to customer", color:"#8b5cf6", bg:"#faf5ff", border:"#e9d5ff" },
  { key:"go_service", label:"GO Service", icon:"🚨", desc:"Emergency roadside assistance", color:"#e24b4a", bg:"#fff5f5", border:"#fecaca" },
]
const WASH_CATEGORIES = [
  { key:"basic_wash", label:"Basic Wash", icon:"🚿", desc:"Exterior rinse and dry", color:"#378add", bg:"#eff6ff", border:"#bfdbfe" },
  { key:"standard_wash", label:"Standard Wash", icon:"✨", desc:"Exterior + interior clean", color:"#8b5cf6", bg:"#faf5ff", border:"#e9d5ff" },
  { key:"premium_detail", label:"Premium Detail", icon:"💎", desc:"Full detailing service", color:"#1d9e75", bg:"#f0fdf4", border:"#bbf7d0" },
]
const PANEL_CATEGORIES = [
  { key:"shop_standard", label:"In Shop", icon:"🏪", desc:"Customer brings car to shop", color:"#378add", bg:"#eff6ff", border:"#bfdbfe" },
  { key:"shop_premium", label:"On Site", icon:"🔨", desc:"Go to customer location", color:"#8b5cf6", bg:"#faf5ff", border:"#e9d5ff" },
]
function getCategories(providerType) {
  if (providerType === "car_wash") return WASH_CATEGORIES
  if (["panel_beater","auto_glass","auto_electrician"].includes(providerType)) return PANEL_CATEGORIES
  return GARAGE_CATEGORIES
}

const EMPTY = { name:"", description:"", price:"", duration_minutes:"", category:"shop_standard" }

export default function ProviderServices() {
  const { user, profile } = useAuth()
  const providerType = profile?.provider_type || "garage"
  const CATEGORIES = getCategories(providerType)
  const providerType = profile?.provider_type || "garage"
  const isInventoryProvider = ["parts_dealer","accessories_shop","tyre_shop"].includes(providerType)
  const { t } = useLanguage()
  const isMobile = useIsMobile()
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [commissionRate, setCommissionRate] = useState({ platform:10, provider:90 })
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [activeCategory, setActiveCategory] = useState("all")

  useEffect(() => {
    if (!user) return
    load()
    // Load commission rate for this provider type
    const providerType = profile?.provider_type || "garage"
    supabase.from("commission_rates").select("platform_rate,provider_rate")
      .eq("provider_type", providerType).single()
      .then(({ data }) => {
        if (data) setCommissionRate({
          platform: Math.round(data.platform_rate*100),
          provider: Math.round(data.provider_rate*100)
        })
      })
  }, [user, profile?.provider_type])

  async function load() {
    const { data } = await supabase.from("services").select("*").eq("provider_id", user.id).order("created_at", { ascending:false })
    setServices(data||[])
    setLoading(false)
  }

  async function save(e) {
    e.preventDefault()
    if (!form.name||!form.price) return toast.error("Name and price required")
    setSaving(true)

    const cat = CATEGORIES.find(c=>c.key===form.category)
    const commissionRates = { shop_standard:0.10, shop_premium:0.20, go_service:0.15 }
    const platformRate = commissionRates[form.category]
    const providerRate = 1 - platformRate

    try {
      if (editing) {
        const { error } = await supabase.from("services").update({
          name: form.name,
          description: form.description,
          price: parseFloat(form.price),
          duration_minutes: parseInt(form.duration_minutes)||60,
          category: form.category,
          platform_commission_rate: platformRate,
          provider_commission_rate: providerRate,
        }).eq("id", editing).eq("provider_id", user.id)
        if (error) throw error
        toast.success("Service updated")
      } else {
        const { error } = await supabase.from("services").insert({
          provider_id: user.id,
          name: form.name,
          description: form.description,
          price: parseFloat(form.price),
          duration_minutes: parseInt(form.duration_minutes)||60,
          category: form.category,
          platform_commission_rate: platformRate,
          provider_commission_rate: providerRate,
          is_active: true,
        })
        if (error) throw error
        toast.success("Service added")
      }
      setForm(EMPTY)
      setShowForm(false)
      setEditing(null)
      load()
    } catch(err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(id, is_active) {
    await supabase.from("services").update({ is_active:!is_active }).eq("id",id).eq("provider_id",user.id)
    load()
  }

  async function deleteService(id) {
    if (!confirm("Delete this service?")) return
    // Soft delete - deactivate service
    await supabase.from("services").update({ is_active:false }).eq("id",id).eq("provider_id",user.id)
    
    // Cancel pending bookings for this service
    const { data: pendingBookings } = await supabase
      .from("bookings")
      .select("id,customer_id,service_name")
      .eq("service_id", id)
      .in("status", ["pending","confirmed"])
    
    if (pendingBookings?.length > 0) {
      // Cancel the bookings
      await supabase.from("bookings")
        .update({ status:"cancelled", cancellation_reason:"Service no longer available" })
        .eq("service_id", id)
        .in("status", ["pending","confirmed"])
      
      // Notify each affected customer
      for (const booking of pendingBookings) {
        await supabase.from("notifications").insert({
          user_id: booking.customer_id,
          title: "Booking cancelled",
          message: `Your booking for "${booking.service_name}" has been cancelled as the service is no longer available. Please book an alternative service.`,
          type: "warning",
        })
      }
      toast.success(`Service deactivated · ${pendingBookings.length} pending booking(s) cancelled and customers notified`)
    } else {
      toast.success("Service deactivated")
    }
    toast.success("Service deleted")
    load()
  }

  function startEdit(s) {
    setEditing(s.id)
    setForm({ name:s.name, description:s.description||"", price:s.price, duration_minutes:s.duration_minutes||60, category:s.category||"shop_standard" })
    setShowForm(true)
  }

  const filtered = activeCategory==="all" ? services : services.filter(s=>s.category===activeCategory)
  const inp = { width:"100%", background:"#ffffff", border:"1px solid #e5e5e5", borderRadius:8, padding:"11px 12px", color:"#000000", fontSize:13, outline:"none", fontFamily:"'DM Sans',sans-serif" }
  const lbl = { fontSize:11, color:"#666", textTransform:"uppercase", letterSpacing:"0.05em", display:"block", marginBottom:4 }

  if (isInventoryProvider) return (
    <div style={{ textAlign:"center", padding:"3rem 1rem" }}>
      <div style={{ fontSize:48, marginBottom:16 }}>📦</div>
      <div style={{ fontFamily:"Syne", fontSize:18, fontWeight:800, color:"#000000", marginBottom:8 }}>
        {providerType==="parts_dealer"?"Parts Dealer":providerType==="tyre_shop"?"Tyre Shop":"Accessories Shop"}
      </div>
      <div style={{ fontSize:13, color:"#777777", marginBottom:"1.5rem", lineHeight:1.7 }}>
        As a {providerType.replace(/_/g," ")}, you manage your products through Inventory, not services.
        Customers browse and order your items from the Parts Marketplace.
      </div>
      <div style={{ display:"flex", gap:10, justifyContent:"center", flexWrap:"wrap" }}>
        <a href="/dashboard/inventory" style={{ background:"#8b5cf6", border:"none", borderRadius:10, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"11px 24px", textDecoration:"none" }}>
          📦 Go to Inventory
        </a>
        <a href="/dashboard/orders" style={{ background:"#ffffff", border:"1px solid #dddddd", borderRadius:10, color:"#555555", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"11px 24px", textDecoration:"none" }}>
          🛒 View Orders
        </a>
      </div>
    </div>
  )

  return (
    <div>
      {/* Category overview cards */}
      <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"repeat(3,1fr)", gap:10, marginBottom:"1.5rem" }}>
        {CATEGORIES.map(c=>(
          <div key={c.key} style={{ background:c.bg, border:`1px solid ${c.border}`, borderRadius:12, padding:"1rem" }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
              <span style={{ fontSize:20 }}>{c.icon}</span>
              <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:800, color:c.color }}>{c.label}</div>
            </div>
            <div style={{ fontSize:11, color:"#666", marginBottom:4 }}>{c.desc}</div>
            <div style={{ fontSize:10, color:c.color, fontWeight:600 }}>{c.commission}</div>
            <div style={{ fontSize:10, color:"#888888", marginTop:4 }}>
              {services.filter(s=>s.category===c.key).length} service{services.filter(s=>s.category===c.key).length!==1?"s":""}
            </div>
          </div>
        ))}
      </div>

      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1rem", flexWrap:"wrap", gap:10 }}>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
          {["all",...CATEGORIES.map(c=>c.key)].map(k=>(
            <button key={k} onClick={()=>setActiveCategory(k)}
              style={{ padding:"6px 12px", borderRadius:7, border:"none", fontSize:11, cursor:"pointer", background:activeCategory===k?"#e6821e":"#111", color:activeCategory===k?"#fff":"#666", fontFamily:"'DM Sans',sans-serif" }}>
              {k==="all"?"All":CATEGORIES.find(c=>c.key===k)?.label}
            </button>
          ))}
        </div>
        <button onClick={()=>{ setShowForm(true); setEditing(null); setForm(EMPTY) }}
          style={{ background:"#e6821e", border:"none", borderRadius:9, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"9px 18px", cursor:"pointer" }}>
          + Add service
        </button>
      </div>

      {/* Add/Edit form */}
      {showForm&&(
        <div style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:12, padding:"1.25rem", marginBottom:"1.5rem" }}>
          <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, marginBottom:"1rem", color:"#000000" }}>
            {editing?"Edit service":"Add new service"}
          </div>

          {/* Category selector */}
          <div style={{ marginBottom:16 }}>
            <label style={lbl}>Service category</label>
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"repeat(3,1fr)", gap:8 }}>
              {CATEGORIES.map(c=>(
                <button key={c.key} type="button" onClick={()=>setForm(f=>({...f,category:c.key}))}
                  style={{ background:form.category===c.key?c.bg:"#0f0f0f", border:`1px solid ${form.category===c.key?c.color:"#222"}`, borderRadius:9, padding:"0.75rem", cursor:"pointer", textAlign:"left" }}>
                  <div style={{ fontSize:16, marginBottom:4 }}>{c.icon}</div>
                  <div style={{ fontSize:12, fontWeight:600, color:form.category===c.key?c.color:"#666", marginBottom:2 }}>{c.label}</div>
                  <div style={{ fontSize:10, color:"#888888" }}>{c.commission}</div>
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={save}>
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:12, marginBottom:12 }}>
              <div>
                <label style={lbl}>Service name</label>
                <input style={inp} placeholder="e.g. Oil Change" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} required/>
              </div>
              <div>
                <label style={lbl}>Price (KES)</label>
                <input style={inp} type="number" placeholder="e.g. 2500" value={form.price} onChange={e=>setForm(f=>({...f,price:e.target.value}))} required min="0" step="0.01"/>
              </div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:12, marginBottom:12 }}>
              <div>
                <label style={lbl}>Duration (minutes)</label>
                <input style={inp} type="number" placeholder="60" value={form.duration_minutes} onChange={e=>setForm(f=>({...f,duration_minutes:e.target.value}))} min="15"/>
              </div>
              <div style={{ display:"flex", flexDirection:"column", justifyContent:"flex-end" }}>
                {form.category&&(
                  <div style={{ background:CATEGORIES.find(c=>c.key===form.category)?.bg||"#111", border:`1px solid ${CATEGORIES.find(c=>c.key===form.category)?.border||"#222"}`, borderRadius:8, padding:"0.6rem 0.75rem" }}>
                    <div style={{ fontSize:10, color:"#777777", marginBottom:2 }}>Commission preview</div>
                    <div style={{ fontSize:12, color:CATEGORIES.find(c=>c.key===form.category)?.color||"#888", fontWeight:600 }}>
                      {CATEGORIES.find(c=>c.key===form.category)?.commission}
                    </div>
                    {form.price&&<div style={{ fontSize:11, color:"#777777", marginTop:2 }}>
                      Your earnings: KES {(parseFloat(form.price||0)*(1-{shop_standard:0.10,shop_premium:0.20,go_service:0.15}[form.category])).toFixed(0)}
                    </div>}
                  </div>
                )}
              </div>
            </div>
            <div style={{ marginBottom:14 }}>
              <label style={lbl}>Description</label>
              <textarea style={{ ...inp, resize:"vertical", minHeight:70 }} placeholder="Describe what this service includes..." value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))}/>
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button type="submit" disabled={saving}
                style={{ background:saving?"#333":"#e6821e", border:"none", borderRadius:9, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"10px 24px", cursor:saving?"not-allowed":"pointer" }}>
                {saving?"Saving...":editing?"Update service":"Add service"}
              </button>
              <button type="button" onClick={()=>{ setShowForm(false); setEditing(null); setForm(EMPTY) }}
                style={{ background:"none", border:"1px solid #dddddd", borderRadius:9, color:"#666", fontSize:13, padding:"10px 18px", cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Services list */}
      {loading&&<div style={{ color:"#777777", fontSize:13 }}>Loading...</div>}
      {!loading&&filtered.length===0&&(
        <div style={{ color:"#888888", fontSize:13, textAlign:"center", padding:"3rem" }}>
          <div style={{ fontSize:32, marginBottom:10 }}>🔧</div>
          No services yet. Add your first service above.
        </div>
      )}

      {filtered.map(s=>{
        const cat = CATEGORIES.find(c=>c.key===s.category)||CATEGORIES[0]
        return (
          <div key={s.id} style={{ background:"#ffffff", border:`1px solid ${s.is_active?cat.border:"#1e1e1e"}`, borderRadius:10, padding:isMobile?"0.75rem":"1rem", marginBottom:8, opacity:s.is_active?1:0.6 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:10 }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4, flexWrap:"wrap" }}>
                  <span style={{ fontSize:16 }}>{cat.icon}</span>
                  <div style={{ fontSize:13, fontWeight:600, color:"#000000" }}>{s.name}</div>
                  <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, background:cat.bg, color:cat.color, border:`1px solid ${cat.border}` }}>{cat.label}</span>
                  {!s.is_active&&<span style={{ fontSize:10, color:"#777777", background:"#f5f5f5", padding:"2px 8px", borderRadius:10 }}>Inactive</span>}
                </div>
                {s.description&&<div style={{ fontSize:11, color:"#666", marginBottom:4, lineHeight:1.5 }}>{s.description}</div>}
                <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
                  <span style={{ fontSize:12, color:"#e6821e", fontFamily:"Syne", fontWeight:700 }}>KES {Number(s.price).toLocaleString()}</span>
                  <span style={{ fontSize:11, color:"#777777" }}>⏱ {s.duration_minutes||60} min</span>
                  <span style={{ fontSize:11, color:cat.color }}>{cat.key==="shop_standard"?`You keep ${commissionRate.provider}% · Platform ${commissionRate.platform}%`:cat.key==="shop_premium"?`You keep ${Math.max(commissionRate.provider-10,70)}% · Platform ${Math.min(commissionRate.platform+10,30)}%`:`You keep ${commissionRate.provider}% · Platform ${commissionRate.platform}%`}</span>
                </div>
              </div>
              <div style={{ display:"flex", gap:6, flexShrink:0, flexWrap:"wrap", justifyContent:"flex-end" }}>
                <button onClick={()=>startEdit(s)}
                  style={{ background:"#eff6ff", border:"1px solid #378add40", borderRadius:7, color:"#378add", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>
                  Edit
                </button>
                <button onClick={()=>toggleActive(s.id, s.is_active)}
                  style={{ background:s.is_active?"#1a0808":"#071a12", border:`1px solid ${s.is_active?"#e24b4a40":"#1d9e7540"}`, borderRadius:7, color:s.is_active?"#e24b4a":"#1d9e75", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>
                  {s.is_active?"Deactivate":"Activate"}
                </button>
                <button onClick={()=>{ if(confirm("Deactivate this service? Pending bookings will be cancelled and customers notified.")) deleteService(s.id) }}
                  style={{ background:"none", border:"1px solid #e24b4a20", borderRadius:7, color:"#e24b4a", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>
                  Delete
                </button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}











