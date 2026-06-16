import useIsMobile from "../../lib/useIsMobile"
import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import { useLanguage } from "../../contexts/LanguageContext"
import { useNavigate } from "react-router-dom"
import toast from "react-hot-toast"
import ProviderStorefront from "./ProviderStorefront"

const DAYS_EN = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"]
const DAYS_SW = ["Jumapili","Jumatatu","Jumanne","Jumatano","Alhamisi","Ijumaa","Jumamosi"]

export default function CustomerDiscover() {
  const isMobile = useIsMobile()
  const { user } = useAuth()
  const { t, language } = useLanguage()
  const navigate = useNavigate()
  const [providers, setProviders] = useState([])
  const [bundles, setBundles] = useState([])
  const [drivers, setDrivers] = useState([])
  const [services, setServices] = useState([])
  const [businessHours, setBusinessHours] = useState({})
  const [closures, setClosures] = useState({})
  const [favorites, setFavorites] = useState([])
  const [tab, setTab] = useState("providers")
  const [search, setSearch] = useState("")
  const [selectedProvider, setSelectedProvider] = useState(null)
  const [loading, setLoading] = useState(true)
  const [userLocation, setUserLocation] = useState(null)
  const [locating, setLocating] = useState(false)
  const [sortBy, setSortBy] = useState("default")
  const [providerTypeFilter, setProviderTypeFilter] = useState("all")
  const [partsSearch, setPartsSearch] = useState("")
  const [partResults, setPartResults] = useState([])
  const [searchingParts, setSearchingParts] = useState(false)
  const [carModel, setCarModel] = useState("")
  const [maxDistance, setMaxDistance] = useState(null)
  const [showFilters, setShowFilters] = useState(false)
  const [priceRange, setPriceRange] = useState({ min:"", max:"" })
  const [onlyOpen, setOnlyOpen] = useState(false)
  const [onlyVerified, setOnlyVerified] = useState(false)

  const DAYS = language === "sw" ? DAYS_SW : DAYS_EN

  useEffect(() => {
    load()
    if (user) loadFavorites()
    const sub = supabase.channel("discover-live")
      .on("postgres_changes", { event:"*", schema:"public", table:"driver_status" }, () => loadDrivers())
      .on("postgres_changes", { event:"*", schema:"public", table:"profiles" }, () => load())
      .on("postgres_changes", { event:"*", schema:"public", table:"services" }, () => loadServices())
      .on("postgres_changes", { event:"*", schema:"public", table:"business_hours" }, () => loadBusinessHours())
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [user])

  async function load() {
    await Promise.all([loadProviders(), loadDrivers(), loadServices(), loadBundles(), loadBusinessHours(), loadClosures()])
    setLoading(false)
  }

  async function loadProviders() {
    const { data } = await supabase.from("profile_public").select("*").eq("role","provider").eq("is_active",true)
    setProviders(data||[])
  }

  async function loadDrivers() {
    const { data } = await supabase.from("profile_public").select("*").eq("role","driver").eq("is_active",true)
    setDrivers(data||[])
  }

  async function loadServices() {
    const { data } = await supabase.from("services")
      .select("*, profile_public(id,first_name,last_name,business_name)")
      .eq("is_active",true).order("created_at",{ascending:false})
    setServices(data||[])
  }
  async function loadBundles() {
    const { data } = await supabase.from("service_bundles")
      .select("*, profile_public:profiles!service_bundles_provider_id_fkey(id,first_name,last_name,business_name)")
      .eq("is_active",true).order("created_at",{ascending:false})
    setBundles(data||[])
  }

  async function loadBusinessHours() {
    const { data } = await supabase.from("business_hours").select("*")
    if (data) {
      const map = {}
      data.forEach(h => {
        if (!map[h.provider_id]) map[h.provider_id] = {}
        map[h.provider_id][h.day_of_week] = h
      })
      setBusinessHours(map)
    }
  }

  async function loadClosures() {
    const today = new Date().toISOString().split("T")[0]
    const { data } = await supabase.from("business_closures").select("*").gte("closure_date", today)
    if (data) {
      const map = {}
      data.forEach(c => {
        if (!map[c.provider_id]) map[c.provider_id] = []
        map[c.provider_id].push(c)
      })
      setClosures(map)
    }
  }

  async function searchParts(query, car) {
    if (!query && !car) { setPartResults([]); return }
    setSearchingParts(true)
    try {
      let q = supabase.from("inventory").select("*, profiles!inventory_provider_id_fkey(business_name,first_name,last_name,city,is_verified)").eq("is_active",true).gt("stock_quantity",0)
      if (query) q = q.ilike("name", `%${query}%`)
      if (car) q = q.contains("compatible_cars", [car])
      const { data } = await q.limit(20)
      setPartResults(data||[])
    } catch(e) { console.error(e) }
    finally { setSearchingParts(false) }
  }

  async function loadFavorites() {
    const { data } = await supabase.from("favorites").select("provider_id").eq("customer_id", user.id)
    setFavorites((data||[]).map(f=>f.provider_id))
  }

  async function toggleFavorite(e, providerId) {
    e.stopPropagation()
    if (!user) return toast.error(t("signIn"))
    if (favorites.includes(providerId)) {
      await supabase.from("favorites").delete().eq("customer_id", user.id).eq("provider_id", providerId)
      setFavorites(f=>f.filter(id=>id!==providerId))
      toast.success(language==="sw"?"Imeondolewa kwenye vipendwa":"Removed from favorites")
    } else {
      await supabase.from("favorites").insert({ customer_id:user.id, provider_id:providerId })
      setFavorites(f=>[...f, providerId])
      toast.success(language==="sw"?"Imehifadhiwa kwenye vipendwa Γ¥ñ∩╕Å":"Saved to favorites Γ¥ñ∩╕Å")
    }
  }

  function detectLocation() {
    if (!navigator.geolocation) return toast.error(t("error"))
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      pos => {
        setUserLocation({ lat:pos.coords.latitude, lng:pos.coords.longitude })
        setSortBy("distance")
        setLocating(false)
        toast.success(language==="sw"?"Mahali pamegunduliwa":"Location detected")
      },
      () => { toast.error(t("error")); setLocating(false) }
    )
  }

  function getDistance(p) {
    if (!userLocation||!p.latitude||!p.longitude) return null
    const R = 6371
    const dLat = (p.latitude-userLocation.lat)*Math.PI/180
    const dLng = (p.longitude-userLocation.lng)*Math.PI/180
    const a = Math.sin(dLat/2)**2+Math.cos(userLocation.lat*Math.PI/180)*Math.cos(p.latitude*Math.PI/180)*Math.sin(dLng/2)**2
    return R*2*Math.asin(Math.sqrt(a))
  }

  function getDisplayName(p) {
    if (p.business_name?.trim()) return p.business_name.trim()
    return `${p.first_name||""} ${p.last_name||""}`.trim()||"Provider"
  }

  function getProviderStatus(providerId) {
    const today = new Date()
    const dayOfWeek = today.getDay()
    const todayStr = today.toISOString().split("T")[0]
    const todayClosure = closures[providerId]?.find(c=>c.closure_date===todayStr)
    if (todayClosure) return { open:false, label:`${t("closed")} — ${todayClosure.reason||""}`, color:"#e24b4a" }
    const provHours = businessHours[providerId]
    if (!provHours||Object.keys(provHours).length===0) return null
    const hours = provHours[dayOfWeek]
    if (!hours||!hours.is_open) return { open:false, label:t("closedToday"), color:"#e24b4a" }
    const now = today.getHours()*60+today.getMinutes()
    const openStr = hours.open_time?.slice(0,5)||"08:00"
    const closeStr = hours.close_time?.slice(0,5)||"18:00"
    const open = parseInt(openStr.split(":")[0])*60+parseInt(openStr.split(":")[1])
    const close = parseInt(closeStr.split(":")[0])*60+parseInt(closeStr.split(":")[1])
    if (now>=open&&now<=close) return { open:true, label:`${t("open")} · ${language==="sw"?"Inafunga":"Closes"} ${closeStr}`, color:"#1d9e75" }
    if (now<open) return { open:false, label:`${language==="sw"?"Inafungua":"Opens at"} ${openStr}`, color:"#e6821e" }
    return { open:false, label:t("closedNow"), color:"#e24b4a" }
  }

  function getWeekHours(providerId) {
    const hours = businessHours[providerId]
    if (!hours||Object.keys(hours).length===0) return null
    return DAYS.map((day,i)=>({
      day, dayIndex:i,
      is_open: hours[i]?.is_open??false,
      open_time: hours[i]?.open_time?.slice(0,5)||"08:00",
      close_time: hours[i]?.close_time?.slice(0,5)||"18:00",
    }))
  }

  function providerServices(providerId) {
    return services.filter(s=>s.provider_id===providerId)
  }

  function formatPrice(s) {
    return Number(s.discounted_price||s.price||0).toFixed(2)
  }

  let filteredProviders = providers.filter(p=>{
    const matchSearch = `${getDisplayName(p)} ${p.first_name||""} ${p.last_name||""} ${p.city||""}`.toLowerCase().includes(search.toLowerCase())
    const matchVerified = !onlyVerified||p.is_verified
    const status = getProviderStatus(p.id)
    const matchOpen = !onlyOpen||status?.open===true
    const dist = getDistance(p)
    const matchDist = !maxDistance||dist===null||dist<=maxDistance
    const matchType = providerTypeFilter==="all"||p.provider_type===providerTypeFilter
    return matchSearch&&matchVerified&&matchOpen&&matchDist&&matchType
  })

  if (sortBy==="distance"&&userLocation) {
    filteredProviders = [...filteredProviders].sort((a,b)=>(getDistance(a)??9999)-(getDistance(b)??9999))
  } else if (sortBy==="name") {
    filteredProviders = [...filteredProviders].sort((a,b)=>getDisplayName(a).localeCompare(getDisplayName(b)))
  }

  let filteredServices = services.filter(s=>{
    const matchSearch = `${s.name} ${s.category}`.toLowerCase().includes(search.toLowerCase())
    const price = Number(s.discounted_price||s.price||0)
    const matchMin = !priceRange.min||price>=Number(priceRange.min)
    const matchMax = !priceRange.max||price<=Number(priceRange.max)
    return matchSearch&&matchMin&&matchMax
  })

  const filteredDrivers = drivers.filter(d=>
    `${d.first_name} ${d.last_name}`.toLowerCase().includes(search.toLowerCase())
  )

  const inp = { width:"100%", background:"#ffffff", border:"1px solid #e5e5e5", borderRadius:8, padding:"10px 12px", color:"#000000", fontSize:13, outline:"none", fontFamily:"'DM Sans',sans-serif" }

  return (
    <div>
      <div style={{ marginBottom:"1.25rem" }}>
        <div style={{ fontFamily:"Syne", fontSize:20, fontWeight:800, color:"#000000", marginBottom:4 }}>
          {t("discoverServices")}
        </div>
        <div style={{ fontSize:12, color:"#777777" }}>
          {providers.length} {t("providers").toLowerCase()} · {drivers.filter(d=>d.is_online).length} {t("drivers").toLowerCase()} {t("online").toLowerCase()} · {services.length} {t("services").toLowerCase()}
        </div>
      </div>

      <div style={{ display:"flex", gap:8, marginBottom:"1rem", flexWrap:"wrap" }}>
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder={t("searchGarages")}
          style={{ ...inp, flex:1, minWidth:180 }}/>
        <button onClick={detectLocation} disabled={locating}
          style={{ background:userLocation?"#f0fdf4":"#f5f5f5", border:`1px solid ${userLocation?"#1d9e7540":"#e0e0e0"}`, borderRadius:8, color:userLocation?"#1d9e75":"#555", fontSize:12, padding:"0 14px", cursor:"pointer", whiteSpace:"nowrap", fontFamily:"'DM Sans',sans-serif" }}>
          {locating?t("detecting"):`📍 ${t("nearMe")}`}
        </button>
        <button onClick={()=>setShowFilters(f=>!f)}
          style={{ background:showFilters?"#fff8f0":"#f5f5f5", border:`1px solid ${showFilters?"#e6821e40":"#e0e0e0"}`, borderRadius:8, color:showFilters?"#e6821e":"#555", fontSize:12, padding:"0 14px", cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>
          {t("filters")} {showFilters?"Γû▓":"▼"}
        </button>
      </div>

      {/* Provider type filter */}
      <div style={{ display:"flex", gap:6, marginBottom:"1rem", flexWrap:"wrap" }}>
        {[
          { key:"all", label:"All", icon:"🔍" },
          { key:"garage", label:"Garage", icon:"🔧" },
          { key:"parts_dealer", label:"Parts", icon:"⚙️" },
          { key:"accessories_shop", label:"Accessories", icon:"✨" },
          { key:"tyre_shop", label:"Tyres", icon:"🛞" },
          { key:"auto_electrician", label:"Electrician", icon:"⚡" },
          { key:"car_wash", label:"Car Wash", icon:"🚿" },
          { key:"panel_beater", label:"Panel Beater", icon:"🔨" },
          { key:"auto_glass", label:"Auto Glass", icon:"🪟" },
        ].map(tp=>(
          <button key={tp.key} onClick={()=>setProviderTypeFilter(tp.key)}
            style={{ padding:"6px 12px", borderRadius:8, border:"none", fontSize:11, cursor:"pointer", background:providerTypeFilter===tp.key?"#e6821e":"#f0f0f0", color:providerTypeFilter===tp.key?"#fff":"#555", fontFamily:"DM Sans,sans-serif", whiteSpace:"nowrap" }}>
            {tp.icon} {tp.label}
          </button>
        ))}
      </div>

      {showFilters&&(
        <div style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:10, padding:"1rem", marginBottom:"1rem", display:"grid", gridTemplateColumns:isMobile?"1fr":"repeat(auto-fill,minmax(180px,1fr))", gap:12 }}>
          <div>
            <div style={{ fontSize:11, color:"#777777", textTransform:"uppercase", marginBottom:6 }}>{t("sortBy")}</div>
            <select value={sortBy} onChange={e=>setSortBy(e.target.value)} style={{ ...inp, padding:"7px 10px" }}>
              <option value="default">{t("defaultSort")}</option>
              <option value="distance">{t("nearest")}</option>
              <option value="name">{t("nameAZ")}</option>
            </select>
          </div>
          {userLocation&&(
            <div>
              <div style={{ fontSize:11, color:"#777777", textTransform:"uppercase", marginBottom:6 }}>{t("maxDistance")}</div>
              <select value={maxDistance||""} onChange={e=>setMaxDistance(e.target.value?Number(e.target.value):null)} style={{ ...inp, padding:"7px 10px" }}>
                <option value="">{t("anyDistance")}</option>
                <option value="5">5 km</option>
                <option value="10">10 km</option>
                <option value="25">25 km</option>
                <option value="50">50 km</option>
              </select>
            </div>
          )}
          <div>
            <div style={{ fontSize:11, color:"#777777", textTransform:"uppercase", marginBottom:6 }}>{t("priceRange")}</div>
            <div style={{ display:"flex", gap:6 }}>
              <input type="number" placeholder="Min" value={priceRange.min} onChange={e=>setPriceRange(p=>({...p,min:e.target.value}))} style={{ ...inp, padding:"7px 10px" }}/>
              <input type="number" placeholder="Max" value={priceRange.max} onChange={e=>setPriceRange(p=>({...p,max:e.target.value}))} style={{ ...inp, padding:"7px 10px" }}/>
            </div>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:8, justifyContent:"flex-end" }}>
            <label style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer", fontSize:12, color:"#555555" }}>
              <input type="checkbox" checked={onlyOpen} onChange={e=>setOnlyOpen(e.target.checked)}/>
              {t("openNow")}
            </label>
            <label style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer", fontSize:12, color:"#555555" }}>
              <input type="checkbox" checked={onlyVerified} onChange={e=>setOnlyVerified(e.target.checked)}/>
              {t("verifiedOnly")}
            </label>
          </div>
          <div style={{ display:"flex", alignItems:"flex-end" }}>
            <button onClick={()=>{ setSortBy("default"); setMaxDistance(null); setPriceRange({min:"",max:""}); setOnlyOpen(false); setOnlyVerified(false); setUserLocation(null) }}
              style={{ background:"none", border:"1px solid #dddddd", borderRadius:7, color:"#666", fontSize:11, padding:"7px 12px", cursor:"pointer" }}>
              {t("clearFilters")}
            </button>
          </div>
        </div>
      )}

      <div style={{ display:"flex", gap:6, marginBottom:"1.25rem" }}>
        {[
          { key:"providers", label:`${t("providers")} (${filteredProviders.length})` },
          { key:"services", label:`${t("services")} (${filteredServices.length})` },
          { key:"drivers", label:`${t("drivers")} (${filteredDrivers.filter(d=>d.is_online).length} ${t("online").toLowerCase()})` },
        ].map(tab2=>(
          <button key={tab2.key} onClick={()=>{ setTab(tab2.key); setSearch(""); setSelectedProvider(null) }}
            style={{ padding:"8px 16px", borderRadius:8, border:"none", fontSize:12, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", background:tab===tab2.key?"#e6821e":"#555555", color:tab===tab2.key?"#fff":"#666", fontWeight:tab===tab2.key?700:400 }}>
            {tab2.label}
          </button>
        ))}
      </div>

      {loading&&<div style={{ color:"#777777", fontSize:13 }}>{t("loading")}</div>}

      {tab==="providers"&&!selectedProvider&&(
        <div style={{ display:"grid", gap:10 }}>
          {filteredProviders.length===0&&!loading&&<div style={{ color:"#888888", fontSize:13, textAlign:"center", padding:"2rem" }}>{t("noProvidersFound")}</div>}
          {filteredProviders.map(p=>{
            const ps = providerServices(p.id)
            const status = getProviderStatus(p.id)
            const dist = getDistance(p)
            const isFav = favorites.includes(p.id)
            return (
              <div key={p.id}
                style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:12, padding:"1.25rem", cursor:"pointer", transition:"border-color 0.12s" }}
                onMouseEnter={e=>e.currentTarget.style.borderColor="#e6821e40"}
                onMouseLeave={e=>e.currentTarget.style.borderColor="#eeeeee"}
                onClick={()=>setSelectedProvider(p)}>
                <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:10 }}>
                  <div style={{ width:48, height:48, borderRadius:12, background:"#fff8f0", border:"1px solid #e6821e30", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"Syne", fontSize:20, fontWeight:800, color:"#e6821e", flexShrink:0 }}>
                    {getDisplayName(p)[0]?.toUpperCase()}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:2, flexWrap:"wrap" }}>
                      <div style={{ fontFamily:"Syne", fontSize:15, fontWeight:800, color:"#000000" }}>{getDisplayName(p)}</div>
                      {p.is_verified&&<span style={{ fontSize:10, color:"#1d9e75", background:"#f0fdf4", padding:"1px 6px", borderRadius:10 }}>Γ£ô {t("verified")}</span>}
                      {p.provider_type&&p.provider_type!=="garage"&&<span style={{ fontSize:10, color:"#8b5cf6", background:"#faf5ff", padding:"1px 6px", borderRadius:10 }}>{p.provider_type.replace(/_/g," ")}</span>}
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                      {p.business_name&&<div style={{ fontSize:11, color:"#666" }}>{t("owner")}: {p.first_name} {p.last_name}</div>}
                      {p.city&&<span style={{ fontSize:11, color:"#777777" }}>📍 {p.city}</span>}
                      {dist!==null&&<span style={{ fontSize:11, color:"#378add" }}>· {dist.toFixed(1)} {t("kmAway")}</span>}
                    </div>
                    {status&&<div style={{ fontSize:11, color:status.color, marginTop:3, fontWeight:500 }}>ΓùÅ {status.label}</div>}
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
                    <button onClick={e=>toggleFavorite(e,p.id)}
                      style={{ background:"none", border:"none", fontSize:20, cursor:"pointer", color:isFav?"#e24b4a":"#444", padding:"2px", lineHeight:1 }}>
                      {isFav?"ΓÖÑ":"⭐"}
                    </button>
                    <div style={{ fontSize:12, color:"#e6821e", fontWeight:500 }}>{t("viewProfile")} →</div>
                  </div>
                </div>
                {ps.length>0&&(
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                    {ps.slice(0,4).map(s=>(
                      <span key={s.id} style={{ fontSize:10, padding:"3px 8px", borderRadius:6, background:"#f5f5f5", color:"#555555", border:"1px solid #e5e5e5" }}>
                        {s.name} · Ksh {formatPrice(s)}
                      </span>
                    ))}
                    {ps.length>4&&<span style={{ fontSize:10, padding:"3px 8px", borderRadius:6, background:"#f5f5f5", color:"#777777" }}>+{ps.length-4} {t("more")}</span>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {tab==="providers"&&selectedProvider&&(
        <div>
          <button onClick={()=>setSelectedProvider(null)}
            style={{ background:"none", border:"none", color:"#666", cursor:"pointer", fontSize:13, marginBottom:"1rem", fontFamily:"'DM Sans',sans-serif", padding:0 }}>
            ΓåÉ {t("backToProviders")}
          </button>
          <div style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:12, padding:"1.25rem", marginBottom:"1rem" }}>
            <div style={{ display:"flex", alignItems:"center", gap:14 }}>
              <div style={{ width:60, height:60, borderRadius:14, background:"#fff8f0", border:"2px solid #e6821e30", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"Syne", fontSize:24, fontWeight:800, color:"#e6821e", flexShrink:0 }}>
                {getDisplayName(selectedProvider)[0]?.toUpperCase()}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontFamily:"Syne", fontSize:18, fontWeight:800, color:"#000000", marginBottom:2 }}>
                  {getDisplayName(selectedProvider)}
                </div>
                {selectedProvider.business_name&&(
                  <div style={{ fontSize:12, color:"#555555", marginBottom:3 }}>{t("owner")}: {selectedProvider.first_name} {selectedProvider.last_name}</div>
                )}
                <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
                  {selectedProvider.city&&<span style={{ fontSize:12, color:"#777777" }}>📍 {selectedProvider.city}</span>}
                  {selectedProvider.is_verified&&<span style={{ fontSize:11, color:"#1d9e75", background:"#f0fdf4", padding:"2px 8px", borderRadius:10 }}>Γ£ô {t("verified")}</span>}
                  {getDistance(selectedProvider)!==null&&<span style={{ fontSize:11, color:"#378add" }}>📍 {getDistance(selectedProvider).toFixed(1)} {t("kmAway")}</span>}
                </div>
                {getProviderStatus(selectedProvider.id)&&(
                  <div style={{ fontSize:12, color:getProviderStatus(selectedProvider.id).color, marginTop:4, fontWeight:500 }}>
                    ΓùÅ {getProviderStatus(selectedProvider.id).label}
                  </div>
                )}
              </div>
              <button onClick={e=>toggleFavorite(e,selectedProvider.id)}
                style={{ background:"none", border:"none", fontSize:26, cursor:"pointer", color:favorites.includes(selectedProvider.id)?"#e24b4a":"#444", padding:"4px", flexShrink:0 }}>
                {favorites.includes(selectedProvider.id)?"ΓÖÑ":"⭐"}
              </button>
            </div>
          </div>

          {getWeekHours(selectedProvider.id)&&(
            <div style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:12, padding:"1.25rem", marginBottom:"1rem" }}>
              <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, marginBottom:10, color:"#000000" }}>{t("businessHoursLabel")}</div>
              {getWeekHours(selectedProvider.id).map(h=>{
                const isToday = h.dayIndex===new Date().getDay()
                return (
                  <div key={h.day} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"7px 0", borderBottom:"1px solid #eeeeee" }}>
                    <div style={{ fontSize:12, color:isToday?"#e6821e":"#888", fontWeight:isToday?600:400 }}>
                      {h.day}{isToday?` (${t("today")})` :""}
                    </div>
                    <div style={{ fontSize:12, color:h.is_open?"#000000":"#555" }}>
                      {h.is_open?`${h.open_time} — ${h.close_time}`:t("closed")}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {closures[selectedProvider.id]?.length>0&&(
            <div style={{ background:"#fff5f5", border:"1px solid #e24b4a20", borderRadius:12, padding:"1rem", marginBottom:"1rem" }}>
              <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, marginBottom:8, color:"#e24b4a" }}>{t("upcomingClosures")}</div>
              {closures[selectedProvider.id].map(c=>(
                <div key={c.id} style={{ fontSize:12, color:"#555555", marginBottom:4 }}>
                  ≡ƒÜ½ {new Date(c.closure_date+"T00:00:00").toLocaleDateString("default",{weekday:"long",month:"long",day:"numeric"})}
                  {c.reason&&` — ${c.reason}`}
                </div>
              ))}
            </div>
          )}

          <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, marginBottom:10, color:"#000000" }}>
            {t("servicesOffered")} ({providerServices(selectedProvider.id).length})
          </div>
          {providerServices(selectedProvider.id).length===0&&(
            <div style={{ color:"#888888", fontSize:13, textAlign:"center", padding:"1.5rem" }}>{t("noDataYet")}</div>
          )}
          <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"repeat(auto-fill,minmax(200px,1fr))", gap:10 }}>
            {providerServices(selectedProvider.id).map(s=>(
              <div key={s.id} style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:10, padding:"1rem" }}>
                <div style={{ fontSize:11, color:"#777777", marginBottom:4 }}>{s.category}</div>
                <div style={{ fontSize:14, fontWeight:600, color:"#000000", marginBottom:4 }}>{s.name}</div>
                {s.description&&<div style={{ fontSize:11, color:"#666", marginBottom:8, lineHeight:1.5 }}>{s.description.slice(0,80)}{s.description.length>80?"...":""}</div>}
                {Array.isArray(s.inclusions)&&s.inclusions.length>0&&(
                  <div style={{ marginBottom:8 }}>
                    {s.inclusions.slice(0,3).map((inc,i)=><div key={i} style={{ fontSize:10, color:"#777777", marginBottom:2 }}>Γ£ô {inc}</div>)}
                  </div>
                )}
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div>
                    <span style={{ fontFamily:"Syne", fontSize:15, fontWeight:800, color:"#e6821e" }}>Ksh {formatPrice(s)}</span>
                    {s.discounted_price&&Number(s.discounted_price)<Number(s.price)&&(
                      <span style={{ fontSize:11, color:"#777777", textDecoration:"line-through", marginLeft:6 }}>Ksh {Number(s.price).toFixed(2)}</span>
                    )}
                  </div>
                  <span style={{ fontSize:11, color:"#777777" }}>{s.duration}{t("minutes")}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab==="services"&&(
        <div>
          {bundles.length>0&&(
            <div style={{ marginBottom:"1.5rem" }}>
              <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:800, marginBottom:8, color:"#e6821e" }}>📦 Bundle Deals</div>
              <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"repeat(auto-fill,minmax(220px,1fr))", gap:10 }}>
                {bundles.map(b=>{
                  const savings = Number(b.original_price) - Number(b.bundle_price)
                  const savingsPct = Math.round((savings / Number(b.original_price)) * 100)
                  return (
                    <div key={b.id} onClick={()=>{ setTab("providers"); setSelectedProvider(b.profile_public) }} style={{ background:"#fff8f0", border:"1px solid #e6821e40", borderRadius:10, padding:"1rem", cursor:"pointer" }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"start", marginBottom:4 }}>
                        <div style={{ fontSize:14, fontWeight:700, color:"#000" }}>{b.name}</div>
                        <span style={{ fontSize:10, color:"#1d9e75", background:"#f0fdf4", padding:"2px 8px", borderRadius:10, flexShrink:0 }}>Save {savingsPct}%</span>
                      </div>
                      {b.description&&<div style={{ fontSize:11, color:"#666", marginBottom:8 }}>{b.description}</div>}
                      <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:6 }}>
                        <span style={{ fontSize:12, color:"#888", textDecoration:"line-through" }}>KES {Number(b.original_price).toLocaleString()}</span>
                        <span style={{ fontFamily:"Syne", fontSize:15, fontWeight:800, color:"#e6821e" }}>KES {Number(b.bundle_price).toLocaleString()}</span>
                      </div>
                      <div style={{ fontSize:11, color:"#777777" }}>
                        {b.profile_public?.business_name||`${b.profile_public?.first_name||""} ${b.profile_public?.last_name||""}`.trim()}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"repeat(auto-fill,minmax(180px,1fr))", gap:10 }}>
          {filteredServices.length===0&&<div style={{ color:"#888888", fontSize:13, textAlign:"center", padding:"2rem", gridColumn:"1/-1" }}>{t("noServicesFound")}</div>}
          {filteredServices.map(s=>(
            <div key={s.id} style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:10, padding:"1rem" }}>
              <div style={{ fontSize:11, color:"#777777", marginBottom:4 }}>{s.category}</div>
              <div style={{ fontSize:14, fontWeight:500, color:"#000000", marginBottom:4 }}>{s.name}</div>
              {s.description&&<div style={{ fontSize:11, color:"#666", marginBottom:8, lineHeight:1.4 }}>{s.description.slice(0,60)}{s.description.length>60?"...":""}</div>}
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                <span style={{ fontFamily:"Syne", fontSize:14, fontWeight:800, color:"#e6821e" }}>Ksh {formatPrice(s)}</span>
                <span style={{ fontSize:11, color:"#777777" }}>{s.duration}{t("minutes")}</span>
              </div>
              <div style={{ fontSize:11, color:"#777777" }}>
                {s.profile_public?.business_name||`${s.profile_public?.first_name||""} ${s.profile_public?.last_name||""}`.trim()}
              </div>
            </div>
          ))}
        </div>
        </div>
      )}

      {tab==="parts"&&(
        <div>
          <div style={{ display:"flex", gap:8, marginBottom:"1rem", flexWrap:"wrap" }}>
            <input value={partsSearch} onChange={e=>{ setPartsSearch(e.target.value); searchParts(e.target.value, carModel) }}
              placeholder="Search parts, accessories, tyres..."
              style={{ flex:1, minWidth:150, background:"#ffffff", border:"1px solid #e5e5e5", borderRadius:8, padding:"9px 12px", color:"#000000", fontSize:13, outline:"none" }}/>
            <input value={carModel} onChange={e=>{ setCarModel(e.target.value); searchParts(partsSearch, e.target.value) }}
              placeholder="Filter by car model..."
              style={{ flex:1, minWidth:150, background:"#ffffff", border:"1px solid #e5e5e5", borderRadius:8, padding:"9px 12px", color:"#000000", fontSize:13, outline:"none" }}/>
          </div>
          {searchingParts&&<div style={{ color:"#777777", fontSize:13 }}>Searching...</div>}
          {!searchingParts&&partsSearch===("")&&carModel===("")&&(
            <div style={{ textAlign:"center", padding:"2rem", color:"#888888" }}>
              <div style={{ fontSize:32, marginBottom:10 }}>🔍</div>
              <div style={{ fontSize:13 }}>Search for parts, accessories or filter by your car model</div>
              <button onClick={()=>navigate("/dashboard/parts")} style={{ marginTop:"1rem", background:"#e6821e", border:"none", borderRadius:9, color:"#fff", fontFamily:"Syne", fontSize:13, fontWeight:700, padding:"10px 24px", cursor:"pointer" }}>
                Browse all parts →
              </button>
            </div>
          )}
          {partResults.length===0&&(partsSearch||carModel)&&!searchingParts&&(
            <div style={{ textAlign:"center", padding:"2rem", color:"#888888", fontSize:13 }}>No parts found matching your search</div>
          )}
          <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"repeat(2,1fr)", gap:12 }}>
            {partResults.map(item=>(
              <div key={item.id} onClick={()=>navigate("/dashboard/parts")} style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:12, padding:"1rem", cursor:"pointer" }}>
                {item.photos?.[0]&&<img src={item.photos[0]} alt={item.name} style={{ width:"100%", height:120, objectFit:"cover", borderRadius:8, marginBottom:8 }}/>}
                <div style={{ fontSize:13, fontWeight:600, color:"#000000", marginBottom:4 }}>{item.name}</div>
                {item.brand&&<div style={{ fontSize:11, color:"#555555", marginBottom:2 }}>Brand: {item.brand}</div>}
                {item.compatible_cars?.length>0&&<div style={{ fontSize:10, color:"#777777", marginBottom:4 }}>🚗 {item.compatible_cars.slice(0,2).join(", ")}</div>}
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:800, color:"#e6821e" }}>KES {Number(item.price).toLocaleString()}</div>
                  <div style={{ fontSize:10, color:item.stock_quantity>5?"#1d9e75":"#e24b4a" }}>{item.stock_quantity} in stock</div>
                </div>
                <div style={{ fontSize:11, color:"#777777", marginTop:4 }}>
                  🏪 {item.profiles?.business_name||item.profiles?.first_name}
                  {item.profiles?.is_verified&&<span style={{ color:"#1d9e75", marginLeft:4 }}>Γ£ô</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab==="drivers"&&(
        <div style={{ display:"grid", gap:10 }}>
          <div style={{ display:"flex", gap:8, marginBottom:4 }}>
            <span style={{ fontSize:12, color:"#1d9e75" }}>ΓùÅ {drivers.filter(d=>d.is_online).length} {t("online").toLowerCase()}</span>
            <span style={{ fontSize:12, color:"#777777" }}>ΓùÅ {drivers.filter(d=>!d.is_online).length} {t("offline").toLowerCase()}</span>
          </div>
          {filteredDrivers.length===0&&!loading&&<div style={{ color:"#888888", fontSize:13, textAlign:"center", padding:"2rem" }}>{t("noDriversFound")}</div>}
          {filteredDrivers.map(d=>(
            <div key={d.id} style={{ background:"#ffffff", border:`1px solid ${d.is_online?"#1d9e7520":"#eeeeee"}`, borderRadius:12, padding:"1rem", display:"flex", alignItems:"center", gap:12 }}>
              <div style={{ width:44, height:44, borderRadius:"50%", background:d.is_online?"#f0fdf4":"#ffffff", border:`1px solid ${d.is_online?"#1d9e7540":"#555555"}`, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"Syne", fontSize:15, fontWeight:800, color:d.is_online?"#1d9e75":"#555", flexShrink:0 }}>
                {d.first_name?.[0]}{d.last_name?.[0]}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:2 }}>
                  <div style={{ fontSize:14, fontWeight:500, color:"#000000" }}>{d.first_name} {d.last_name}</div>
                  {d.is_verified&&<span style={{ fontSize:10, color:"#1d9e75", background:"#f0fdf4", padding:"1px 6px", borderRadius:10 }}>Γ£ô</span>}
                </div>
                <div style={{ fontSize:11, color:"#777777" }}>{language==="sw"?"Dereva wa kuchukua":"Concierge driver"} · {d.city||"Nairobi"}</div>
              </div>
              <span style={{ fontSize:11, fontWeight:600, padding:"4px 10px", borderRadius:20, background:d.is_online?"#f0fdf4":"#ffffff", color:d.is_online?"#1d9e75":"#555", border:`1px solid ${d.is_online?"#1d9e7530":"#33333330"}`, flexShrink:0 }}>
                {d.is_online?t("online"):t("offline")}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}












