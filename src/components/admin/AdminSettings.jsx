import { WalletIcon, GOServiceIcon, VehicleIcon, ShieldIcon, SettingsIcon } from "../../lib/cccIcons"
import { useEffect, useState, useRef } from "react"
import { supabase } from "../../lib/supabase"
import useIsMobile from "../../lib/useIsMobile"
import toast from "react-hot-toast"
import { validateFile } from "../../lib/uploadValidation"
import { useAuth } from "../../contexts/AuthContext"

const SETTING_CATEGORIES = {
  "Commissions & Fees": { icon:"wallet", color:"#1d9e75", keys:["inspection_fee","go_service_callout_fee","concierge_surcharge_rate","marketplace_processing_fee_rate","marketplace_driver_commission_rate"] },
  "GO Service Rates": { icon:"emergency", color:"#e24b4a", keys:["go_callout_fee","go_callout_provider_rate","go_callout_platform_rate","go_service_provider_rate","go_service_platform_rate","go_parts_provider_rate","go_parts_platform_rate","go_provider_strike_limit"] },
  "New Car Marketplace": { icon:"vehicle", color:"#378add", keys:["new_car_listing_fee","new_car_lead_fee","new_car_featured_fee_day","new_car_featured_fee_week","new_car_featured_fee_month","new_car_listing_duration_days"] },
  "Payment & Banking": { icon:"🏦", color:"#8b5cf6", keys:["go_callout_fee","min_payout_amount","platform_bank_name","platform_bank_account","platform_bank_account_name","daraja_wallet_id"] },
}

