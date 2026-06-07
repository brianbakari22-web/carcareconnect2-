import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import { useNavigate } from "react-router-dom"
import useIsMobile from "../../lib/useIsMobile"
import toast from "react-hot-toast"

export default function ProviderStorefront({ provider, onClose, onBook }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [services, setServices] = useState([])
  const [inventory, setInventory] = useState([])
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [activePhoto, setActivePhoto] = useState(0)
  const [tab, setTab] = useState("about")

  useEffect(() => { load() }, [provider.id])

  async function load() {
    const [{ data: svcs }, { data: inv }, { data: revs }] = await Promise.all([
      supabase.from("services").select("*").eq("provider_id", provider.id).eq("is_active", true),
      supabase.from("inventory").select("*").eq("provider_id", provider.id).eq("is_active", true).gt("stock_quantity", 0),
      supabase.from("reviews").select("*, profiles!reviews_customer_id_fkey(first_name,last_name)").eq("provider_id", provider.id).order("created_at",{ascending:false}).limit(5),
    ])
    setServices(svcs||[])
    setInventory(inv||[])
    setReviews(revs||[])
    setLoading(false)
  }

  const photos = provider.business_photos?.length > 0 ? provider.business_photos : []
  const avgRating = reviews.length ? (reviews.reduce((s,r)=>s+Number(r.provider_rating||0),0)/reviews.length).toFixed(1) : "—"
  const isInventoryProvider = ["parts_dealer","accessories_shop","tyre_shop"].includes(provider.provider_type)
  const PROVIDER_TYPE_ICONS = { garage:"🔧", garage_premium:"🚗", parts_dealer:"⚙️", accessories_shop:"✨", tyre_shop:"🛞", auto_electrician:"⚡", car_wash:"🚿", panel_beater:"🔨", auto_glass:"🪟" }

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.9)", zIndex:300, overflowY:"auto" }}>
      <div style={{ maxWidth:600, margin:"0 auto", background:"#ffffff", minHeight:"100vh" }}>
        
        {/* Header */}
        <div style={{ position:"sticky", top:0, zIndex:10, background:"#ffffff", padding:"0.75rem 1rem", display:"flex", justifyContent:"space-between", alignItems:"center", borderBottom:"1px solid #eeeeee" }}>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"#555555", fontSize:22, cursor:"pointer", padding:"0 8px" }}>←</button>
          <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, color:"#000000" }}>{provider.business_name||`${provider.first_name} ${provider.last_name}`}</div>
          <div style={{ width:40 }}/>
        </div>

        {/* Photo Gallery */}
        {photos.length > 0 ? (
          <div style={{ position:"relative", height:220, overflow:"hidden" }}>
            <img src={photos[activePhoto]} alt="Business" style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
            {photos.length > 1 && (
              <>
                <button onClick={()=>setActivePhoto(p=>Math.max(0,p-1))} style={{ position:"absolute", left:8, top:"50%", transform:"translateY(-50%)", background:"rgba(0,0,0,0.6)", border:"none", borderRadius:"50%", width:32, height:32, color:"#fff", cursor:"pointer", fontSize:16 }}>‹</button>
                <button onClick={()=>setActivePhoto(p=>Math.min(photos.length-1,p+1))} style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)", background:"rgba(0,0,0,0.6)", border:"none", borderRadius:"50%", width:32, height:32, color:"#fff", cursor:"pointer", fontSize:16 }}>›</button>
                <div style={{ position:"absolute", bottom:8, left:0, right:0, display:"flex", gap:4, justifyContent:"center" }}>
                  {photos.map((_,i)=>(
                    <div key={i} onClick={()=>setActivePhoto(i)} style={{ width:6, height:6, borderRadius:"50%", background:i===activePhoto?"#e6821e":"#666", cursor:"pointer" }}/>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          <div style={{ height:120, background:`linear-gradient(135deg,#1a1208,#111)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:48 }}>
            {PROVIDER_TYPE_ICONS[provider.provider_type]||"🔧"}
          </div>
        )}

        {/* Provider Info */}
        <div style={{ padding:"1.25rem" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
            <div>
              <div style={{ fontFamily:"Syne", fontSize:20, fontWeight:800, color:"#000000", marginBottom:4 }}>
                {provider.business_name||`${provider.first_name} ${provider.last_name}`}
              </div>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
                <span style={{ fontSize:12, color:"#e6821e", background:"#1a1208", padding:"2px 8px", borderRadius:8 }}>
                  {PROVIDER_TYPE_ICONS[provider.provider_type]} {provider.provider_type?.replace(/_/g," ")}
                </span>
                {provider.is_verified&&<span style={{ fontSize:11, color:"#1d9e75" }}>✓ Verified</span>}
                {provider.city&&<span style={{ fontSize:11, color:"#777777" }}>📍 {provider.city}</span>}
              </div>
            </div>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontFamily:"Syne", fontSize:22, fontWeight:800, color:"#e6821e" }}>{avgRating}</div>
              <div style={{ fontSize:10, color:"#777777" }}>⭐ {reviews.length} reviews</div>
            </div>
          </div>

          {/* CTA Buttons */}
          <div style={{ display:"flex", gap:8, marginBottom:"1.5rem" }}>
            {!isInventoryProvider&&(
              <button onClick={()=>{ onClose(); navigate("/dashboard/services") }}
                style={{ flex:1, background:"#e6821e", border:"none", borderRadius:10, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:14, fontWeight:700, padding:"12px", cursor:"pointer" }}>
                Book service
              </button>
            )}
            {isInventoryProvider&&(
              <button onClick={()=>{ onClose(); navigate("/dashboard/parts") }}
                style={{ flex:1, background:"#8b5cf6", border:"none", borderRadius:10, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:14, fontWeight:700, padding:"12px", cursor:"pointer" }}>
                Order parts
              </button>
            )}
            <button onClick={()=>{ onClose(); navigate("/dashboard/chat") }}
              style={{ background:"#ffffff", border:"1px solid #dddddd", borderRadius:10, color:"#555555", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"12px 16px", cursor:"pointer" }}>
              💬 Chat
            </button>
          </div>

          {/* Tabs */}
          <div style={{ display:"flex", gap:6, marginBottom:"1.25rem" }}>
            {[
              { k:"about", l:"About" },
              { k:"services", l:`Services (${services.length})` },
              ...(isInventoryProvider?[{ k:"inventory", l:`Products (${inventory.length})` }]:[]),
              { k:"reviews", l:`Reviews (${reviews.length})` },
            ].map(t=>(
              <button key={t.k} onClick={()=>setTab(t.k)}
                style={{ padding:"7px 14px", borderRadius:8, border:"none", fontSize:12, cursor:"pointer", background:tab===t.k?"#e6821e":"#111", color:tab===t.k?"#fff":"#666", fontWeight:tab===t.k?700:400 }}>
                {t.l}
              </button>
            ))}
          </div>

          {/* About */}
          {tab==="about"&&(
            <div>
              {provider.bio&&<p style={{ fontSize:13, color:"#555555", lineHeight:1.7, marginBottom:12 }}>{provider.bio}</p>}
              <div style={{ background:"#ffffff", borderRadius:10, padding:"1rem" }}>
                {[
                  { label:"Business type", value:(PROVIDER_TYPE_ICONS[provider.provider_type]||"")+" "+(provider.provider_type?.replace(/_/g," ")||"—") },
                  { label:"Location", value:provider.city||"—" },
                  { label:"Rating", value:`${avgRating} ⭐ (${reviews.length} reviews)` },
                  { label:"Services", value:services.length+" services listed" },
                  { label:"Verified", value:provider.is_verified?"✓ Yes":"Pending" },
                ].map(f=>(
                  <div key={f.label} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:"1px solid #eeeeee" }}>
                    <span style={{ fontSize:12, color:"#777777" }}>{f.label}</span>
                    <span style={{ fontSize:12, color:"#000000" }}>{f.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Services */}
          {tab==="services"&&(
            <div>
              {services.length===0&&<div style={{ color:"#888888", fontSize:13, textAlign:"center", padding:"2rem" }}>No services listed yet</div>}
              {services.map(s=>(
                <div key={s.id} style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:10, padding:"1rem", marginBottom:8 }}>
                  {s.photos?.[0]&&<img src={s.photos[0]} alt={s.name} style={{ width:"100%", height:120, objectFit:"cover", borderRadius:8, marginBottom:8 }}/>}
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                    <div>
                      <div style={{ fontSize:14, fontWeight:600, color:"#000000", marginBottom:2 }}>{s.name}</div>
                      {s.description&&<div style={{ fontSize:11, color:"#666", marginBottom:4 }}>{s.description}</div>}
                      <div style={{ fontSize:11, color:"#777777" }}>⏱ {s.duration_minutes||60} min</div>
                    </div>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontFamily:"Syne", fontSize:15, fontWeight:800, color:"#e6821e" }}>KES {Number(s.price||0).toLocaleString()}</div>
                      <button onClick={()=>{ onClose(); navigate("/dashboard/services") }}
                        style={{ marginTop:6, background:"#e6821e", border:"none", borderRadius:7, color:"#fff", fontSize:11, fontWeight:700, padding:"5px 12px", cursor:"pointer" }}>
                        Book
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Inventory */}
          {tab==="inventory"&&(
            <div>
              {inventory.length===0&&<div style={{ color:"#888888", fontSize:13, textAlign:"center", padding:"2rem" }}>No products listed yet</div>}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                {inventory.map(item=>(
                  <div key={item.id} style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:10, padding:"0.75rem", cursor:"pointer" }}
                    onClick={()=>{ onClose(); navigate("/dashboard/parts") }}>
                    {item.photos?.[0]&&<img src={item.photos[0]} alt={item.name} style={{ width:"100%", height:90, objectFit:"cover", borderRadius:6, marginBottom:6 }}/>}
                    <div style={{ fontSize:12, fontWeight:600, color:"#000000", marginBottom:2 }}>{item.name}</div>
                    {item.brand&&<div style={{ fontSize:10, color:"#555555", marginBottom:2 }}>{item.brand}</div>}
                    <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:800, color:"#e6821e" }}>KES {Number(item.price).toLocaleString()}</div>
                    <div style={{ fontSize:10, color:item.stock_quantity>5?"#1d9e75":"#e24b4a" }}>{item.stock_quantity} in stock</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reviews */}
          {tab==="reviews"&&(
            <div>
              {reviews.length===0&&<div style={{ color:"#888888", fontSize:13, textAlign:"center", padding:"2rem" }}>No reviews yet</div>}
              {reviews.map(r=>(
                <div key={r.id} style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:10, padding:"1rem", marginBottom:8 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                    <div style={{ fontSize:12, fontWeight:600, color:"#000000" }}>{r.profiles?.first_name} {r.profiles?.last_name?.[0]}.</div>
                    <div style={{ fontSize:12, color:"#e6821e" }}>{"⭐".repeat(Math.round(r.provider_rating||0))}</div>
                  </div>
                  {r.provider_comment&&<div style={{ fontSize:12, color:"#555555", lineHeight:1.6 }}>{r.provider_comment}</div>}
                  <div style={{ fontSize:10, color:"#888888", marginTop:4 }}>{new Date(r.created_at).toLocaleDateString()}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


