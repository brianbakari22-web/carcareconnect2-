import useIsMobile from "../../lib/useIsMobile"
import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import toast from "react-hot-toast"

const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"]
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"]

export default function ProviderAvailability() {
  const isMobile = useIsMobile()
  const { user } = useAuth()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [availability, setAvailability] = useState({})
  const [bookingCounts, setBookingCounts] = useState({})
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ max_bookings:5, is_blocked:false, block_reason:"" })
  const [dateRange, setDateRange] = useState({ from:"", to:"", reason:"" })
  const [showRangeBlock, setShowRangeBlock] = useState(false)
  const [defaultMaxBookings, setDefaultMaxBookings] = useState(5)

  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const monthStr = year + "-" + String(month+1).padStart(2,"0")

  useEffect(() => { if (user) load() }, [user, currentMonth])

  async function load() {
    const startDate = monthStr + "-01"
    const endDate = monthStr + "-" + String(daysInMonth).padStart(2,"0")
    const [{ data: avail }, { data: bookings }] = await Promise.all([
      supabase.from("provider_availability").select("*").eq("provider_id", user.id).gte("date", startDate).lte("date", endDate),
      supabase.from("bookings").select("booking_date").eq("provider_id", user.id).gte("booking_date", startDate).lte("booking_date", endDate).not("status", "eq", "cancelled").eq("is_archived", false)
    ])
    const availMap = {}
    ;(avail||[]).forEach(a => { availMap[a.date] = a })
    setAvailability(availMap)
    const countMap = {}
    ;(bookings||[]).forEach(b => { countMap[b.booking_date] = (countMap[b.booking_date]||0) + 1 })
    setBookingCounts(countMap)
    setLoading(false)
  }

  function getDateStr(day) {
    return monthStr + "-" + String(day).padStart(2,"0")
  }

  function getDayStatus(day) {
    const dateStr = getDateStr(day)
    const avail = availability[dateStr]
    const count = bookingCounts[dateStr] || 0
    const today = new Date(); today.setHours(0,0,0,0)
    const date = new Date(dateStr+"T00:00:00")
    const isPast = date < today
    if (isPast) return { type:"past", label:"", color:"#f0f0f0", textColor:"#bbb" }
    if (avail?.is_blocked) return { type:"blocked", label:"Blocked", color:"#fff5f5", textColor:"#e24b4a" }
    const max = avail?.max_bookings ?? defaultMaxBookings
    if (count >= max) return { type:"full", label:"Full", color:"#fff8f0", textColor:"#e6821e" }
    if (count > 0) return { type:"partial", label:count+"/"+max, color:"#f0fdf4", textColor:"#1d9e75" }
    return { type:"open", label:"Open", color:"#ffffff", textColor:"#888" }
  }

  function selectDay(day) {
    const dateStr = getDateStr(day)
    const today = new Date(); today.setHours(0,0,0,0)
    const date = new Date(dateStr+"T00:00:00")
    if (date < today) return
    setSelected(dateStr)
    const avail = availability[dateStr]
    setForm({ max_bookings:avail?.max_bookings??defaultMaxBookings, is_blocked:avail?.is_blocked??false, block_reason:avail?.block_reason??"" })
  }

  async function saveDay(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const { error } = await supabase.from("provider_availability").upsert({
        provider_id: user.id, date: selected,
        max_bookings: form.is_blocked ? 0 : Number(form.max_bookings),
        is_blocked: form.is_blocked,
        block_reason: form.block_reason || null
      }, { onConflict:"provider_id,date" })
      if (error) throw error
      toast.success("Saved!")
      setSelected(null)
      load()
    } catch(err) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  async function blockDateRange() {
    if (!dateRange.from || !dateRange.to) return toast.error("Select start and end dates")
    if (dateRange.from > dateRange.to) return toast.error("Start must be before end")
    setSaving(true)
    try {
      const dates = []
      const start = new Date(dateRange.from+"T00:00:00")
      const end = new Date(dateRange.to+"T00:00:00")
      const today = new Date(); today.setHours(0,0,0,0)
      for (let d = new Date(start); d <= end; d.setDate(d.getDate()+1)) {
        if (d >= today) dates.push(d.toISOString().split("T")[0])
      }
      for (const date of dates) {
        await supabase.from("provider_availability").upsert({ provider_id:user.id, date, is_blocked:true, block_reason:dateRange.reason||"Date range block", max_bookings:0 }, { onConflict:"provider_id,date" })
      }
      toast.success(dates.length + " days blocked")
      setDateRange({ from:"", to:"", reason:"" })
      setShowRangeBlock(false)
      load()
    } catch(e) { toast.error("Error blocking dates") }
    finally { setSaving(false) }
  }

  async function quickToggleBlock(dateStr) {
    const avail = availability[dateStr]
    await supabase.from("provider_availability").upsert({ provider_id:user.id, date:dateStr, is_blocked:!avail?.is_blocked, block_reason:avail?.is_blocked?null:"Blocked", max_bookings:avail?.is_blocked?5:0 }, { onConflict:"provider_id,date" })
    load()
  }

  async function bulkBlock(type) {
    setSaving(true)
    try {
      const today = new Date(); today.setHours(0,0,0,0)
      const dates = []
      for (let d=1; d<=daysInMonth; d++) {
        const dateStr = getDateStr(d)
        const date = new Date(dateStr+"T00:00:00")
        if (date < today) continue
        const dow = date.getDay()
        if (type==="weekends" && (dow===0||dow===6)) dates.push(dateStr)
        if (type==="all") dates.push(dateStr)
      }
      for (const date of dates) {
        await supabase.from("provider_availability").upsert({ provider_id:user.id, date, max_bookings:0, is_blocked:true, block_reason:type==="weekends"?"Weekend":"Blocked" }, { onConflict:"provider_id,date" })
      }
      toast.success(dates.length + " dates blocked")
      load()
    } catch(err) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  async function clearMonth() {
    if (!confirm("Clear all availability settings for this month?")) return
    setSaving(true)
    await supabase.from("provider_availability").delete().eq("provider_id", user.id).gte("date", monthStr+"-01").lte("date", monthStr+"-"+String(daysInMonth).padStart(2,"0"))
    toast.success("Month cleared")
    setSaving(false)
    load()
  }

  const cells = []
  for (let i=0; i<firstDay; i++) cells.push(null)
  for (let d=1; d<=daysInMonth; d++) cells.push(d)

  const totalBookings = Object.values(bookingCounts).reduce((s,c)=>s+c,0)
  const blockedDays = Object.values(availability).filter(a=>a.is_blocked).length
  const fullDays = Object.entries(bookingCounts).filter(([date,count])=>{
    const max = availability[date]?.max_bookings??defaultMaxBookings
    return count>=max && !availability[date]?.is_blocked
  }).length

  const selectedDate = selected ? new Date(selected+"T00:00:00") : null

  return (
    <div>
      <div style={{ fontFamily:"Syne", fontSize:isMobile?16:20, fontWeight:800, color:"#000", marginBottom:4 }}>Availability</div>
      <div style={{ fontSize:12, color:"#777", marginBottom:"1.25rem" }}>Manage your booking calendar and block unavailable dates</div>

      {/* Gradient stats header */}
      <div style={{ background:"linear-gradient(135deg,#e6821e,#f09840)", borderRadius:14, padding:"1rem 1.25rem", marginBottom:"1.25rem", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div>
          <div style={{ fontFamily:"Syne", fontSize:20, fontWeight:800, color:"#fff" }}>{MONTHS[month]} {year}</div>
          <div style={{ fontSize:11, color:"rgba(255,255,255,0.8)", marginTop:2 }}>{totalBookings} booking{totalBookings!==1?"s":""} this month</div>
        </div>
        <div style={{ display:"flex", gap:16 }}>
          <div style={{ textAlign:"center" }}>
            <div style={{ fontFamily:"Syne", fontSize:20, fontWeight:800, color:blockedDays>0?"#fecaca":"rgba(255,255,255,0.9)" }}>{blockedDays}</div>
            <div style={{ fontSize:10, color:"rgba(255,255,255,0.7)" }}>Blocked</div>
          </div>
          <div style={{ textAlign:"center" }}>
            <div style={{ fontFamily:"Syne", fontSize:20, fontWeight:800, color:fullDays>0?"#fed7aa":"rgba(255,255,255,0.9)" }}>{fullDays}</div>
            <div style={{ fontSize:10, color:"rgba(255,255,255,0.7)" }}>Full</div>
          </div>
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:selected&&!isMobile?"1fr 300px":"1fr", gap:"1.25rem" }}>
        {/* Calendar section */}
        <div>
          {/* Calendar card */}
          <div style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:14, padding:"1.25rem", marginBottom:"1rem" }}>
            {/* Month nav */}
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1rem" }}>
              <button onClick={()=>setCurrentMonth(new Date(year,month-1,1))}
                style={{ background:"#f0f0f0", border:"none", borderRadius:8, width:36, height:36, cursor:"pointer", fontSize:18, display:"flex", alignItems:"center", justifyContent:"center" }}>
                ‹
              </button>
              <div style={{ fontFamily:"Syne", fontSize:15, fontWeight:700, color:"#000" }}>
                {currentMonth.toLocaleString("default",{month:"long",year:"numeric"})}
              </div>
              <button onClick={()=>setCurrentMonth(new Date(year,month+1,1))}
                style={{ background:"#f0f0f0", border:"none", borderRadius:8, width:36, height:36, cursor:"pointer", fontSize:18, display:"flex", alignItems:"center", justifyContent:"center" }}>
                ›
              </button>
            </div>

            {/* Day labels */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:3, marginBottom:6 }}>
              {DAYS.map(d=>(
                <div key={d} style={{ textAlign:"center", fontSize:10, color:"#999", fontWeight:600, padding:"3px 0" }}>{d}</div>
              ))}
            </div>

            {/* Calendar grid */}
            {loading ? (
              <div style={{ textAlign:"center", padding:"2rem", color:"#888", fontSize:13 }}>Loading...</div>
            ):(
              <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:4 }}>
                {cells.map((day,i)=>{
                  if (!day) return <div key={i}/>
                  const dateStr = getDateStr(day)
                  const status = getDayStatus(day)
                  const isSelected = selected===dateStr
                  const isToday = dateStr===new Date().toISOString().split("T")[0]
                  const count = bookingCounts[dateStr]||0
                  return (
                    <div key={day} onClick={()=>selectDay(day)}
                      style={{ background:isSelected?"#e6821e":status.color, borderRadius:10, padding:"6px 3px", textAlign:"center", cursor:status.type==="past"?"default":"pointer", border:isToday?"2px solid #e6821e":"1px solid "+(isSelected?"#e6821e":"#eeeeee"), transition:"all 0.15s", boxShadow:isSelected?"0 4px 12px rgba(230,130,30,0.3)":"none", minHeight:48, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
                      <div style={{ fontSize:13, fontWeight:isToday?800:500, color:isSelected?"#fff":status.textColor }}>{day}</div>
                      {status.type==="blocked"&&!isSelected&&<div style={{ fontSize:9, color:"#e24b4a", marginTop:1 }}>🚫</div>}
                      {status.type==="partial"&&!isSelected&&<div style={{ fontSize:8, color:"#1d9e75", marginTop:1, fontWeight:600 }}>{count}</div>}
                      {status.type==="full"&&!isSelected&&<div style={{ fontSize:8, color:"#e6821e", marginTop:1, fontWeight:600 }}>Full</div>}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Legend */}
            <div style={{ display:"flex", gap:12, marginTop:"1rem", flexWrap:"wrap", justifyContent:"center" }}>
              {[
                { color:"#f0fdf4", label:"Has bookings", dot:"#1d9e75" },
                { color:"#fff8f0", label:"Full", dot:"#e6821e" },
                { color:"#fff5f5", label:"Blocked", dot:"#e24b4a" },
                { color:"#ffffff", label:"Open", dot:"#ddd" },
              ].map(l=>(
                <div key={l.label} style={{ display:"flex", alignItems:"center", gap:4 }}>
                  <div style={{ width:12, height:12, borderRadius:3, background:l.color, border:"1px solid "+l.dot+"60", display:"flex", alignItems:"center", justifyContent:"center" }}>
                    <div style={{ width:5, height:5, borderRadius:"50%", background:l.dot }}/>
                  </div>
                  <span style={{ fontSize:10, color:"#888" }}>{l.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick actions card */}
          <div style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:14, padding:"1rem" }}>
            <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, color:"#000", marginBottom:10 }}>⚡ Quick actions</div>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:12 }}>
              <button onClick={()=>bulkBlock("weekends")} disabled={saving}
                style={{ background:"#fff8f0", border:"1px solid #e6821e40", borderRadius:8, color:"#e6821e", fontSize:12, fontWeight:600, padding:"8px 14px", cursor:"pointer" }}>
                📅 Block weekends
              </button>
              <button onClick={()=>bulkBlock("all")} disabled={saving}
                style={{ background:"#fff5f5", border:"1px solid #e24b4a40", borderRadius:8, color:"#e24b4a", fontSize:12, fontWeight:600, padding:"8px 14px", cursor:"pointer" }}>
                🚫 Block month
              </button>
              <button onClick={clearMonth} disabled={saving}
                style={{ background:"#f0fdf4", border:"1px solid #1d9e7540", borderRadius:8, color:"#1d9e75", fontSize:12, fontWeight:600, padding:"8px 14px", cursor:"pointer" }}>
                🔄 Clear month
              </button>
              <button onClick={()=>setShowRangeBlock(r=>!r)}
                style={{ background:"#f5f3ff", border:"1px solid #8b5cf640", borderRadius:8, color:"#8b5cf6", fontSize:12, fontWeight:600, padding:"8px 14px", cursor:"pointer" }}>
                📆 Date range
              </button>
            </div>

            {/* Default max bookings */}
            <div style={{ background:"#f8f8f8", borderRadius:10, padding:"0.75rem", marginBottom:showRangeBlock?10:0 }}>
              <div style={{ fontSize:11, color:"#666", marginBottom:8 }}>Default max bookings per day</div>
              <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                <button onClick={()=>setDefaultMaxBookings(m=>Math.max(1,m-1))}
                  style={{ width:34, height:34, borderRadius:8, background:"#fff", border:"1px solid #ddd", fontSize:18, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>−</button>
                <div style={{ fontFamily:"Syne", fontSize:24, fontWeight:800, color:"#e6821e", width:36, textAlign:"center" }}>{defaultMaxBookings}</div>
                <button onClick={()=>setDefaultMaxBookings(m=>Math.min(20,m+1))}
                  style={{ width:34, height:34, borderRadius:8, background:"#fff", border:"1px solid #ddd", fontSize:18, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>+</button>
                <div style={{ fontSize:11, color:"#888" }}>per day</div>
              </div>
            </div>

            {/* Date range form */}
            {showRangeBlock&&(
              <div style={{ background:"#f5f3ff", border:"1px solid #8b5cf630", borderRadius:10, padding:"1rem" }}>
                <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, color:"#8b5cf6", marginBottom:10 }}>📆 Block date range</div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:8 }}>
                  <div>
                    <label style={{ fontSize:10, color:"#666", display:"block", marginBottom:3 }}>From</label>
                    <input type="date" value={dateRange.from} onChange={e=>setDateRange(r=>({...r,from:e.target.value}))}
                      style={{ width:"100%", background:"#fff", border:"1px solid #e5e5e5", borderRadius:7, padding:"8px 10px", fontSize:12, outline:"none" }}/>
                  </div>
                  <div>
                    <label style={{ fontSize:10, color:"#666", display:"block", marginBottom:3 }}>To</label>
                    <input type="date" value={dateRange.to} onChange={e=>setDateRange(r=>({...r,to:e.target.value}))}
                      style={{ width:"100%", background:"#fff", border:"1px solid #e5e5e5", borderRadius:7, padding:"8px 10px", fontSize:12, outline:"none" }}/>
                  </div>
                </div>
                <input value={dateRange.reason} onChange={e=>setDateRange(r=>({...r,reason:e.target.value}))}
                  placeholder="Reason (e.g. Holiday, Vacation)"
                  style={{ width:"100%", background:"#fff", border:"1px solid #e5e5e5", borderRadius:7, padding:"8px 10px", fontSize:12, outline:"none", marginBottom:8 }}/>
                <div style={{ display:"flex", gap:8 }}>
                  <button onClick={blockDateRange} disabled={saving}
                    style={{ flex:1, background:"#8b5cf6", border:"none", borderRadius:8, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:12, fontWeight:700, padding:"9px", cursor:"pointer" }}>
                    Block these dates
                  </button>
                  <button onClick={()=>setShowRangeBlock(false)}
                    style={{ background:"none", border:"1px solid #ddd", borderRadius:8, color:"#888", fontSize:12, padding:"9px 14px", cursor:"pointer" }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Day detail panel */}
        {selected&&(
          <div style={{ background:"#ffffff", border:"1px solid #e6821e30", borderRadius:14, padding:"1.25rem", boxShadow:"0 4px 16px rgba(230,130,30,0.1)", position:isMobile?"static":"sticky", top:80 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"1rem" }}>
              <div>
                <div style={{ fontFamily:"Syne", fontSize:16, fontWeight:800, color:"#000" }}>
                  {selectedDate&&selectedDate.toLocaleDateString("default",{weekday:"long"})}
                </div>
                <div style={{ fontSize:12, color:"#888" }}>
                  {selectedDate&&selectedDate.toLocaleDateString("default",{month:"long",day:"numeric",year:"numeric"})}
                </div>
                <div style={{ fontSize:11, color:"#e6821e", marginTop:4, fontWeight:600 }}>
                  {bookingCounts[selected]||0} booking{(bookingCounts[selected]||0)!==1?"s":""} on this day
                </div>
              </div>
              <button onClick={()=>setSelected(null)}
                style={{ background:"#f0f0f0", border:"none", borderRadius:"50%", width:30, height:30, cursor:"pointer", fontSize:16, display:"flex", alignItems:"center", justifyContent:"center", color:"#555" }}>
                ×
              </button>
            </div>

            <form onSubmit={saveDay}>
              {/* Block toggle */}
              <label style={{ display:"flex", alignItems:"center", gap:12, cursor:"pointer", padding:"0.85rem", background:form.is_blocked?"#fff5f5":"#f8f8f8", borderRadius:10, border:"1.5px solid "+(form.is_blocked?"#e24b4a40":"#eeeeee"), marginBottom:"1rem", transition:"all 0.2s" }}>
                <div style={{ position:"relative", width:44, height:24, flexShrink:0 }}>
                  <input type="checkbox" checked={form.is_blocked} onChange={e=>setForm(f=>({...f,is_blocked:e.target.checked}))} style={{ opacity:0, width:0, height:0, position:"absolute" }}/>
                  <div style={{ position:"absolute", inset:0, background:form.is_blocked?"#e24b4a":"#ddd", borderRadius:12, transition:"background 0.2s" }}>
                    <div style={{ position:"absolute", top:2, left:form.is_blocked?22:2, width:20, height:20, background:"#fff", borderRadius:"50%", transition:"left 0.2s", boxShadow:"0 1px 4px rgba(0,0,0,0.2)" }}/>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:form.is_blocked?"#e24b4a":"#333" }}>
                    {form.is_blocked?"🚫 Day blocked":"✅ Day open"}
                  </div>
                  <div style={{ fontSize:11, color:"#888" }}>{form.is_blocked?"No bookings allowed":"Accepting bookings"}</div>
                </div>
              </label>

              {form.is_blocked&&(
                <div style={{ marginBottom:"1rem" }}>
                  <label style={{ fontSize:11, color:"#666", display:"block", marginBottom:4 }}>Block reason (optional)</label>
                  <input value={form.block_reason} onChange={e=>setForm(f=>({...f,block_reason:e.target.value}))}
                    placeholder="e.g. Public holiday, Training"
                    style={{ width:"100%", background:"#f8f8f8", border:"1px solid #e5e5e5", borderRadius:8, padding:"10px 12px", color:"#000", fontSize:12, outline:"none", fontFamily:"DM Sans,sans-serif" }}/>
                </div>
              )}

              {!form.is_blocked&&(
                <div style={{ marginBottom:"1rem" }}>
                  <label style={{ fontSize:11, color:"#666", display:"block", marginBottom:8 }}>Max bookings this day</label>
                  <div style={{ display:"flex", alignItems:"center", gap:12, background:"#f8f8f8", borderRadius:10, padding:"0.75rem" }}>
                    <button type="button" onClick={()=>setForm(f=>({...f,max_bookings:Math.max(1,f.max_bookings-1)}))}
                      style={{ width:36, height:36, borderRadius:8, background:"#fff", border:"1px solid #ddd", fontSize:20, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>−</button>
                    <div style={{ flex:1, textAlign:"center" }}>
                      <div style={{ fontFamily:"Syne", fontSize:28, fontWeight:800, color:"#e6821e" }}>{form.max_bookings}</div>
                      <div style={{ fontSize:10, color:"#888" }}>max bookings</div>
                    </div>
                    <button type="button" onClick={()=>setForm(f=>({...f,max_bookings:Math.min(20,f.max_bookings+1)}))}
                      style={{ width:36, height:36, borderRadius:8, background:"#fff", border:"1px solid #ddd", fontSize:20, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>+</button>
                  </div>
                  <div style={{ fontSize:11, color:"#888", marginTop:6, textAlign:"center" }}>
                    {bookingCounts[selected]||0} booked · {Math.max(0,form.max_bookings-(bookingCounts[selected]||0))} slots free
                  </div>
                </div>
              )}

              <button type="submit" disabled={saving}
                style={{ width:"100%", background:saving?"#ccc":"linear-gradient(135deg,#e6821e,#f09840)", border:"none", borderRadius:10, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:14, fontWeight:700, padding:"13px", cursor:saving?"not-allowed":"pointer", boxShadow:"0 4px 12px rgba(230,130,30,0.3)" }}>
                {saving?"Saving...":"✓ Save changes"}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