export default function AdminSettings() {
  const { user, profile } = useAuth()
  if(!user || profile?.role !== "admin") return null
  const isMobile = useIsMobile()
  const [settings, setSettings] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ value:"", description:"" })
  const [saving, setSaving] = useState(false)
  const [logoUrl, setLogoUrl] = useState("/logo_c.svg")
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [expandedCat, setExpandedCat] = useState("Commissions & Fees")
  const logoInputRef = useRef(null)

  useEffect(() => { load(); loadLogo() }, [])

  async function loadLogo() {
    const { data } = await supabase.from("platform_settings").select("value").eq("key","logo_url").single()
    if (data?.value) setLogoUrl(data.value)
  }

  async function uploadLogo(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploadingLogo(true)
    try {
      const ext = file.name.split(".").pop()
      const path = `logo/platform_logo.${ext}`
      const { error } = await supabase.storage.from("platform-assets").upload(path, file, { upsert:true })
      if (error) throw error
      const { data } = supabase.storage.from("platform-assets").getPublicUrl(path)
      const url = data.publicUrl
      await supabase.from("platform_settings").upsert({ key:"logo_url", value:url, updated_at:new Date().toISOString() }, { onConflict:"key" })
      setLogoUrl(url)
      toast.success("Logo updated! Refresh to see changes everywhere.")
    } catch(err) { toast.error(err.message) }
    setUploadingLogo(false)
  }

  async function load() {
    const { data, error } = await supabase.from("app_settings").select("*").order("label")
    if (error) console.error("Settings load error:", error)
    setSettings(data||[])
    setLoading(false)
  }

  function startEdit(s) { setEditing(s.id); setForm({ value:s.value, description:s.description||"" }) }

  async function save() {
    if (!editing) return
    setSaving(true)
    try {
      const { error } = await supabase.from("app_settings").update({ value:form.value, description:form.description, updated_at:new Date().toISOString() }).eq("id", editing)
      if (error) throw error
      toast.success("Setting updated!")
      setEditing(null); load()
    } catch(e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  function formatValue(s) {
    if (s.type==="currency") return "KES "+Number(s.value).toLocaleString()
    if (s.type==="percentage") return s.value+"%"
    return s.value
  }

  function getCategory(key) {
    for (const [cat, config] of Object.entries(SETTING_CATEGORIES)) {
      if (config.keys.includes(key)) return cat
    }
    return "Other Settings"
  }

  const grouped = {}
  settings.forEach(s => { const cat = getCategory(s.key); if (!grouped[cat]) grouped[cat]=[]; grouped[cat].push(s) })
  const lastUpdated = settings.length>0 ? new Date(Math.max(...settings.map(s=>new Date(s.updated_at)))).toLocaleDateString() : "—"

  return (
    <div>
      <div style={{ fontFamily:"Syne", fontSize:isMobile?16:20, fontWeight:800, color:"#000", marginBottom:4 }}>Platform Settings</div>
      <div style={{ fontSize:12, color:"#888", marginBottom:"1.5rem" }}>Configure platform branding, fees, rates and settings</div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:"1.5rem" }}>
        {[
          { label:"Total settings", value:settings.length, color:"#000" },
          { label:"Last updated", value:lastUpdated, color:"#378add" },
          { label:"Categories", value:Object.keys(grouped).length, color:"#8b5cf6" },
        ].map(s=>(
          <div key={s.label} style={{ background:"#f8f8f8", borderRadius:10, padding:"0.75rem", border:"1px solid #eee", textAlign:"center" }}>
            <div style={{ fontFamily:"Syne", fontSize:16, fontWeight:800, color:s.color }}><span style={{ wordBreak:"break-all", fontSize:12 }}>{s.value||"—"}</span></div>
            <div style={{ fontSize:10, color:"#888", marginTop:2 }}>{s.label}</div>
          </div>
        ))}
      </div>
      {/* Settings Categories */}
      {loading&&<div style={{ color:"#888", fontSize:13 }}>Loading settings...</div>}
      {Object.entries(grouped).map(([category, catSettings]) => {
        const catConfig = SETTING_CATEGORIES[category] || { icon:"⚙️", color:"#888" }
        const isExpanded = expandedCat === category
        return (
          <div key={category} style={{ background:"#f8f8f8", border:"1px solid #eee", borderRadius:12, marginBottom:10, overflow:"hidden" }}>
            <button onClick={()=>setExpandedCat(isExpanded?null:category)}
              style={{ width:"100%", background:"none", border:"none", padding:"1rem", display:"flex", justifyContent:"space-between", alignItems:"center", cursor:"pointer" }}>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <div style={{ width:36, height:36, borderRadius:8, background:catConfig.color+"15", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  {catConfig.icon==="wallet"?<WalletIcon size={18} color={catConfig.color}/>:
                   catConfig.icon==="emergency"?<GOServiceIcon size={18} color={catConfig.color}/>:
                   catConfig.icon==="vehicle"?<VehicleIcon size={18} color={catConfig.color}/>:
                   catConfig.icon==="shield"?<ShieldIcon size={18} color={catConfig.color}/>:
                   <SettingsIcon size={18} color={catConfig.color}/>}
                </div>
                <div style={{ textAlign:"left" }}>
                  <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, color:"#000" }}>{category}</div>
                  <div style={{ fontSize:11, color:"#888" }}>{catSettings.length} setting{catSettings.length!==1?"s":""}</div>
                </div>
              </div>
              <span style={{ color:"#e6821e", fontSize:16 }}>{isExpanded?"−":"+"}</span>
            </button>
            {isExpanded&&(
              <div style={{ borderTop:"1px solid #eee" }}>
                {catSettings.map(s=>(
                  <div key={s.id} style={{ padding:"0.75rem 1rem", borderBottom:"1px solid #eee", background:editing===s.id?"#fffbf7":"#fff" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <div style={{ flex:1, minWidth:0, marginRight:8 }}>
                        <div style={{ fontFamily:"Syne", fontSize:12, fontWeight:700, color:"#000" }}>{s.label}</div>
                        {s.description&&<div style={{ fontSize:11, color:"#888", marginTop:1 }}>{s.description}</div>}
                      </div>
                      <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
                        <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, color:catConfig.color }}>{formatValue(s)}</div>
                        {editing===s.id?(
                          <button onClick={()=>setEditing(null)} style={{ background:"none", border:"1px solid #ddd", borderRadius:6, color:"#888", fontSize:11, padding:"4px 8px", cursor:"pointer" }}>Cancel</button>
                        ):(
                          <button onClick={()=>startEdit(s)} style={{ background:"#f0f0f0", border:"none", borderRadius:6, color:"#555", fontSize:11, padding:"4px 8px", cursor:"pointer" }}>Edit</button>
                        )}
                      </div>
                    </div>
                    {editing===s.id&&(
                      <div style={{ marginTop:10 }}>
                        <input value={form.value} onChange={e=>setForm(f=>({...f,value:e.target.value}))}
                          style={{ width:"100%", background:"#f5f5f5", border:"1px solid #e6821e40", borderRadius:7, padding:"8px 10px", fontSize:13, outline:"none", marginBottom:8, boxSizing:"border-box" }}/>
                        <input value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="Description (optional)"
                          style={{ width:"100%", background:"#f5f5f5", border:"1px solid #eee", borderRadius:7, padding:"8px 10px", fontSize:12, outline:"none", marginBottom:8, boxSizing:"border-box" }}/>
                        <button onClick={save} disabled={saving}
                          style={{ background:"#e6821e", border:"none", borderRadius:7, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:12, fontWeight:700, padding:"8px 16px", cursor:saving?"not-allowed":"pointer" }}>
                          {saving?"Saving...":"Save changes"}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
