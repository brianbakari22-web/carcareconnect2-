import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { supabase } from "../../lib/supabase"

export default function PublicItemPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [item, setItem] = useState(null)
  const [provider, setProvider] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [id])

  async function load() {
    const { data } = await supabase.from("inventory")
      .select("*, profiles!inventory_provider_id_fkey(first_name,last_name,business_name,city,is_verified,profile_photo_url,avatar_url)")
      .eq("id", id).single()
    if (data) {
      setItem(data)
      setProvider(data.profiles)
    }
    setLoading(false)
  }

  if (loading) return (
    <div style={{ minHeight:"100vh", background:"#fff", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ fontSize:13, color:"#888" }}>Loading...</div>
    </div>
  )

  if (!item) return (
    <div style={{ minHeight:"100vh", background:"#fff", display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:12 }}>
      <div style={{ fontSize:32 }}>🔍</div>
      <div style={{ fontSize:14, color:"#888" }}>Item not found</div>
      <button onClick={()=>navigate("/")} style={{ background:"#e6821e", border:"none", borderRadius:8, color:"#fff", padding:"10px 20px", cursor:"pointer", fontFamily:"Syne,sans-serif", fontWeight:700 }}>Go to Car Care Connect</button>
    </div>
  )

  return (
    <div style={{ minHeight:"100vh", background:"#f8f8f8", fontFamily:"DM Sans,sans-serif" }}>
      {/* Header */}
      <div style={{ background:"#e6821e", padding:"1rem 1.25rem", display:"flex", alignItems:"center", gap:12 }}>
        <div onClick={()=>navigate("/")} style={{ cursor:"pointer" }}>
          <img src="/logo.svg" alt="CCC" style={{ height:32 }}/>
        </div>
        <div style={{ color:"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700 }}>Car Care Connect</div>
      </div>

      <div style={{ maxWidth:480, margin:"0 auto", padding:"1.5rem 1rem" }}>
        <div style={{ background:"#fff", borderRadius:16, overflow:"hidden", marginBottom:"1rem", boxShadow:"0 2px 12px rgba(0,0,0,0.06)" }}>
          {item.photos?.length>0 ? (
            <img src={item.photos[0]} alt={item.name} style={{ width:"100%", height:220, objectFit:"cover" }}/>
          ) : (
            <div style={{ height:160, background:"#f0fdf4", display:"flex", alignItems:"center", justifyContent:"center", fontSize:60 }}>⚙️</div>
          )}
          <div style={{ padding:"1.25rem" }}>
            <div style={{ fontFamily:"Syne,sans-serif", fontSize:20, fontWeight:800, color:"#000", marginBottom:4 }}>{item.name}</div>
            {item.brand&&<div style={{ fontSize:12, color:"#888", marginBottom:6 }}>Brand: {item.brand}</div>}
            {item.description&&<div style={{ fontSize:13, color:"#666", lineHeight:1.6, marginBottom:12 }}>{item.description}</div>}
            <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16, flexWrap:"wrap" }}>
              <div style={{ fontFamily:"Syne,sans-serif", fontSize:22, fontWeight:800, color:"#e6821e" }}>KES {Number(item.price).toLocaleString()}</div>
              {item.stock_quantity>0 ? (
                <div style={{ fontSize:11, color:"#1d9e75", background:"#f0fdf4", padding:"3px 8px", borderRadius:10 }}>✓ In stock ({item.stock_quantity})</div>
              ) : (
                <div style={{ fontSize:11, color:"#e24b4a", background:"#fff5f5", padding:"3px 8px", borderRadius:10 }}>Out of stock</div>
              )}
            </div>
            {provider&&(
              <div style={{ display:"flex", alignItems:"center", gap:10, padding:"0.75rem", background:"#f8f8f8", borderRadius:10, marginBottom:16 }}>
                <div style={{ width:40, height:40, borderRadius:"50%", background:"#f0fdf4", border:"2px solid #1d9e7540", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"Syne,sans-serif", fontSize:14, fontWeight:800, color:"#1d9e75", flexShrink:0, overflow:"hidden" }}>
                  {provider.profile_photo_url||provider.avatar_url ? <img src={provider.profile_photo_url||provider.avatar_url} style={{ width:"100%", height:"100%", objectFit:"cover" }}/> : (provider.business_name||provider.first_name)?.[0]}
                </div>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:"#000" }}>{provider.business_name||provider.first_name+" "+provider.last_name}</div>
                  <div style={{ fontSize:11, color:"#888" }}>📍 {provider.city||"Nairobi"} {provider.is_verified?"· ✓ Verified":""}</div>
                </div>
              </div>
            )}
            <button onClick={()=>navigate(`/auth?redirect=/dashboard/parts?item=${id}`)}
              style={{ width:"100%", background:"#e6821e", border:"none", borderRadius:12, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:15, fontWeight:800, padding:"14px", cursor:"pointer" }}>
              Order This Item
            </button>
            <div style={{ fontSize:11, color:"#aaa", textAlign:"center", marginTop:8 }}>Sign in or create a free account to order</div>
          </div>
        </div>

        <div style={{ background:"#fff", borderRadius:12, padding:"1rem", textAlign:"center" }}>
          <div style={{ fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:800, color:"#000", marginBottom:4 }}>Car Care Connect</div>
          <div style={{ fontSize:11, color:"#888", marginBottom:10 }}>Nairobi's #1 auto parts marketplace</div>
          <button onClick={()=>navigate("/")} style={{ background:"#000", border:"none", borderRadius:8, color:"#fff", fontSize:12, fontWeight:700, padding:"8px 20px", cursor:"pointer", fontFamily:"Syne,sans-serif" }}>
            Browse All Parts
          </button>
        </div>
      </div>
    </div>
  )
}