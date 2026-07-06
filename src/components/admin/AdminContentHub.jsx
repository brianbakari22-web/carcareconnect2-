import { useEffect, useState, useRef } from "react"
import { supabase } from "../../lib/supabase"
import useIsMobile from "../../lib/useIsMobile"
import toast from "react-hot-toast"

const PLATFORMS = [
  { key:"whatsapp", label:"WhatsApp", icon:"💚", color:"#25D366", maxChars:null },
  { key:"tiktok", label:"TikTok", icon:"🎵", color:"#000000", maxChars:2200 },
  { key:"instagram", label:"Instagram", icon:"📸", color:"#E1306C", maxChars:2200 },
  { key:"facebook", label:"Facebook", icon:"👥", color:"#1877F2", maxChars:63206 },
  { key:"x", label:"X (Twitter)", icon:"🐦", color:"#000000", maxChars:280 },
  { key:"youtube", label:"YouTube", icon:"▶️", color:"#FF0000", maxChars:5000 },
]

const HASHTAGS = {
  car: "#CCC #CarCareConnect #Nairobi #NairobiCars #KenyaCars #CarDeals #NewCars #Kenya",
  service: "#CCC #CarCareConnect #Nairobi #CarService #AutoService #NairobiGarage #CarMaintenance",
  wash: "#CCC #CarCareConnect #Nairobi #CarWash #NairobiCarWash #DetailingKenya #CleanCar",
  parts: "#CCC #CarCareConnect #Nairobi #CarParts #AutoParts #KenyaCarParts #SparePartsKenya",
  general: "#CCC #CarCareConnect #Nairobi #Kenya #Automotive #CarCare #NairobiLife",
}

function generateCaption(item, platform, type, itemUrl) {
  const price = item.price || item.total_amount || ""
  const name = item.brand ? `${item.year} ${item.brand} ${item.model}` : item.service_name || item.name || item.title || "Amazing deal"
  const showroom = item.showroom_name || item.business_name || "Car Care Connect"
  const tags = type==="car" ? HASHTAGS.car : type==="wash" ? HASHTAGS.wash : type==="parts" ? HASHTAGS.parts : type==="service" ? HASHTAGS.service : HASHTAGS.general
  const url = itemUrl || "https://carcareconnect.care"

  const captions = {
    whatsapp: `🚗 *${name}*\n\n💰 KES ${Number(price).toLocaleString()}\n🏢 ${showroom}\n\n✅ Verified on Car Care Connect\n📱 Book now: ${url}\n\n${tags}`,
    tiktok: `${name} 🔥\n\nKES ${Number(price).toLocaleString()} 💰\n\nFind it on Car Care Connect 👇\n${url}\n\n${tags}`,
    instagram: `✨ ${name}\n\n💰 KES ${Number(price).toLocaleString()}\n🏢 ${showroom}\n📍 Nairobi, Kenya\n\nBook instantly on Car Care Connect 🚗\nLink in bio 👆\n\n${tags}`,
    facebook: `🚗 ${name}\n\nPrice: KES ${Number(price).toLocaleString()}\nShowroom: ${showroom}\n\nThis listing is available on Car Care Connect — Nairobi's #1 automotive services marketplace.\n\n👉 Book now: ${url}\n\n${tags}`,
    x: `🚗 ${name} — KES ${Number(price).toLocaleString()} | ${showroom} | Book now: ${url} ${tags}`.substring(0, 280),
    youtube: `${name}\n\nPrice: KES ${Number(price).toLocaleString()}\nShowroom: ${showroom}\n\nCar Care Connect is Nairobi's #1 automotive services marketplace. Browse new cars, book services, find parts and accessories — all in one place.\n\n🔗 Visit us: ${url}\n📞 Call us: 0113858966\n✉️ Email: carcareconnect254@gmail.com\n\n${tags}`,
  }
  return captions[platform] || captions.whatsapp
}

function getItemUrl(item) {
  const base = "https://carcareconnect.care"
  if (!item) return base
  if (item._type === "car") return `${base}/provider/${item.provider_id||item.id}`
  if (item._type === "service") return `${base}/service/${item.id}`
  if (item._type === "parts") return `${base}/parts/${item.id}`
  if (item._type === "provider") return `${base}/provider/${item.id}`
  return base
}

