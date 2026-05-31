import useIsMobile from "../../lib/useIsMobile"
import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import { useNavigate } from "react-router-dom"
import toast from "react-hot-toast"

export default function CustomerFavorites() {
  const isMobile = useIsMobile()
  const { user } = useAuth()
  const [favorites, setFavorites] = useState([])
  const [services, setServices] = useState({})
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => { if (user) load() }, [user])

  async function load() {
    const { data: favs } = await supabase.from("favorites")
      .select("*, profile_public!favorites_provider_id_fkey(id,first_name,last_name,business_name,city,is_verified,is_online)")
      .eq("customer_id", user.id)
      .order("created_at", { ascending:false })

    setFavorites(favs||[])

    if (favs && favs.length > 0) {
      const providerIds = favs.map(f=>f.provider_id)
      const { data: svcs } = await supabase.from("services")
        .select("provider_id,id,name,price,discounted_price,duration,category")
        .in("provider_id", providerIds)
        .eq("is_active", true)
      const map = {}
      ;(svcs||[]).forEach(s => {
        if (!map[s.provider_id]) map[s.provider_id] = []
        map[s.provider_id].push(s)
      })
      setServices(map)
    }
    setLoading(false)
  }

  async function removeFavorite(providerId) {
    await supabase.from("favorites").delete().eq("customer_id", user.id).eq("provider_id", providerId)
    toast.success("Removed from favorites")
    load()
  }

  if (loading) return <div style={{ color:"#555", fontSize:13 }}>Loading...</div>

  return (
    <div>
      <div style={{ marginBottom:"1.25rem" }}>
        <div style={{ fontFamily:"Syne", fontSize:20, fontWeight:800, color:"#f0ede6" }}>
          Favorite <span style={{ color:"#e6821e" }}>Providers</span>
        </div>
        <div style={{ fontSize:12, color:"#555", marginTop:2 }}>{favorites.length} saved provider{favorites.length!==1?"s":""}</div>
      </div>

      {favorites.length===0&&(
        <div style={{ background:"#111", border:"1px solid #1e1e1e", borderRadius:12, padding:"3rem", textAlign:"center" }}>
          <div style={{ fontSize:36, marginBottom:12 }}>❤️</div>
          <div style={{ fontSize:14, color:"#555", marginBottom:4 }}>No favorites yet</div>
          <div style={{ fontSize:12, color:"#444", marginBottom:"1.5rem" }}>Save providers you love for quick rebooking</div>
          <button onClick={()=>navigate("/dashboard/discover")}
            style={{ background:"#e6821e", border:"none", borderRadius:8, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"10px 20px", cursor:"pointer" }}>
            Discover providers
          </button>
        </div>
      )}

      <div style={{ display:"grid", gap:12 }}>
        {favorites.map(f=>{
          const p = f.profile_public
          const provServices = services[f.provider_id]||[]
          const displayName = p?.business_name || `${p?.first_name||""} ${p?.last_name||""}`.trim() || "Provider"
          return (
            <div key={f.id} style={{ background:"#111", border:"1px solid #1e1e1e", borderRadius:12, padding:"1.25rem" }}>
              <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:12 }}>
                <div style={{ width:52, height:52, borderRadius:12, background:"#1a1208", border:"1px solid #e6821e30", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"Syne", fontSize:20, fontWeight:800, color:"#e6821e", flexShrink:0 }}>
                  {displayName[0]?.toUpperCase()}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:2, flexWrap:"wrap" }}>
                    <div style={{ fontFamily:"Syne", fontSize:15, fontWeight:800, color:"#f0ede6" }}>{displayName}</div>
                    {p?.is_verified&&<span style={{ fontSize:10, color:"#1d9e75", background:"#071a12", padding:"1px 6px", borderRadius:10 }}>✓ Verified</span>}
                    <span style={{ fontSize:10, padding:"1px 6px", borderRadius:10, background:p?.is_online?"#071a12":"#1a1a1a", color:p?.is_online?"#1d9e75":"#555" }}>
                      {p?.is_online?"● Online":"○ Offline"}
                    </span>
                  </div>
                  {p?.city&&<div style={{ fontSize:11, color:"#555" }}>📍 {p.city}</div>}
                </div>
                <button onClick={()=>removeFavorite(f.provider_id)}
                  style={{ background:"#1a0808", border:"1px solid #e24b4a40", borderRadius:8, color:"#e24b4a", fontSize:11, padding:"6px 10px", cursor:"pointer", flexShrink:0 }}>
                  ♥ Remove
                </button>
              </div>

              {provServices.length>0&&(
                <div style={{ marginBottom:12 }}>
                  <div style={{ fontSize:11, color:"#555", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:8 }}>Services</div>
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                    {provServices.slice(0,4).map(s=>(
                      <span key={s.id} style={{ fontSize:11, padding:"4px 10px", borderRadius:6, background:"#1a1a1a", color:"#888", border:"1px solid #222" }}>
                        {s.name} · ${Number(s.discounted_price||s.price).toFixed(0)}
                      </span>
                    ))}
                    {provServices.length>4&&<span style={{ fontSize:11, padding:"4px 10px", borderRadius:6, background:"#1a1a1a", color:"#555" }}>+{provServices.length-4} more</span>}
                  </div>
                </div>
              )}

              <div style={{ display:"flex", gap:8 }}>
                <button onClick={()=>navigate("/dashboard/services")}
                  style={{ background:"#e6821e", border:"none", borderRadius:8, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:12, fontWeight:700, padding:"8px 16px", cursor:"pointer" }}>
                  Book now
                </button>
                <button onClick={()=>navigate("/dashboard/discover")}
                  style={{ background:"none", border:"1px solid #333", borderRadius:8, color:"#888", fontSize:12, padding:"8px 16px", cursor:"pointer" }}>
                  View profile
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}



