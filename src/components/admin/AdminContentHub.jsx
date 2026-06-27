import { useEffect, useState } from "react"
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

function generateCaption(item, platform, type) {
  const price = item.price || item.total_amount || ""
  const name = item.brand ? `${item.year} ${item.brand} ${item.model}` : item.service_name || item.name || item.title || "Amazing deal"
  const showroom = item.showroom_name || item.business_name || "Car Care Connect"
  const tags = type==="car" ? HASHTAGS.car : type==="wash" ? HASHTAGS.wash : type==="parts" ? HASHTAGS.parts : type==="service" ? HASHTAGS.service : HASHTAGS.general
  const url = "https://carcareconnect.care"

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

export default function AdminContentHub() {
  const isMobile = useIsMobile()
  const [tab, setTab] = useState("new_cars")
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [platform, setPlatform] = useState("whatsapp")
  const [caption, setCaption] = useState("")
  const [downloading, setDownloading] = useState(false)
  const [search, setSearch] = useState("")
  const [campaign, setCampaign] = useState("")
  const [campaigns, setCampaigns] = useState([])
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
      const { data: d } = await supabase.from("marketplace_listings").select("*").order("created_at",{ascending:false})
      data = (d||[]).map(i=>({...i, _type:i.listing_type||"parts", _label:i.title, _price:i.price, _photos:i.photos||[], _video:i.video_url }))
    } else if (tab==="services") {
      const { data: d } = await supabase.from("services").select("*, profiles!services_provider_id_fkey(business_name,first_name,last_name)").order("created_at",{ascending:false})
      data = (d||[]).map(i=>({...i, _type:"service", _label:i.name, _price:i.price, _photos:[], _video:null, business_name:i.profiles?.business_name||i.profiles?.first_name }))
    } else if (tab==="providers") {
      const { data: d } = await supabase.from("profiles").select("id,first_name,last_name,business_name,provider_type,avatar_url,city").eq("role","provider").order("created_at",{ascending:false})
      data = (d||[]).map(i=>({...i, _type:"service", _label:i.business_name||i.first_name, _price:null, _photos:i.photos||[], _video:null }))
    }
    setItems(data)
    setLoading(false)
  }

  async function loadCampaigns() {
    const { data } = await supabase.from("content_campaigns").select("*").order("created_at",{ascending:false})
    setCampaigns(data||[])
  }

  useEffect(() => { loadCampaigns() }, [])

  function selectItem(item) {
    setSelected(item)
    setCaption(generateCaption(item, platform, item._type))
  }

  function updateCaption(p) {
    setPlatform(p)
    if (selected) setCaption(generateCaption(selected, p, selected._type))
  }

  function copyCaption() {
    navigator.clipboard.writeText(caption)
    toast.success("Caption copied!")
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
      const res = await fetch(url)
      const blob = await res.blob()
      const a = document.createElement("a")
      a.href = URL.createObjectURL(blob)
      a.download = filename || "ccc-video.mp4"
      a.click()
      toast.success("Video downloaded!")
    } catch(e) { toast.error("Download failed — try right-click → Save video") }
    finally { setDownloading(false) }
  }

  async function generateContentCard(item) {
    setDownloading(true)
    try {
      const canvas = document.createElement("canvas")
      canvas.width = 1080
      canvas.height = 1080
      const ctx = canvas.getContext("2d")

      // Background
      ctx.fillStyle = "#ffffff"
      ctx.fillRect(0, 0, 1080, 1080)

      // Orange header bar
      ctx.fillStyle = "#E6821E"
      ctx.fillRect(0, 0, 1080, 160)

      // CCC Logo text
      ctx.fillStyle = "#ffffff"
      ctx.font = "bold 52px Arial"
      ctx.fillText("Car Care Connect", 40, 80)
      ctx.font = "24px Arial"
      ctx.fillStyle = "rgba(255,255,255,0.8)"
      ctx.fillText("Nairobi's #1 Automotive Marketplace", 40, 120)

      // Load and draw photo if available
      if (item._photos?.[0]) {
        try {
          const img = new Image()
          img.crossOrigin = "anonymous"
          await new Promise((res, rej) => {
            img.onload = res
            img.onerror = rej
            img.src = item._photos[0]
          })
          ctx.drawImage(img, 0, 160, 1080, 600)
        } catch(e) {
          ctx.fillStyle = "#f0f0f0"
          ctx.fillRect(0, 160, 1080, 600)
          ctx.fillStyle = "#888"
          ctx.font = "80px Arial"
          ctx.textAlign = "center"
          ctx.fillText("🚗", 540, 500)
          ctx.textAlign = "left"
        }
      } else {
        ctx.fillStyle = "#f0f0f0"
        ctx.fillRect(0, 160, 1080, 600)
        ctx.fillStyle = "#888"
        ctx.font = "80px Arial"
        ctx.textAlign = "center"
        ctx.fillText("🚗", 540, 500)
        ctx.textAlign = "left"
      }

      // Bottom info panel
      ctx.fillStyle = "#1a1a1a"
      ctx.fillRect(0, 760, 1080, 320)

      // Item name
      ctx.fillStyle = "#ffffff"
      ctx.font = "bold 44px Arial"
      const label = item._label || "Amazing Deal"
      ctx.fillText(label.length > 30 ? label.substring(0,30)+"..." : label, 40, 830)

      // Price
      if (item._price) {
        ctx.fillStyle = "#E6821E"
        ctx.font = "bold 52px Arial"
        ctx.fillText(`KES ${Number(item._price).toLocaleString()}`, 40, 900)
      }

      // Showroom/provider
      const sub = item.showroom_name || item.business_name || item.showroom_location || ""
      if (sub) {
        ctx.fillStyle = "#aaaaaa"
        ctx.font = "28px Arial"
        ctx.fillText(`🏢 ${sub}`, 40, 950)
      }

      // Website
      ctx.fillStyle = "#E6821E"
      ctx.font = "bold 28px Arial"
      ctx.fillText("carcareconnect.care", 40, 1020)

      // Phone
      ctx.fillStyle = "#aaaaaa"
      ctx.font = "24px Arial"
      ctx.fillText("📞 0113858966", 600, 1020)

      // Download
      const link = document.createElement("a")
      link.download = `CCC-${(item._label||"content").replace(/\s+/g,"-")}-card.png`
      link.href = canvas.toDataURL("image/png")
      link.click()
      toast.success("Content card downloaded!")
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

  const filtered = items.filter(i => !search || i._label?.toLowerCase().includes(search.toLowerCase()))
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

      {/* Content type tabs */}
      <div style={{ display:"flex", gap:6, marginBottom:"1.25rem", flexWrap:"wrap" }}>
        {[
          {k:"new_cars",l:"🚗 New Cars"},
          {k:"marketplace",l:"🛒 Marketplace"},
          {k:"services",l:"🔧 Services"},
          {k:"providers",l:"🏪 Providers"},
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
                      {item._type==="car"?"🚗":item._type==="wash"?"🚿":item._type==="service"?"🔧":"📦"}
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
          <div style={{ position:isMobile?"static":"sticky", top:80 }}>
            <div style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:16, padding:"1.25rem", marginBottom:"1rem" }}>
              <div style={{ fontFamily:"Syne", fontSize:15, fontWeight:800, color:"#000", marginBottom:"1rem" }}>📱 Post Generator</div>

              {/* Platform selector */}
              <div style={{ marginBottom:"1rem" }}>
                <div style={{ fontSize:11, color:"#666", marginBottom:6 }}>Select platform</div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:6 }}>
                  {PLATFORMS.map(p=>(
                    <button key={p.key} onClick={()=>updateCaption(p.key)}
                      style={{ background:platform===p.key?p.color:"#f8f8f8", border:`1px solid ${platform===p.key?p.color:"#eeeeee"}`, borderRadius:8, padding:"6px 4px", cursor:"pointer", textAlign:"center" }}>
                      <div style={{ fontSize:16 }}>{p.icon}</div>
                      <div style={{ fontSize:9, color:platform===p.key?"#fff":"#555", marginTop:2, fontWeight:platform===p.key?700:400 }}>{p.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Caption editor */}
              <div style={{ marginBottom:"1rem" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                  <div style={{ fontSize:11, color:"#666" }}>Caption</div>
                  {charLimit&&<div style={{ fontSize:10, color:overLimit?"#e24b4a":"#888" }}>{charCount}/{charLimit}</div>}
                </div>
                <textarea value={caption} onChange={e=>setCaption(e.target.value)}
                  style={{ width:"100%", background:"#f8f8f8", border:`1px solid ${overLimit?"#e24b4a":"#eeeeee"}`, borderRadius:8, padding:"10px 12px", fontSize:12, outline:"none", resize:"vertical", minHeight:160, fontFamily:"DM Sans,sans-serif", lineHeight:1.6 }}/>
                <button onClick={copyCaption} style={{ width:"100%", background:"#e6821e", border:"none", borderRadius:8, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"10px", cursor:"pointer", marginTop:6 }}>
                  📋 Copy Caption
                </button>
              </div>

              {/* Photo downloads */}
              {selected._photos?.length>0&&(
                <div style={{ marginBottom:"1rem" }}>
                  <div style={{ fontSize:11, color:"#666", marginBottom:6 }}>📷 Download Photos ({selected._photos.length})</div>
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                    {selected._photos.map((p,i)=>(
                      <div key={i} style={{ position:"relative" }}>
                        <img src={p} alt="" style={{ width:60, height:60, objectFit:"cover", borderRadius:6, border:"1px solid #eee" }}/>
                        <button onClick={()=>downloadPhoto(p, `CCC-photo-${i+1}.jpg`)}
                          style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.5)", border:"none", borderRadius:6, color:"#fff", fontSize:16, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
                          ⬇
                        </button>
                      </div>
                    ))}
                    <button onClick={()=>selected._photos.forEach((p,i)=>setTimeout(()=>downloadPhoto(p,`CCC-photo-${i+1}.jpg`),i*500))}
                      style={{ background:"#eff6ff", border:"1px solid #378add40", borderRadius:6, color:"#378add", fontSize:10, padding:"4px 8px", cursor:"pointer", alignSelf:"center" }}>
                      ⬇ All
                    </button>
                  </div>
                </div>
              )}

              {/* Video download */}
              {selected._video&&(
                <div style={{ marginBottom:"1rem" }}>
                  <div style={{ fontSize:11, color:"#666", marginBottom:6 }}>🎥 Video</div>
                  <video src={selected._video} controls style={{ width:"100%", borderRadius:8, maxHeight:160 }}/>
                  <button onClick={()=>downloadVideo(selected._video, `CCC-${selected._label?.replace(/\s+/g,"-")}-video.mp4`)} disabled={downloading}
                    style={{ width:"100%", background:"#8b5cf6", border:"none", borderRadius:8, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:12, fontWeight:700, padding:"9px", cursor:"pointer", marginTop:6 }}>
                    {downloading?"Downloading...":"⬇ Download Video"}
                  </button>
                </div>
              )}

              {/* Content card generator */}
              <div style={{ marginBottom:"1rem" }}>
                <div style={{ fontSize:11, color:"#666", marginBottom:6 }}>🖼️ Generate Content Card</div>
                <button onClick={()=>generateContentCard(selected)} disabled={downloading}
                  style={{ width:"100%", background:"#1d9e75", border:"none", borderRadius:8, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:12, fontWeight:700, padding:"10px", cursor:"pointer" }}>
                  {downloading?"Generating...":"⬇ Download Branded Card (1080×1080)"}
                </button>
                <div style={{ fontSize:10, color:"#888", marginTop:4, textAlign:"center" }}>Square format — perfect for Instagram, Facebook & WhatsApp</div>
              </div>

              {/* Mark as posted */}
              <div style={{ marginBottom:"1rem" }}>
                <div style={{ fontSize:11, color:"#666", marginBottom:6 }}>✅ Track posting</div>
                <button onClick={()=>markAsPosted(selected.id, platform)}
                  style={{ width:"100%", background:"#f0fdf4", border:"1px solid #1d9e7540", borderRadius:8, color:"#1d9e75", fontFamily:"Syne,sans-serif", fontSize:12, fontWeight:700, padding:"9px", cursor:"pointer" }}>
                  ✓ Mark as posted on {platformInfo?.label}
                </button>
              </div>

              {/* Schedule post */}
              <div>
                <div style={{ fontSize:11, color:"#666", marginBottom:6 }}>📅 Schedule post</div>
                {!showScheduleForm ? (
                  <button onClick={()=>setShowScheduleForm(true)}
                    style={{ width:"100%", background:"#f5f3ff", border:"1px solid #8b5cf640", borderRadius:8, color:"#8b5cf6", fontFamily:"Syne,sans-serif", fontSize:12, fontWeight:700, padding:"9px", cursor:"pointer" }}>
                    📅 Schedule for later
                  </button>
                ):(
                  <div style={{ background:"#f5f3ff", border:"1px solid #8b5cf630", borderRadius:8, padding:"0.75rem" }}>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:8 }}>
                      <div>
                        <label style={{ fontSize:10, color:"#666", display:"block", marginBottom:3 }}>Date</label>
                        <input type="date" value={scheduleForm.date} onChange={e=>setScheduleForm(f=>({...f,date:e.target.value}))} min={new Date().toISOString().split("T")[0]}
                          style={{ width:"100%", background:"#fff", border:"1px solid #e5e5e5", borderRadius:6, padding:"7px 8px", fontSize:12, outline:"none" }}/>
                      </div>
                      <div>
                        <label style={{ fontSize:10, color:"#666", display:"block", marginBottom:3 }}>Time</label>
                        <input type="time" value={scheduleForm.time} onChange={e=>setScheduleForm(f=>({...f,time:e.target.value}))}
                          style={{ width:"100%", background:"#fff", border:"1px solid #e5e5e5", borderRadius:6, padding:"7px 8px", fontSize:12, outline:"none" }}/>
                      </div>
                    </div>
                    <div style={{ display:"flex", gap:6 }}>
                      <button onClick={schedulePost} style={{ flex:2, background:"#8b5cf6", border:"none", borderRadius:7, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:12, fontWeight:700, padding:"8px", cursor:"pointer" }}>Schedule</button>
                      <button onClick={()=>setShowScheduleForm(false)} style={{ flex:1, background:"none", border:"1px solid #ddd", borderRadius:7, color:"#888", fontSize:12, padding:"8px", cursor:"pointer" }}>Cancel</button>
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
      <div style={{ marginTop:"2rem" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
          <div style={{ fontFamily:"Syne", fontSize:15, fontWeight:800, color:"#000" }}>🎯 Campaigns ({campaigns.length})</div>
          <button onClick={()=>setShowCampaignForm(f=>!f)}
            style={{ background:"#e6821e", border:"none", borderRadius:8, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:12, fontWeight:700, padding:"7px 14px", cursor:"pointer" }}>
            + New Campaign
          </button>
        </div>
        {showCampaignForm&&(
          <form onSubmit={createCampaign} style={{ background:"#fff8f0", border:"1px solid #e6821e30", borderRadius:10, padding:"1rem", marginBottom:"1rem" }}>
            <div style={{ marginBottom:8 }}>
              <label style={{ fontSize:11, color:"#666", display:"block", marginBottom:3 }}>Campaign name</label>
              <input value={campaignForm.name} onChange={e=>setCampaignForm(f=>({...f,name:e.target.value}))} placeholder="e.g. December Deals" required
                style={{ width:"100%", background:"#fff", border:"1px solid #e5e5e5", borderRadius:7, padding:"8px 10px", fontSize:12, outline:"none" }}/>
            </div>
            <div style={{ marginBottom:10 }}>
              <label style={{ fontSize:11, color:"#666", display:"block", marginBottom:3 }}>Description</label>
              <input value={campaignForm.description} onChange={e=>setCampaignForm(f=>({...f,description:e.target.value}))} placeholder="What is this campaign about?"
                style={{ width:"100%", background:"#fff", border:"1px solid #e5e5e5", borderRadius:7, padding:"8px 10px", fontSize:12, outline:"none" }}/>
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button type="submit" style={{ background:"#e6821e", border:"none", borderRadius:7, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:12, fontWeight:700, padding:"8px 16px", cursor:"pointer" }}>Create</button>
              <button type="button" onClick={()=>setShowCampaignForm(false)} style={{ background:"none", border:"1px solid #ddd", borderRadius:7, color:"#888", fontSize:12, padding:"8px 12px", cursor:"pointer" }}>Cancel</button>
            </div>
          </form>
        )}
        {campaigns.length===0&&!showCampaignForm&&<div style={{ color:"#888", fontSize:13, textAlign:"center", padding:"1.5rem" }}>No campaigns yet — create one to organize your content</div>}
        <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"repeat(3,1fr)", gap:8 }}>
          {campaigns.map(camp=>(
            <div key={camp.id} style={{ background:"#ffffff", border:"1px solid #e6821e30", borderRadius:10, padding:"0.75rem" }}>
              <div style={{ fontSize:13, fontWeight:700, color:"#000", marginBottom:2 }}>{camp.name}</div>
              {camp.description&&<div style={{ fontSize:11, color:"#666", marginBottom:4 }}>{camp.description}</div>}
              <div style={{ fontSize:10, color:"#aaa" }}>{new Date(camp.created_at).toLocaleDateString()}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