export default function AdminContentHub() {
  const isMobile = useIsMobile()
  const studioRef = useRef(null)
  const [tab, setTab] = useState("new_cars")
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [platform, setPlatform] = useState("whatsapp")
  const [caption, setCaption] = useState("")
  const [downloading, setDownloading] = useState(false)
  const [selectedPhoto, setSelectedPhoto] = useState(null)
  const [search, setSearch] = useState("")
  const [campaign, setCampaign] = useState("")
  const [campaigns, setCampaigns] = useState([])
  const [showGuide, setShowGuide] = useState(null)
  const [socialAccounts, setSocialAccounts] = useState({ whatsapp:"", tiktok:"", instagram:"", facebook:"", x:"", youtube:"" })
  const [editingSocial, setEditingSocial] = useState(false)
  const [showSocialSetup, setShowSocialSetup] = useState(false)
  const [showCampaignForm, setShowCampaignForm] = useState(false)
  const [campaignForm, setCampaignForm] = useState({ name:"", description:"" })
  const [scheduledPosts, setScheduledPosts] = useState([])
  const [showScheduleForm, setShowScheduleForm] = useState(false)
  const [scheduleForm, setScheduleForm] = useState({ date:"", time:"" })

  useEffect(() => { load() }, [tab])

  async function load() {
    setLoading(true)
    setSelected(null)
    let data = []
    if (tab==="new_cars") {
      const { data: d } = await supabase.from("new_car_listings").select("*").order("created_at",{ascending:false})
      data = (d||[]).map(i=>({...i, _type:"car", _label:`${i.year} ${i.brand} ${i.model}`, _price:i.price, _photos:i.photos||[], _video:i.video_url }))
    } else if (tab==="marketplace") {
      const { data: d } = await supabase.from("marketplace_listings").select("*, marketplace_photos!marketplace_photos_listing_id_fkey(photo_url)").order("created_at",{ascending:false})
      data = (d||[]).map(i=>({...i, _type:i.listing_type||"parts", _label:i.title, _price:i.price, _photos:(i.marketplace_photos||[]).map(p=>p.photo_url), _video:i.video_url }))
    } else if (tab==="services") {
      const { data: d } = await supabase.from("services").select("*, profiles!services_provider_id_fkey(business_name,first_name,last_name,profile_photo_url,avatar_url)").eq("is_active",true).order("created_at",{ascending:false})
      data = (d||[]).map(i=>({
        ...i,
        _type:"service",
        _label:i.name,
        _price:i.price,
        _photos: i.photos?.length>0 ? i.photos : i.profiles?.profile_photo_url ? [i.profiles.profile_photo_url] : i.profiles?.avatar_url ? [i.profiles.avatar_url] : [],
        _video:null,
        business_name:i.profiles?.business_name||i.profiles?.first_name,
        _category_icon: i.category==="car_wash"?"🚿":i.category==="go_service"?"🚨":i.category==="shop_premium"?"🏡":"🔧"
      }))
    } else if (tab==="inventory") {
      const { data: d } = await supabase.from("inventory").select("*, profiles!inventory_provider_id_fkey(business_name,first_name,last_name)").eq("is_active",true).order("created_at",{ascending:false})
      data = (d||[]).map(i=>({...i, _type:"parts", _label:i.name, _price:i.price, _photos:i.photos||[], _video:null, business_name:i.profiles?.business_name||i.profiles?.first_name }))
    } else if (tab==="providers") {
      const { data: d } = await supabase.from("profiles").select("id,first_name,last_name,business_name,provider_type,avatar_url,profile_photo_url,city").eq("role","provider").order("created_at",{ascending:false})
      data = (d||[]).filter(i=>i.first_name&&i.first_name!=="Deleted").map(i=>({...i, _type:"service", _label:i.business_name||i.first_name+" "+i.last_name, _price:null, _photos:i.profile_photo_url?[i.profile_photo_url]:i.avatar_url?[i.avatar_url]:[], _video:null }))
    }
    setItems(data)
    setLoading(false)
  }

  async function loadCampaigns() {
    const { data } = await supabase.from("content_campaigns").select("*").order("created_at",{ascending:false})
    setCampaigns(data||[])
  }

  async function loadSocialAccounts() {
    const { data } = await supabase.from("platform_settings").select("key,value").in("key",["social_whatsapp","social_tiktok","social_instagram","social_facebook","social_x","social_youtube"])
    if (data) {
      const acc = {}
      data.forEach(r => { acc[r.key.replace("social_","")] = r.value||"" })
      setSocialAccounts(acc)
    }
  }

  async function saveSocialAccount(platform, url) {
    await supabase.from("platform_settings").upsert({ key:"social_"+platform, value:url }, { onConflict:"key" })
    setSocialAccounts(a => ({...a, [platform]:url}))
    toast.success("Account saved!")
  }

  useEffect(() => { loadCampaigns(); loadSocialAccounts() }, [])

  function selectItem(item) {
    setSelected(item)
    setSelectedPhoto(item._photos?.[0]||null)
    setCaption(generateCaption(item, platform, item._type, getItemUrl(item)))
  }

  function updateCaption(p) {
    setPlatform(p)
    if (selected) setCaption(generateCaption(selected, p, selected._type, getItemUrl(selected)))
  }

  function copyCaption() {
    navigator.clipboard.writeText(caption)
    toast.success("Caption copied!")
  }

  function shareToSocial(platformKey) {
    const url = "https://carcareconnect.care"
    const encodedCaption = encodeURIComponent(caption)
    const encodedUrl = encodeURIComponent(url)
    const savedUrl = socialAccounts[platformKey]

    const shareUrls = {
      whatsapp: savedUrl ? savedUrl : `https://wa.me/?text=${encodedCaption}`,
      facebook: savedUrl ? savedUrl : `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedCaption}`,
      x: savedUrl ? savedUrl : `https://twitter.com/intent/tweet?text=${encodeURIComponent(caption.substring(0,260))}&url=${encodedUrl}`,
      instagram: null,
      tiktok: null,
      youtube: null,
    }

    const shareUrl = shareUrls[platformKey]
    if (shareUrl) {
      window.open(shareUrl, "_blank", "width=600,height=500")
      navigator.clipboard.writeText(caption)
      toast.success(`Opening ${PLATFORMS.find(p=>p.key===platformKey)?.label}... Caption copied!`)
    } else {
      navigator.clipboard.writeText(caption)
      setShowGuide(platformKey)
      const appUrls = {
        instagram: socialAccounts.instagram||"https://www.instagram.com",
        tiktok: socialAccounts.tiktok||"https://www.tiktok.com",
        youtube: socialAccounts.youtube||"https://studio.youtube.com",
      }
      setTimeout(() => window.open(appUrls[platformKey], "_blank"), 500)
    }
  }

  async function downloadPhoto(url, filename) {
    setDownloading(true)
    try {
      const res = await fetch(url)
      const blob = await res.blob()
      const a = document.createElement("a")
      a.href = URL.createObjectURL(blob)
      a.download = filename || "ccc-content.jpg"
      a.click()
      toast.success("Photo downloaded!")
    } catch(e) { toast.error("Download failed") }
    finally { setDownloading(false) }
  }

  async function downloadVideo(url, filename) {
    setDownloading(true)
    try {
      // Try fetch first
      const res = await fetch(url, { mode: "cors" })
      if (res.ok) {
        const blob = await res.blob()
        const a = document.createElement("a")
        a.href = URL.createObjectURL(blob)
        a.download = filename || "ccc-video.mp4"
        a.click()
        toast.success("Video downloaded!")
      } else {
        // Fallback - open in new tab for manual save
        window.open(url, "_blank")
        toast("Video opened in new tab — long press to save", { icon: "📹", duration: 6000 })
      }
    } catch(e) {
      // Final fallback - direct link
      const a = document.createElement("a")
      a.href = url
      a.download = filename || "ccc-video.mp4"
      a.target = "_blank"
      a.click()
      toast("Downloading video...", { icon: "📹" })
    }
    finally { setDownloading(false) }
  }

  async function generateContentCard(item) {
    setDownloading(true)
    try {
      const canvas = document.createElement("canvas")
      canvas.width = 1080
      canvas.height = 1080
      const ctx = canvas.getContext("2d")

      // === BACKGROUND ===
      ctx.fillStyle = "#0f0f0f"
      ctx.fillRect(0, 0, 1080, 1080)

      // === PHOTO SECTION (full bleed with gradient) ===
      const photoToUse = selectedPhoto || item._photos?.[0]
      if (photoToUse) {
        try {
          const img = new Image()
          img.crossOrigin = "anonymous"
          await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = photoToUse })
          const imgAspect = img.width / img.height
          const canvasAspect = 1080 / 680
          let drawX = 0, drawY = 0, drawW = 1080, drawH = 680
          if (imgAspect > canvasAspect) { drawH = 680; drawW = img.width*(680/img.height); drawX = (1080-drawW)/2 }
          else { drawW = 1080; drawH = img.height*(1080/img.width); drawY = (680-drawH)/2 }
          ctx.save(); ctx.beginPath(); ctx.rect(0,0,1080,680); ctx.clip()
          ctx.drawImage(img, drawX, drawY, drawW, drawH)
          ctx.restore()
        } catch(e) {
          ctx.fillStyle = "#1a1a1a"
          ctx.fillRect(0,0,1080,680)
          ctx.fillStyle = "#333"
          ctx.font = "120px Arial"
          ctx.textAlign = "center"
          ctx.fillText(item._category_icon||"🔧", 540, 380)
          ctx.textAlign = "left"
        }
      } else {
        ctx.fillStyle = "#1a1a1a"
        ctx.fillRect(0,0,1080,680)
        ctx.fillStyle = "#333"
        ctx.font = "120px Arial"
        ctx.textAlign = "center"
        ctx.fillText(item._category_icon||"🔧", 540, 380)
        ctx.textAlign = "left"
      }

      // === GRADIENT OVERLAY on photo ===
      const grad = ctx.createLinearGradient(0, 300, 0, 680)
      grad.addColorStop(0, "rgba(0,0,0,0)")
      grad.addColorStop(1, "rgba(0,0,0,0.85)")
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, 1080, 680)

      // === LOGO top-left ===
      ctx.fillStyle = "#E6821E"
      ctx.beginPath()
      ctx.roundRect(30, 30, 220, 60, 12)
      ctx.fill()
      ctx.fillStyle = "#ffffff"
      ctx.font = "bold 28px Arial"
      ctx.fillText("CarCare Connect", 50, 70)

      // === CATEGORY BADGE top-right ===
      const typeLabel = item._type==="service"?"SERVICE":item._type==="car"?"NEW CAR":item._type==="parts"?"PARTS":"PRODUCT"
      ctx.fillStyle = "rgba(0,0,0,0.6)"
      ctx.beginPath()
      ctx.roundRect(830, 30, 220, 60, 12)
      ctx.fill()
      ctx.fillStyle = "#E6821E"
      ctx.font = "bold 24px Arial"
      ctx.textAlign = "center"
      ctx.fillText(typeLabel, 940, 70)
      ctx.textAlign = "left"

      // === BOTTOM INFO PANEL ===
      ctx.fillStyle = "#111111"
      ctx.fillRect(0, 680, 1080, 400)

      // === ITEM NAME ===
      ctx.fillStyle = "#ffffff"
      ctx.font = "bold 52px Arial"
      const label = item._label || "Amazing Deal"
      const shortLabel = label.length > 28 ? label.substring(0,28)+"..." : label
      ctx.fillText(shortLabel, 40, 760)

      // === DESCRIPTION ===
      if (item.description || item.name) {
        const desc = (item.description||item.name||"").substring(0,60)
        ctx.fillStyle = "#888888"
        ctx.font = "26px Arial"
        ctx.fillText(desc.length>55?desc.substring(0,55)+"...":desc, 40, 810)
      }

      // === PRICE ===
      if (item._price && Number(item._price) > 0) {
        ctx.fillStyle = "#E6821E"
        ctx.font = "bold 64px Arial"
        ctx.fillText(`KES ${Number(item._price).toLocaleString()}`, 40, 890)
      }

      // === PROVIDER ===
      const sub = item.showroom_name || item.business_name || ""
      if (sub) {
        ctx.fillStyle = "#cccccc"
        ctx.font = "28px Arial"
        ctx.fillText(`🏢 ${sub}`, 40, 950)
      }

      // === DIVIDER ===
      ctx.fillStyle = "#222222"
      ctx.fillRect(0, 970, 1080, 2)

      // === FOOTER ===
      ctx.fillStyle = "#E6821E"
      ctx.font = "bold 30px Arial"
      ctx.fillText("carcareconnect.care", 40, 1040)
      ctx.fillStyle = "#666666"
      ctx.font = "26px Arial"
      ctx.fillText("📞 0113858966", 420, 1040)
      ctx.fillStyle = "#444444"
      ctx.font = "22px Arial"
      ctx.fillText("✉ carcareconnect254@gmail.com", 680, 1040)

      // === VERIFIED BADGE if applicable ===
      if (item.is_verified) {
        ctx.fillStyle = "#1d9e75"
        ctx.beginPath()
        ctx.roundRect(40, 895, 200, 44, 10)
        ctx.fill()
        ctx.fillStyle = "#ffffff"
        ctx.font = "bold 22px Arial"
        ctx.fillText("✓ VERIFIED", 70, 923)
      }

      // === DOWNLOAD ===
      const link = document.createElement("a")
      link.download = `CCC-${(item._label||"content").replace(/\s+/g,"-")}-card.png`
      link.href = canvas.toDataURL("image/png")
      link.click()
      toast.success("Content card downloaded! 🎨")
    } catch(e) { toast.error("Card generation failed: " + e.message) }
    finally { setDownloading(false) }
  }

  async function markAsPosted(itemId, platform) {
    const { error } = await supabase.from("content_posts").insert({
      item_id: itemId,
      item_type: selected?._type,
      platform,
      posted_at: new Date().toISOString(),
      caption,
    })
    if (error) return toast.error(error.message)
    toast.success(`✅ Marked as posted on ${platformInfo?.label}!`)
  }

  async function schedulePost() {
    if (!scheduleForm.date||!scheduleForm.time) return toast.error("Please select date and time")
    const { error } = await supabase.from("scheduled_posts").insert({
      item_id: selected.id,
      item_type: selected._type,
      item_label: selected._label,
      platform,
      caption,
      scheduled_for: `${scheduleForm.date}T${scheduleForm.time}:00`,
      status: "scheduled"
    })
    if (error) return toast.error(error.message)
    toast.success("Post scheduled!")
    setShowScheduleForm(false)
    setScheduleForm({ date:"", time:"" })
    loadScheduledPosts()
  }

  async function loadScheduledPosts() {
    const { data } = await supabase.from("scheduled_posts").select("*").eq("status","scheduled").order("scheduled_for",{ascending:true})
    setScheduledPosts(data||[])
  }

  useEffect(() => { loadScheduledPosts() }, [])

  async function createCampaign(e) {
    e.preventDefault()
    await supabase.from("content_campaigns").insert({ name:campaignForm.name, description:campaignForm.description })
    toast.success("Campaign created!")
    setCampaignForm({ name:"", description:"" })
    setShowCampaignForm(false)
    loadCampaigns()
  }

  const filtered = (selected&&isMobile?items.filter(i=>i.id===selected.id):items).filter(i => !search || i._label?.toLowerCase().includes(search.toLowerCase()))
  const platformInfo = PLATFORMS.find(p=>p.key===platform)
  const charCount = caption.length
  const charLimit = platformInfo?.maxChars
  const overLimit = charLimit && charCount > charLimit

  return (
    <div>
      <div style={{ fontFamily:"Syne", fontSize:isMobile?18:24, fontWeight:800, color:"#000", marginBottom:4 }}>Content Hub 🎬</div>
      <div style={{ fontSize:12, color:"#777", marginBottom:"1.5rem" }}>Generate, download and share content for all your social media platforms</div>

      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(4,1fr)", gap:10, marginBottom:"1.5rem" }}>
        {[
          { label:"Available content", value:items.length, color:"#000" },
          { label:"With photos", value:items.filter(i=>i._photos?.length>0).length, color:"#378add" },
          { label:"With videos", value:items.filter(i=>i._video).length, color:"#8b5cf6" },
          { label:"Campaigns", value:campaigns.length, color:"#e6821e" },
        ].map(s=>(
          <div key={s.label} style={{ background:"#f8f8f8", borderRadius:10, padding:"0.75rem", border:"1px solid #eeeeee", textAlign:"center" }}>
            <div style={{ fontFamily:"Syne", fontSize:isMobile?16:22, fontWeight:800, color:s.color }}>{s.value}</div>
            <div style={{ fontSize:10, color:"#888", marginTop:2 }}>{s.label}</div>
          </div>
        ))}
      </div>

        {/* Social Accounts Setup */}
        <div style={{ background:"#0f0f0f", borderRadius:12, padding:"0.875rem 1rem", marginBottom:"1.25rem" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:showSocialSetup?12:0 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:800, color:"#fff" }}>📱 Your Social Accounts</div>
              <div style={{ fontSize:9, color:"#555", background:"#1a1a1a", borderRadius:10, padding:"2px 8px" }}>
                {Object.values(socialAccounts).filter(v=>v).length}/6 connected
              </div>
            </div>
            <button onClick={()=>setShowSocialSetup(s=>!s)}
              style={{ background:"#1a1a1a", border:"none", borderRadius:8, color:"#888", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>
              {showSocialSetup?"Done":"⚙ Setup"}
            </button>
          </div>
          {!showSocialSetup&&(
            <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginTop:8 }}>
              {[
                { key:"whatsapp", icon:"💚", label:"WhatsApp" },
                { key:"tiktok", icon:"🎵", label:"TikTok" },
                { key:"instagram", icon:"📸", label:"Instagram" },
                { key:"facebook", icon:"👥", label:"Facebook" },
                { key:"x", icon:"🐦", label:"X" },
                { key:"youtube", icon:"▶️", label:"YouTube" },
              ].map(p=>(
                <div key={p.key} style={{ display:"flex", alignItems:"center", gap:4, background:"#1a1a1a", borderRadius:20, padding:"4px 10px", border:`1px solid ${socialAccounts[p.key]?"#1d9e7540":"#2a2a2a"}` }}>
                  <span style={{ fontSize:12 }}>{p.icon}</span>
                  <span style={{ fontSize:10, color:socialAccounts[p.key]?"#1d9e75":"#555" }}>{socialAccounts[p.key]?"✓":"–"}</span>
                </div>
              ))}
            </div>
          )}
          {showSocialSetup&&(
            <div style={{ display:"grid", gap:8 }}>
              {[
                { key:"whatsapp", icon:"💚", label:"WhatsApp", placeholder:"https://wa.me/254113858966" },
                { key:"tiktok", icon:"🎵", label:"TikTok", placeholder:"https://www.tiktok.com/@yourhandle" },
                { key:"instagram", icon:"📸", label:"Instagram", placeholder:"https://www.instagram.com/yourhandle" },
                { key:"facebook", icon:"👥", label:"Facebook", placeholder:"https://www.facebook.com/yourpage" },
                { key:"x", icon:"🐦", label:"X (Twitter)", placeholder:"https://twitter.com/yourhandle" },
                { key:"youtube", icon:"▶️", label:"YouTube", placeholder:"https://youtube.com/@yourchannel" },
              ].map(p=>(
                <div key={p.key} style={{ display:"flex", gap:6, alignItems:"center" }}>
                  <span style={{ fontSize:16, flexShrink:0 }}>{p.icon}</span>
                  <input
                    defaultValue={socialAccounts[p.key]}
                    placeholder={p.placeholder}
                    onBlur={e=>saveSocialAccount(p.key, e.target.value.trim())}
                    style={{ flex:1, background:"#1a1a1a", border:"1px solid #2a2a2a", borderRadius:8, padding:"7px 10px", fontSize:11, color:"#ccc", outline:"none", fontFamily:"DM Sans,sans-serif" }}/>
                  {socialAccounts[p.key]&&<span style={{ fontSize:14, color:"#1d9e75", flexShrink:0 }}>✓</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      {/* Content type tabs */}
      <div style={{ display:"flex", gap:6, marginBottom:"1.25rem", flexWrap:"wrap" }}>
        {[
          {k:"new_cars",l:"🚗 New Cars"},
          {k:"marketplace",l:"🛒 Marketplace"},
          {k:"services",l:"🔧 Services"},
          {k:"providers",l:"🏪 Providers"},{k:"inventory",l:"📦 Inventory"},
        ].map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k)}
            style={{ padding:"8px 16px", borderRadius:8, border:"none", fontSize:12, cursor:"pointer", background:tab===t.k?"#e6821e":"#f8f8f8", color:tab===t.k?"#fff":"#666", fontWeight:tab===t.k?700:400 }}>
            {t.l}
          </button>
        ))}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:selected&&!isMobile?"1fr 420px":"1fr", gap:"1.5rem" }}>
        {/* Content list */}
        <div>
          {selected&&isMobile&&(
            <button onClick={()=>setSelected(null)}
              style={{ background:"none", border:"none", color:"#e6821e", cursor:"pointer", fontSize:13, marginBottom:8, padding:0, fontFamily:"DM Sans,sans-serif", display:"flex", alignItems:"center", gap:4 }}>
              ← Back to all content
            </button>
          )}
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search content..."
            style={{ width:"100%", background:"#f8f8f8", border:"1px solid #eeeeee", borderRadius:8, padding:"9px 12px", fontSize:12, outline:"none", marginBottom:10, fontFamily:"DM Sans,sans-serif" }}/>

          {loading&&<div style={{ color:"#888", fontSize:13 }}>Loading...</div>}
          {!loading&&filtered.length===0&&<div style={{ color:"#888", fontSize:13, textAlign:"center", padding:"2rem" }}>No content found</div>}

          <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"repeat(2,1fr)", gap:10 }}>
            {filtered.map(item=>(
              <div key={item.id} onClick={()=>selectItem(item)}
                style={{ background:selected?.id===item.id?"#fff8f0":"#ffffff", border:`1px solid ${selected?.id===item.id?"#e6821e":"#eeeeee"}`, borderRadius:12, padding:"0.75rem", cursor:"pointer" }}>
                {/* Photo/Video preview */}
                <div style={{ position:"relative", marginBottom:8 }}>
                  {item._photos?.[0] ? (
                    <img src={item._photos[0]} alt="" style={{ width:"100%", height:140, objectFit:"cover", borderRadius:8 }}/>
                  ):(
                    <div style={{ width:"100%", height:140, background:"#f0f0f0", borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", fontSize:36 }}>
                      {item._category_icon||( item._type==="car"?"🚗":item._type==="wash"?"🚿":item._type==="service"?"🔧":"📦")}
                    </div>
                  )}
                  {item._video&&(
                    <div style={{ position:"absolute", top:8, right:8, background:"rgba(0,0,0,0.7)", borderRadius:6, padding:"2px 8px", fontSize:10, color:"#fff" }}>
                      🎥 Video
                    </div>
                  )}
                  {item._photos?.length>1&&(
                    <div style={{ position:"absolute", top:8, left:8, background:"rgba(0,0,0,0.7)", borderRadius:6, padding:"2px 8px", fontSize:10, color:"#fff" }}>
                      📷 {item._photos.length}
                    </div>
                  )}
                </div>
                <div style={{ fontSize:13, fontWeight:600, color:"#000", marginBottom:2 }}>{item._label}</div>
                {item._price&&<div style={{ fontSize:12, color:"#e6821e", fontWeight:700 }}>KES {Number(item._price).toLocaleString()}</div>}
                {(item.showroom_name||item.business_name)&&<div style={{ fontSize:10, color:"#888" }}>🏢 {item.showroom_name||item.business_name}</div>}
              </div>
            ))}
          </div>
        </div>

        {/* Content generator panel */}
        {selected&&(
          <div ref={studioRef} style={{ position:isMobile?"static":"sticky", top:80, scrollMarginTop:16 }}>
            {/* POST STUDIO */}
            <div style={{ background:"#0f0f0f", borderRadius:20, overflow:"hidden", marginBottom:"1rem" }}>
              <div style={{ padding:"1rem 1.25rem 0.75rem", borderBottom:"1px solid #1e1e1e", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div>
                  <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:800, color:"#fff" }}>✦ Post Studio</div>
                  <div style={{ fontSize:10, color:"#555" }}>Build content for your platforms</div>
                </div>
                {selected&&<div style={{ fontSize:10, color:"#e6821e", background:"#e6821e15", border:"1px solid #e6821e30", borderRadius:10, padding:"3px 8px" }}>{selected._type?.toUpperCase()}</div>}
              </div>

              {/* Image preview */}
              {selectedPhoto ? (
                <div style={{ position:"relative" }}>
                  <img src={selectedPhoto} alt="" style={{ width:"100%", height:190, objectFit:"cover", display:"block" }}/>
                  <div style={{ position:"absolute", inset:0, background:"linear-gradient(to bottom, transparent 50%, #0f0f0f)" }}/>
                  <div style={{ position:"absolute", bottom:10, left:12, right:12 }}>
                    <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:800, color:"#fff" }}>{selected?._label}</div>
                    {selected?._price&&<div style={{ fontSize:12, color:"#e6821e", fontWeight:700 }}>KES {Number(selected._price).toLocaleString()}</div>}
                  </div>
                  {selected?._photos?.length>1&&(
                    <div style={{ position:"absolute", top:8, right:8, background:"rgba(0,0,0,0.6)", borderRadius:10, padding:"2px 8px", fontSize:10, color:"#fff" }}>
                      📷 {selected._photos.length}
                    </div>
                  )}
                </div>
              ) : selected ? (
                <div style={{ height:120, background:"#1a1a1a", display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:6 }}>
                  <div style={{ fontSize:40 }}>{selected._category_icon||"🔧"}</div>
                  <div style={{ fontFamily:"Syne", fontSize:12, fontWeight:700, color:"#fff" }}>{selected._label}</div>
                  {selected._price&&<div style={{ fontSize:11, color:"#e6821e" }}>KES {Number(selected._price).toLocaleString()}</div>}
                </div>
              ) : (
                <div style={{ height:100, background:"#1a1a1a", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <div style={{ fontSize:12, color:"#333" }}>← Select an item to generate content</div>
                </div>
              )}

              <div style={{ padding:"1rem 1.25rem" }}>
                {/* Platform pills */}
                <div style={{ marginBottom:"1rem" }}>
                  <div style={{ fontSize:9, color:"#444", marginBottom:6, textTransform:"uppercase", letterSpacing:"0.08em" }}>Platform</div>
                  <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                    {PLATFORMS.map(p=>(
                      <button key={p.key} onClick={()=>updateCaption(p.key)}
                        style={{ background:platform===p.key?p.color:"#1e1e1e", border:`1px solid ${platform===p.key?p.color:"#2a2a2a"}`, borderRadius:20, padding:"4px 10px", cursor:"pointer", display:"flex", alignItems:"center", gap:4, transition:"all 0.15s" }}>
                        <span style={{ fontSize:11 }}>{p.icon}</span>
                        <span style={{ fontSize:10, color:platform===p.key?"#fff":"#555", fontWeight:platform===p.key?700:400 }}>{p.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Caption */}
                <div style={{ marginBottom:"0.75rem" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                    <div style={{ fontSize:9, color:"#444", textTransform:"uppercase", letterSpacing:"0.08em" }}>Caption</div>
                    {charLimit&&<div style={{ fontSize:9, color:overLimit?"#e24b4a":"#444" }}>{charCount}/{charLimit}</div>}
                  </div>
                  <textarea value={caption} onChange={e=>setCaption(e.target.value)}
                    style={{ width:"100%", background:"#1a1a1a", border: overLimit ? "1px solid #e24b4a" : "1px solid #2a2a2a", borderRadius:10, padding:"10px 12px", fontSize:11, outline:"none", resize:"vertical", minHeight:130, fontFamily:"DM Sans,sans-serif", lineHeight:1.6, color:"#ccc" }}/>
                </div>

                {/* URL row */}
                {selected&&(
                  <div style={{ display:"flex", gap:6, alignItems:"center", marginBottom:"0.75rem", background:"#1a1a1a", border:"1px solid #2a2a2a", borderRadius:8, padding:"6px 10px" }}>
                    <span style={{ fontSize:11 }}>🔗</span>
                    <div style={{ flex:1, fontSize:9, color:"#378add", fontFamily:"monospace", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{getItemUrl(selected)}</div>
                    <button onClick={()=>{ navigator.clipboard.writeText(getItemUrl(selected)); toast.success("URL copied!") }}
                      style={{ background:"#378add20", border:"none", borderRadius:6, color:"#378add", fontSize:10, fontWeight:700, padding:"3px 8px", cursor:"pointer", flexShrink:0 }}>
                      Copy
                    </button>
                  </div>
                )}

                {/* Photo strip */}
                {selected?._photos?.length>0&&(
                  <div style={{ marginBottom:"0.75rem" }}>
                    <div style={{ fontSize:9, color:"#444", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:5 }}>Photos</div>
                    <div style={{ display:"flex", gap:5, overflowX:"auto", paddingBottom:4 }}>
                      {selected._photos.map((p,i)=>(
                        <div key={i} onClick={()=>setSelectedPhoto(p)} style={{ position:"relative", flexShrink:0, cursor:"pointer" }}>
                          <img src={p} alt="" style={{ width:54, height:54, objectFit:"cover", borderRadius:8, border:`2px solid ${selectedPhoto===p?"#e6821e":"#2a2a2a"}`, display:"block" }}/>
                          {selectedPhoto===p&&<div style={{ position:"absolute", top:2, right:2, background:"#e6821e", borderRadius:"50%", width:14, height:14, display:"flex", alignItems:"center", justifyContent:"center", fontSize:8, color:"#fff" }}>✓</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action buttons */}
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, marginBottom:"0.75rem" }}>
                  <button onClick={copyCaption}
                    style={{ background:"#e6821e", border:"none", borderRadius:10, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:11, fontWeight:700, padding:"9px", cursor:"pointer" }}>
                    📋 Copy Caption
                  </button>
                  <button onClick={()=>selected&&generateContentCard(selected)} disabled={downloading}
                    style={{ background:"#1d9e75", border:"none", borderRadius:10, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:11, fontWeight:700, padding:"9px", cursor:downloading?"not-allowed":"pointer", opacity:downloading?0.6:1 }}>
                    {downloading?"Generating...":"🖼 Branded Card"}
                  </button>
                </div>

                {/* Video download */}
                {selected?._video&&(
                  <div style={{ marginBottom:"0.75rem" }}>
                    <div style={{ position:"relative", borderRadius:10, overflow:"hidden", marginBottom:6 }}>
                      <video src={selected._video} controls style={{ width:"100%", borderRadius:10, display:"block", maxHeight:180, background:"#000" }}/>
                      <div style={{ position:"absolute", top:6, right:6, background:"rgba(0,0,0,0.6)", borderRadius:6, padding:"2px 8px", fontSize:10, color:"#fff" }}>📹 Video</div>
                    </div>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:5 }}>
                      <button onClick={()=>downloadVideo(selected._video, `CCC-${(selected._label||"video").replace(/\\s+/g,"-")}.mp4`)} disabled={downloading}
                        style={{ background:"#8b5cf6", border:"none", borderRadius:8, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:11, fontWeight:700, padding:"8px", cursor:downloading?"not-allowed":"pointer", opacity:downloading?0.6:1 }}>
                        {downloading?"...":"⬇ Download"}
                      </button>
                      <button onClick={()=>{ navigator.clipboard.writeText(selected._video); toast.success("Video URL copied!") }}
                        style={{ background:"#1e1e1e", border:"1px solid #2a2a2a", borderRadius:8, color:"#aaa", fontFamily:"Syne,sans-serif", fontSize:11, fontWeight:700, padding:"8px", cursor:"pointer" }}>
                        🔗 Copy URL
                      </button>
                    </div>
                  </div>
                )}

                {/* Download all photos */}
                {selected?._photos?.length>0&&(
                  <button onClick={()=>selected._photos.forEach((p,i)=>setTimeout(()=>downloadPhoto(p,`CCC-photo-${i+1}.jpg`),i*600))}
                    style={{ width:"100%", background:"#1e1e1e", border:"1px solid #2a2a2a", borderRadius:10, color:"#888", fontFamily:"Syne,sans-serif", fontSize:11, fontWeight:700, padding:"8px", cursor:"pointer", marginBottom:"0.75rem" }}>
                    ⬇ Download All Photos
                  </button>
                )}

                {/* Share row */}
                <div style={{ marginBottom:"0.75rem" }}>
                  <div style={{ fontSize:9, color:"#444", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:5 }}>Share directly</div>
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(6,1fr)", gap:4 }}>
                    {PLATFORMS.map(p=>(
                      <button key={p.key} onClick={()=>shareToSocial(p.key)}
                        style={{ background:p.color+"18", border:`1px solid ${p.color}30`, borderRadius:8, color:p.color, padding:"8px 2px", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
                        <span style={{ fontSize:16 }}>{p.icon}</span>
                        <span style={{ fontSize:7, fontWeight:700 }}>{["instagram","tiktok","youtube"].includes(p.key)?"Open":"Share"}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Track + Schedule row */}
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
                  <button onClick={()=>selected&&markAsPosted(selected.id, platform)}
                    style={{ background:"#1e1e1e", border:"1px solid #1d9e7530", borderRadius:10, color:"#1d9e75", fontFamily:"Syne,sans-serif", fontSize:10, fontWeight:700, padding:"9px 4px", cursor:"pointer" }}>
                    ✓ Mark Posted
                  </button>
                  <button onClick={()=>setShowScheduleForm(s=>!s)}
                    style={{ background:"#1e1e1e", border:"1px solid #8b5cf630", borderRadius:10, color:"#8b5cf6", fontFamily:"Syne,sans-serif", fontSize:10, fontWeight:700, padding:"9px 4px", cursor:"pointer" }}>
                    📅 Schedule
                  </button>
                </div>

                {/* Schedule form */}
                {showScheduleForm&&(
                  <div style={{ background:"#1a1a1a", border:"1px solid #2a2a2a", borderRadius:10, padding:"0.75rem", marginTop:6 }}>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:8 }}>
                      <div>
                        <label style={{ fontSize:9, color:"#555", display:"block", marginBottom:3, textTransform:"uppercase" }}>Date</label>
                        <input type="date" value={scheduleForm.date} onChange={e=>setScheduleForm(f=>({...f,date:e.target.value}))} min={new Date().toISOString().split("T")[0]}
                          style={{ width:"100%", background:"#0f0f0f", border:"1px solid #2a2a2a", borderRadius:6, padding:"7px 8px", fontSize:11, outline:"none", color:"#ccc" }}/>
                      </div>
                      <div>
                        <label style={{ fontSize:9, color:"#555", display:"block", marginBottom:3, textTransform:"uppercase" }}>Time</label>
                        <input type="time" value={scheduleForm.time} onChange={e=>setScheduleForm(f=>({...f,time:e.target.value}))}
                          style={{ width:"100%", background:"#0f0f0f", border:"1px solid #2a2a2a", borderRadius:6, padding:"7px 8px", fontSize:11, outline:"none", color:"#ccc" }}/>
                      </div>
                    </div>
                    <div style={{ display:"flex", gap:6 }}>
                      <button onClick={schedulePost} style={{ flex:2, background:"#8b5cf6", border:"none", borderRadius:7, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:11, fontWeight:700, padding:"8px", cursor:"pointer" }}>Schedule</button>
                      <button onClick={()=>setShowScheduleForm(false)} style={{ flex:1, background:"none", border:"1px solid #2a2a2a", borderRadius:7, color:"#555", fontSize:11, padding:"8px", cursor:"pointer" }}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      {/* Scheduled Posts Section */}
      {scheduledPosts.length>0&&(
        <div style={{ marginTop:"2rem" }}>
          <div style={{ fontFamily:"Syne", fontSize:15, fontWeight:800, color:"#000", marginBottom:10 }}>📅 Scheduled Posts ({scheduledPosts.length})</div>
          <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"repeat(2,1fr)", gap:8 }}>
            {scheduledPosts.map(p=>(
              <div key={p.id} style={{ background:"#f5f3ff", border:"1px solid #8b5cf630", borderRadius:10, padding:"0.75rem" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:4 }}>
                  <div style={{ fontSize:12, fontWeight:600, color:"#000" }}>{p.item_label}</div>
                  <span style={{ fontSize:10, background:"#8b5cf6", color:"#fff", padding:"2px 8px", borderRadius:10 }}>{p.platform}</span>
                </div>
                <div style={{ fontSize:11, color:"#8b5cf6", marginBottom:4 }}>📅 {new Date(p.scheduled_for).toLocaleString()}</div>
                <div style={{ fontSize:10, color:"#888", lineHeight:1.4 }}>{p.caption?.substring(0,80)}...</div>
              </div>
            ))}
          </div>
        </div>
      )}

        {/* Campaigns Section */}
        <div style={{ marginTop:"2rem", background:"#0f0f0f", borderRadius:16, padding:"1.25rem" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1rem" }}>
            <div>
              <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:800, color:"#fff" }}>🎯 Campaigns</div>
              <div style={{ fontSize:10, color:"#555", marginTop:2 }}>Organize your content into campaigns</div>
            </div>
            <button onClick={()=>setShowCampaignForm(f=>!f)}
              style={{ background:showCampaignForm?"#2a2a2a":"#e6821e", border:"none", borderRadius:8, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:11, fontWeight:700, padding:"7px 14px", cursor:"pointer" }}>
              {showCampaignForm?"✕ Cancel":"+ New Campaign"}
            </button>
          </div>
          {showCampaignForm&&(
            <div style={{ background:"#1a1a1a", border:"1px solid #2a2a2a", borderRadius:12, padding:"1rem", marginBottom:"1rem" }}>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:8 }}>
                <div>
                  <label style={{ fontSize:9, color:"#555", display:"block", marginBottom:3, textTransform:"uppercase" }}>Campaign Name</label>
                  <input value={campaignForm.name} onChange={e=>setCampaignForm(f=>({...f,name:e.target.value}))} placeholder="e.g. December Deals"
                    style={{ width:"100%", background:"#0f0f0f", border:"1px solid #2a2a2a", borderRadius:8, padding:"8px 10px", fontSize:12, color:"#ccc", outline:"none", fontFamily:"DM Sans,sans-serif" }}/>
                </div>
                <div>
                  <label style={{ fontSize:9, color:"#555", display:"block", marginBottom:3, textTransform:"uppercase" }}>Description</label>
                  <input value={campaignForm.description} onChange={e=>setCampaignForm(f=>({...f,description:e.target.value}))} placeholder="What is this campaign about?"
                    style={{ width:"100%", background:"#0f0f0f", border:"1px solid #2a2a2a", borderRadius:8, padding:"8px 10px", fontSize:12, color:"#ccc", outline:"none", fontFamily:"DM Sans,sans-serif" }}/>
                </div>
              </div>
              <button onClick={createCampaign} style={{ background:"#e6821e", border:"none", borderRadius:8, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:12, fontWeight:700, padding:"9px 20px", cursor:"pointer" }}>
                Create Campaign
              </button>
            </div>
          )}
          {campaigns.length===0&&!showCampaignForm&&(
            <div style={{ textAlign:"center", padding:"2rem", color:"#333" }}>
              <div style={{ fontSize:32, marginBottom:8 }}>🎯</div>
              <div style={{ fontSize:12, color:"#555" }}>No campaigns yet</div>
              <div style={{ fontSize:10, color:"#444", marginTop:4 }}>Create campaigns to organize your content by theme or season</div>
            </div>
          )}
          <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"repeat(3,1fr)", gap:8 }}>
            {campaigns.map((camp,ci)=>(
              <div key={camp.id} style={{ background:"#1a1a1a", border:"1px solid #2a2a2a", borderRadius:12, padding:"0.875rem", position:"relative" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:4 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:"#fff" }}>{camp.name}</div>
                  <div style={{ width:10, height:10, borderRadius:"50%", background:["#e6821e","#378add","#1d9e75","#8b5cf6","#e24b4a"][ci%5], flexShrink:0 }}/>
                </div>
                {camp.description&&<div style={{ fontSize:10, color:"#666", marginBottom:6 }}>{camp.description}</div>}
                <div style={{ fontSize:9, color:"#444", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span>{new Date(camp.created_at).toLocaleDateString()}</span>
                  <button onClick={async()=>{ if(confirm("Delete campaign?")) { await supabase.from("content_campaigns").delete().eq("id",camp.id); loadCampaigns() } }}
                    style={{ background:"none", border:"none", color:"#555", cursor:"pointer", fontSize:12, padding:"2px 6px" }}>🗑</button>
                </div>
              </div>
            ))}
          </div>
        </div>
    {showGuide&&(
      <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", zIndex:9999, display:"flex", alignItems:"flex-end", justifyContent:"center", padding:"1rem" }}>
        <div style={{ background:"#1a1a1a", borderRadius:16, padding:"1.5rem", width:"100%", maxWidth:420 }} onClick={e=>e.stopPropagation()}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1rem" }}>
            <div style={{ fontFamily:"Syne", fontSize:15, fontWeight:800, color:"#fff" }}>{PLATFORMS.find(p=>p.key===showGuide)?.icon} Post on {PLATFORMS.find(p=>p.key===showGuide)?.label}</div>
            <button onClick={()=>setShowGuide(null)} style={{ background:"#2a2a2a", border:"none", borderRadius:"50%", width:28, height:28, color:"#aaa", cursor:"pointer", fontSize:14 }}>x</button>
          </div>
          {[
            { step:1, text:"Caption copied to clipboard" },
            { step:2, text:PLATFORMS.find(p=>p.key===showGuide)?.label+" is now open in new tab" },
            { step:3, text:"Tap + to create a new post" },
            { step:4, text:"Upload the branded card you downloaded" },
            { step:5, text:"Paste caption and post!" },
          ].map(s=>(
            <div key={s.step} style={{ display:"flex", alignItems:"flex-start", gap:10, marginBottom:8 }}>
              <div style={{ width:22, height:22, borderRadius:"50%", background:"#e6821e", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:800, color:"#fff", flexShrink:0 }}>{s.step}</div>
              <div style={{ fontSize:12, color:"#ccc", paddingTop:2 }}>{s.text}</div>
            </div>
          ))}
          <div style={{ background:"#e6821e15", border:"1px solid #e6821e30", borderRadius:8, padding:"0.75rem", fontSize:11, color:"#e6821e", marginTop:8 }}>Download branded card first using the image button above</div>
          <button onClick={()=>setShowGuide(null)} style={{ width:"100%", background:"#e6821e", border:"none", borderRadius:10, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"12px", cursor:"pointer", marginTop:"1rem" }}>Got it!</button>
        </div>
      </div>
    )}
    </div>
  )
}
