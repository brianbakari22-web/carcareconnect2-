import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { supabase } from "../../lib/supabase"
import { openExternal } from "../../lib/openExternal"

export default function PublicProviderStorefront() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [provider, setProvider] = useState(null)
  const [services, setServices] = useState([])
  const [bundles, setBundles] = useState([])
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [id])

  async function load() {
    const [{ data: prof }, { data: svcs }, { data: bds }, { data: revs }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", id).eq("role","provider").single(),
      supabase.from("services").select("*").eq("provider_id", id).eq("is_active", true),
      supabase.from("service_bundles").select("*").eq("provider_id", id).eq("is_active", true),
      supabase.from("reviews").select("provider_rating, provider_review, created_at").eq("provider_id", id).order("created_at",{ascending:false}).limit(10),
    ])
    setProvider(prof||null)
    setServices(svcs||[])
    setBundles(bds||[])
    setReviews(revs||[])
    setLoading(false)
  }

  function handleBook() {
    navigate(`/auth?redirect=/dashboard/services`)
  }

  function shareWhatsApp() {
    const url = window.location.href
    const text = `Check out ${provider?.business_name||`${provider?.first_name} ${provider?.last_name}`} on Car Care Connect! ${url}`
    openExternal(`https://wa.me/?text=${encodeURIComponent(text)}`)
  }

  if (loading) {
    return <div style={{ padding:"2rem", textAlign:"center", color:"#888", fontFamily:"'DM Sans',sans-serif" }}>Loading...</div>
  }

  if (!provider) {
    return (
      <div style={{ padding:"2rem", textAlign:"center", fontFamily:"'DM Sans',sans-serif" }}>
        <div style={{ fontSize:32, marginBottom:10 }}>🔍</div>
        <div style={{ color:"#888" }}>Provider not found</div>
        <a href="/" style={{ color:"#e6821e", textDecoration:"none", fontSize:13 }}>← Back to Car Care Connect</a>
      </div>
    )
  }

  const avgRating = reviews.length > 0 
    ? (reviews.reduce((sum,r)=>sum+(r.provider_rating||0),0) / reviews.length).toFixed(1) 
    : null

  const displayName = provider.business_name || `${provider.first_name} ${provider.last_name}`

  return (
    <div style={{ maxWidth:680, margin:"0 auto", padding:"1.5rem 1rem", fontFamily:"'DM Sans',sans-serif", color:"#000" }}>
      <a href="/" style={{ display:"inline-flex", alignItems:"center", gap:6, color:"#e6821e", textDecoration:"none", fontSize:13, fontWeight:700, marginBottom:"1.5rem" }}>
        🚗 Car Care Connect
      </a>

      <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:"1.5rem" }}>
        <div style={{ width:64, height:64, borderRadius:14, background:"#fff8f0", border:"2px solid #e6821e40", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"Syne", fontSize:26, fontWeight:800, color:"#e6821e", flexShrink:0 }}>
          {displayName[0]?.toUpperCase()}
        </div>
        <div>
          <div style={{ fontFamily:"Syne", fontSize:20, fontWeight:800 }}>
            {displayName}
            {provider.is_verified&&<span style={{ marginLeft:8, fontSize:12, color:"#1d9e75" }}>✓ Verified</span>}
          </div>
          <div style={{ fontSize:13, color:"#777", marginTop:2 }}>
            {provider.provider_type?.replace(/_/g," ")}{provider.city?` · ${provider.city}`:""}
          </div>
          {avgRating&&<div style={{ fontSize:13, color:"#e6821e", marginTop:2 }}>⭐ {avgRating} ({reviews.length} reviews)</div>}
        </div>
      </div>

      <button onClick={shareWhatsApp}
        style={{ background:"#f0fdf4", border:"1px solid #1d9e7540", borderRadius:9, color:"#1d9e75", fontSize:13, fontWeight:700, padding:"10px 20px", cursor:"pointer", marginBottom:"1.5rem" }}>
        📤 Share on WhatsApp
      </button>

      {bundles.length>0&&(
        <div style={{ marginBottom:"1.5rem" }}>
          <div style={{ fontFamily:"Syne", fontSize:15, fontWeight:800, marginBottom:8, color:"#e6821e" }}>📦 Bundle Deals</div>
          {bundles.map(b=>{
            const savings = Number(b.original_price) - Number(b.bundle_price)
            const savingsPct = Math.round((savings / Number(b.original_price)) * 100)
            return (
              <div key={b.id} style={{ background:"#fff8f0", border:"1px solid #e6821e40", borderRadius:10, padding:"1rem", marginBottom:8 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"start", marginBottom:4 }}>
                  <div style={{ fontSize:14, fontWeight:700 }}>{b.name}</div>
                  <span style={{ fontSize:10, color:"#1d9e75", background:"#f0fdf4", padding:"2px 8px", borderRadius:10 }}>Save {savingsPct}%</span>
                </div>
                {b.description&&<div style={{ fontSize:12, color:"#666", marginBottom:6 }}>{b.description}</div>}
                <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                  <span style={{ fontSize:13, color:"#888", textDecoration:"line-through" }}>KES {Number(b.original_price).toLocaleString()}</span>
                  <span style={{ fontFamily:"Syne", fontSize:16, fontWeight:800, color:"#e6821e" }}>KES {Number(b.bundle_price).toLocaleString()}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div style={{ marginBottom:"1.5rem" }}>
        <div style={{ fontFamily:"Syne", fontSize:15, fontWeight:800, marginBottom:8 }}>Services</div>
        {services.length===0&&<div style={{ color:"#888", fontSize:13 }}>No services listed yet</div>}
        {services.map(s=>(
          <div key={s.id} style={{ background:"#f8f8f8", border:"1px solid #eeeeee", borderRadius:10, padding:"0.9rem", marginBottom:8 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"start" }}>
              <div>
                <div style={{ fontSize:14, fontWeight:700 }}>{s.name}</div>
                {s.description&&<div style={{ fontSize:12, color:"#666", marginTop:2 }}>{s.description.slice(0,100)}{s.description.length>100?"...":""}</div>}
              </div>
              <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:800, color:"#e6821e", flexShrink:0, marginLeft:10 }}>KES {Number(s.price).toLocaleString()}</div>
            </div>
          </div>
        ))}
      </div>

      {reviews.length>0&&(
        <div style={{ marginBottom:"1.5rem" }}>
          <div style={{ fontFamily:"Syne", fontSize:15, fontWeight:800, marginBottom:8 }}>Recent Reviews</div>
          {reviews.slice(0,5).map((r,i)=>(
            <div key={i} style={{ background:"#f8f8f8", borderRadius:10, padding:"0.75rem", marginBottom:6 }}>
              <div style={{ fontSize:12, color:"#e6821e", marginBottom:2 }}>{"⭐".repeat(r.provider_rating||0)}</div>
              {r.provider_review&&<div style={{ fontSize:12, color:"#666" }}>{r.provider_review}</div>}
            </div>
          ))}
        </div>
      )}

      <button onClick={handleBook}
        style={{ display:"block", width:"100%", background:"#e6821e", border:"none", borderRadius:10, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:14, fontWeight:700, padding:"14px", cursor:"pointer" }}>
        Book a Service →
      </button>
    </div>
  )
}
