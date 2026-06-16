import useIsMobile from "../../lib/useIsMobile"
import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import toast from "react-hot-toast"

const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"]

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
  const [tab, setTab] = useState("calendar")

  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const monthStr = `${year}-${String(month+1).padStart(2,"0")}`

  useEffect(() => { if (user) load() }, [user, currentMonth])

  async function load() {
    const startDate = `${monthStr}-01`
    const endDate = `${monthStr}-${String(daysInMonth).padStart(2,"0")}`

    const [{ data: avail }, { data: bookings }] = await Promise.all([
      supabase.from("provider_availability").select("*")
        .eq("provider_id", user.id)
        .gte("date", startDate)
        .lte("date", endDate),
      supabase.from("bookings").select("booking_date")
        .eq("provider_id", user.id)
        .gte("booking_date", startDate)
        .lte("booking_date", endDate)
        .not("status", "eq", "cancelled")
    ])

    const availMap = {}
    ;(avail||[]).forEach(a => { availMap[a.date] = a })
    setAvailability(availMap)

    const countMap = {}
    ;(bookings||[]).forEach(b => {
      countMap[b.booking_date] = (countMap[b.booking_date]||0) + 1
    })
    setBookingCounts(countMap)
    setLoading(false)
  }

  function getDateStr(day) {
    return `${monthStr}-${String(day).padStart(2,"0")}`
  }

  function getDayStatus(day) {
    const dateStr = getDateStr(day)
    const avail = availability[dateStr]
    const count = bookingCounts[dateStr] || 0
    const today = new Date(); today.setHours(0,0,0,0)
    const date = new Date(dateStr+"T00:00:00")
    const isPast = date < today

    if (isPast) return { type:"past", label:"", color:"#eeeeee", textColor:"#444" }
    if (avail?.is_blocked) return { type:"blocked", label:"Blocked", color:"#fff5f5", textColor:"#e24b4a" }
    const max = avail?.max_bookings ?? defaultMaxBookings
    if (count >= max) return { type:"full", label:"Full", color:"#fff8f0", textColor:"#e6821e" }
    if (count > 0) return { type:"partial", label:`${count}/${max}`, color:"#f0fdf4", textColor:"#1d9e75" }
    return { type:"open", label:"Open", color:"#555555", textColor:"#555" }
  }

  function selectDay(day) {
    const dateStr = getDateStr(day)
    const today = new Date(); today.setHours(0,0,0,0)
    const date = new Date(dateStr+"T00:00:00")
    if (date < today) return
    setSelected(dateStr)
    const avail = availability[dateStr]
    setForm({
      max_bookings: avail?.max_bookings ?? defaultMaxBookings,
      is_blocked: avail?.is_blocked ?? false,
      block_reason: avail?.block_reason ?? ""
    })
  }

  async function saveDay(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const { error } = await supabase.from("provider_availability").upsert({
        provider_id: user.id,
        date: selected,
        max_bookings: form.is_blocked ? 0 : Number(form.max_bookings),
        is_blocked: form.is_blocked,
        block_reason: form.block_reason || null
      }, { onConflict:"provider_id,date" })
      if (error) throw error
      toast.success(`Saved for ${new Date(selected+"T00:00:00").toLocaleDateString("default",{weekday:"long",month:"long",day:"numeric"})}`)
      setSelected(null)
      load()
    } catch(err) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  async function blockDateRange() {
    if (!dateRange.from || !dateRange.to) return toast.error("Please select start and end dates")
    if (dateRange.from > dateRange.to) return toast.error("Start date must be before end date")
    setSaving(true)
    try {
      const dates = []
      const start = new Date(dateRange.from+"T00:00:00")
      const end = new Date(dateRange.to+"T00:00:00")
      const today = new Date(); today.setHours(0,0,0,0)
      for (let d = new Date(start); d <= end; d.setDate(d.getDate()+1)) {
        if (d < today) continue
        dates.push(d.toISOString().split("T")[0])
      }
      for (const date of dates) {
        await supabase.from("provider_availability").upsert({
          provider_id: user.id,
          date,
          is_blocked: true,
          block_reason: dateRange.reason || "Date range block",
          max_bookings: 0
        }, { onConflict: "provider_id,date" })
      }
      toast.success(dates.length + " days blocked")
      setDateRange({ from:"", to:"", reason:"" })
      setShowRangeBlock(false)
      await load()
    } catch(e) { toast.error("Error blocking dates") }
    finally { setSaving(false) }
  }

  async function quickToggleBlock(dateStr) {
    const avail = availability[dateStr]
    const isCurrentlyBlocked = avail?.is_blocked
    await supabase.from("provider_availability").upsert({
      provider_id: user.id,
      date: dateStr,
      is_blocked: !isCurrentlyBlocked,
      block_reason: isCurrentlyBlocked ? null : "Blocked",
      max_bookings: isCurrentlyBlocked ? 5 : 0
    }, { onConflict: "provider_id,date" })
    await load()
  }

  async function bulkBlock(type) {
    setSaving(true)
    try {
      const dates = []
      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = getDateStr(d)
        const today = new Date(); today.setHours(0,0,0,0)
        const date = new Date(dateStr+"T00:00:00")
        if (date < today) continue
        const dayOfWeek = date.getDay()
        if (type === "weekends" && (dayOfWeek === 0 || dayOfWeek === 6)) dates.push(dateStr)
        if (type === "all") dates.push(dateStr)
      }
      for (const date of dates) {
        await supabase.from("provider_availability").upsert({
          provider_id: user.id,
          date,
          max_bookings: 0,
          is_blocked: true,
          block_reason: type === "weekends" ? "Weekend" : "Blocked"
        }, { onConflict:"provider_id,date" })
      }
      toast.success(`${dates.length} dates blocked`)
      load()
    } catch(err) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  async function clearMonth() {
    if (!confirm("Clear all availability settings for this month?")) return
    setSaving(true)
    await supabase.from("provider_availability")
      .delete()
      .eq("provider_id", user.id)
      .gte("date", `${monthStr}-01`)
      .lte("date", `${monthStr}-${String(daysInMonth).padStart(2,"0")}`)
    toast.success("Month cleared")
    setSaving(false)
    load()
  }

  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const totalBookings = Object.values(bookingCounts).reduce((s,c)=>s+c, 0)
  const blockedDays = Object.values(availability).filter(a=>a.is_blocked).length
  const fullDays = Object.entries(bookingCounts).filter(([date, count]) => {
    const max = availability[date]?.max_bookings ?? defaultMaxBookings
    return count >= max && !availability[date]?.is_blocked
  }).length

  return (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginBottom:"1.5rem" }}>
        {[
          { label:"Bookings this month", value:totalBookings, color:"#378add" },
          { label:"Blocked days", value:blockedDays, color:blockedDays>0?"#e24b4a":undefined },
          { label:"Full days", value:fullDays, color:fullDays>0?"#e6821e":undefined },
        ].map(s=>(
          <div key={s.label} style={{ background:"#ffffff", borderRadius:10, padding:"1rem", border:"1px solid #eeeeee" }}>
            <div style={{ fontSize:11, color:"#777777", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:6 }}>{s.label}</div>
            <div style={{ fontFamily:"Syne", fontSize:22, fontWeight:800, color:s.color||"#000000" }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display:"flex", gap:6, marginBottom:"1.25rem" }}>
        {[{k:"calendar",l:"Calendar"},{k:"settings",l:"Settings"}].map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k)}
            style={{ padding:"8px 16px", borderRadius:8, border:"none", fontSize:12, cursor:"pointer", background:tab===t.k?"#378add":"#555555", color:tab===t.k?"#fff":"#666", fontFamily:"'DM Sans',sans-serif", fontWeight:tab===t.k?700:400 }}>
            {t.l}
          </button>
        ))}
      </div>

      {tab==="calendar"&&(
        <div style={{ display:"grid", gridTemplateColumns:selected&&!isMobile?"1fr 320px":"1fr", gap:10 }}>
          <div>
            <div style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:12, padding:"1.25rem" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1rem" }}>
                <button onClick={()=>setCurrentMonth(new Date(year,month-1,1))}
                  style={{ background:"none", border:"none", color:"#555555", cursor:"pointer", fontSize:18, padding:"4px 8px" }}>‹</button>
                <div style={{ fontFamily:"Syne", fontSize:15, fontWeight:700, color:"#000000" }}>
                  {currentMonth.toLocaleString("default",{month:"long",year:"numeric"})}
                </div>
                <button onClick={()=>setCurrentMonth(new Date(year,month+1,1))}
                  style={{ background:"none", border:"none", color:"#555555", cursor:"pointer", fontSize:18, padding:"4px 8px" }}>›</button>
              </div>

              <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:2, marginBottom:6 }}>
                {DAYS.map(d=><div key={d} style={{ textAlign:"center", fontSize:10, color:"#777777", padding:"4px 0" }}>{d}</div>)}
              </div>

              <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:4 }}>
                {cells.map((day,i)=>{
                  if (!day) return <div key={i}/>
                  const dateStr = getDateStr(day)
                  const status = getDayStatus(day)
                  const isSelected = selected === dateStr
                  const isToday = dateStr === new Date().toISOString().split("T")[0]
                  const count = bookingCounts[dateStr] || 0
                  return (
                    <div key={day} onClick={()=>selectDay(day)}
                      style={{ background:isSelected?"#378add":status.color, borderRadius:8, padding:"8px 4px", textAlign:"center", cursor:status.type==="past"?"default":"pointer", border:isToday?`2px solid #378add`:`1px solid ${isSelected?"#378add":"#f5f5f5"}`, transition:"all 0.12s" }}>
                      <div style={{ fontSize:13, fontWeight:600, color:isSelected?"#fff":status.textColor, marginBottom:2 }}>{day}</div>
                      {status.type!=="past"&&(
                        <div style={{ fontSize:8, color:isSelected?"rgba(255,255,255,0.8)":status.textColor, lineHeight:1 }}>
                          {status.label}
                        </div>
                      )}
                      {count>0&&status.type!=="past"&&(
                        <div style={{ width:6, height:6, borderRadius:"50%", background:isSelected?"#fff":"#378add", margin:"3px auto 0" }}/>
                      )}
                      {status.type!=="past"&&(
                        <div onClick={e=>{ e.stopPropagation(); quickToggleBlock(getDateStr(day)) }}
                          style={{ fontSize:8, marginTop:2, color:status.type==="blocked"?"#e24b4a":"#aaa", cursor:"pointer" }}
                          title={status.type==="blocked"?"Unblock day":"Quick block"}>
                          {status.type==="blocked"?"✓ tap to unblock":"🚫"}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              <div style={{ display:"flex", gap:12, marginTop:"1rem", flexWrap:"wrap" }}>
                {[
                  { color:"#f0fdf4", text:"#1d9e75", label:"Has bookings" },
                  { color:"#fff8f0", text:"#e6821e", label:"Full" },
                  { color:"#fff5f5", text:"#e24b4a", label:"Blocked" },
                  { color:"#555555", text:"#555", label:"Open" },
                ].map(l=>(
                  <div key={l.label} style={{ display:"flex", alignItems:"center", gap:4 }}>
                    <div style={{ width:12, height:12, borderRadius:3, background:l.color, border:`1px solid ${l.text}40` }}/>
                    <span style={{ fontSize:10, color:"#777777" }}>{l.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display:"flex", gap:8, marginTop:10, flexWrap:"wrap" }}>
              <button onClick={()=>bulkBlock("weekends")} disabled={saving}
                style={{ background:"#ffffff", border:"1px solid #dddddd", borderRadius:8, color:"#555555", fontSize:12, padding:"8px 14px", cursor:"pointer" }}>
                Block all weekends
              </button>
              <button onClick={()=>bulkBlock("all")} disabled={saving}
                style={{ background:"#fff5f5", border:"1px solid #e24b4a40", borderRadius:8, color:"#e24b4a", fontSize:12, padding:"8px 14px", cursor:"pointer" }}>
                Block entire month
              </button>
              <button onClick={clearMonth} disabled={saving}
                style={{ background:"#ffffff", border:"1px solid #dddddd", borderRadius:8, color:"#777777", fontSize:12, padding:"8px 14px", cursor:"pointer" }}>
                Clear month
              </button>
              <button onClick={()=>setShowRangeBlock(r=>!r)} disabled={saving}
                style={{ background:"#fff8f0", border:"1px solid #e6821e40", borderRadius:8, color:"#e6821e", fontSize:12, padding:"8px 14px", cursor:"pointer" }}>
                📅 Block date range
              </button>
            </div>
            {showRangeBlock&&(
              <div style={{ marginTop:12, background:"#fff8f0", border:"1px solid #e6821e30", borderRadius:10, padding:"1rem" }}>
                <div style={{ fontWeight:700, fontSize:13, marginBottom:10, color:"#e6821e" }}>📅 Block a date range</div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:8 }}>
                  <div>
                    <label style={{ fontSize:11, color:"#666", display:"block", marginBottom:4 }}>From</label>
                    <input type="date" value={dateRange.from} onChange={e=>setDateRange(r=>({...r,from:e.target.value}))}
                      style={{ width:"100%", border:"1px solid #ddd", borderRadius:6, padding:"6px 8px", fontSize:12 }}/>
                  </div>
                  <div>
                    <label style={{ fontSize:11, color:"#666", display:"block", marginBottom:4 }}>To</label>
                    <input type="date" value={dateRange.to} onChange={e=>setDateRange(r=>({...r,to:e.target.value}))}
                      style={{ width:"100%", border:"1px solid #ddd", borderRadius:6, padding:"6px 8px", fontSize:12 }}/>
                  </div>
                </div>
                <input value={dateRange.reason} onChange={e=>setDateRange(r=>({...r,reason:e.target.value}))}
                  placeholder="Reason (e.g. Holiday, Vacation...)"
                  style={{ width:"100%", border:"1px solid #ddd", borderRadius:6, padding:"6px 8px", fontSize:12, marginBottom:8, boxSizing:"border-box" }}/>
                <div style={{ display:"flex", gap:8 }}>
                  <button onClick={blockDateRange} disabled={saving}
                    style={{ flex:1, background:"#e24b4a", border:"none", borderRadius:8, color:"#fff", fontSize:12, fontWeight:700, padding:"8px", cursor:"pointer" }}>
                    🚫 Block these dates
                  </button>
                  <button onClick={()=>setShowRangeBlock(false)}
                    style={{ background:"none", border:"1px solid #ddd", borderRadius:8, color:"#888", fontSize:12, padding:"8px 14px", cursor:"pointer" }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {selected&&(
            <div style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:12, padding:"1.25rem" }}>
              <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, marginBottom:4, color:"#000000" }}>
                {new Date(selected+"T00:00:00").toLocaleDateString("default",{weekday:"long",month:"long",day:"numeric"})}
              </div>
              <div style={{ fontSize:11, color:"#777777", marginBottom:"1.25rem" }}>
                {bookingCounts[selected]||0} booking{(bookingCounts[selected]||0)!==1?"s":""} today
              </div>
              <form onSubmit={saveDay}>
                <label style={{ display:"flex", alignItems:"center", gap:10, cursor:"pointer", marginBottom:"1rem", padding:"0.75rem", background:"#fff5f5", borderRadius:8, border:"1px solid #e24b4a20" }}>
                  <input type="checkbox" checked={form.is_blocked} onChange={e=>setForm(f=>({...f,is_blocked:e.target.checked}))} style={{ width:16, height:16, cursor:"pointer" }}/>
                  <div>
                    <div style={{ fontSize:13, color:"#e24b4a", fontWeight:500 }}>Block this day</div>
                    <div style={{ fontSize:11, color:"#666" }}>No bookings allowed</div>
                  </div>
                </label>

                {form.is_blocked&&(
                  <div style={{ marginBottom:"1rem" }}>
                    <label style={{ fontSize:11, color:"#666", textTransform:"uppercase", letterSpacing:"0.05em", display:"block", marginBottom:4 }}>Reason (optional)</label>
                    <input value={form.block_reason} onChange={e=>setForm(f=>({...f,block_reason:e.target.value}))}
                      placeholder="e.g. Public holiday, Staff training"
                      style={{ width:"100%", background:"#ffffff", border:"1px solid #e5e5e5", borderRadius:8, padding:"10px 12px", color:"#000000", fontSize:13, outline:"none", fontFamily:"'DM Sans',sans-serif" }}/>
                  </div>
                )}

                {!form.is_blocked&&(
                  <div style={{ marginBottom:"1rem" }}>
                    <label style={{ fontSize:11, color:"#666", textTransform:"uppercase", letterSpacing:"0.05em", display:"block", marginBottom:4 }}>Max bookings this day</label>
                    <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                      <button type="button" onClick={()=>setForm(f=>({...f,max_bookings:Math.max(1,f.max_bookings-1)}))}
                        style={{ width:36, height:36, borderRadius:8, background:"#f5f5f5", border:"1px solid #dddddd", color:"#000000", fontSize:18, cursor:"pointer" }}>ΓêÆ</button>
                      <div style={{ fontFamily:"Syne", fontSize:24, fontWeight:800, color:"#378add", width:40, textAlign:"center" }}>{form.max_bookings}</div>
                      <button type="button" onClick={()=>setForm(f=>({...f,max_bookings:Math.min(20,f.max_bookings+1)}))}
                        style={{ width:36, height:36, borderRadius:8, background:"#f5f5f5", border:"1px solid #dddddd", color:"#000000", fontSize:18, cursor:"pointer" }}>+</button>
                    </div>
                    <div style={{ fontSize:11, color:"#777777", marginTop:6 }}>
                      {bookingCounts[selected]||0} booked · {Math.max(0,form.max_bookings-(bookingCounts[selected]||0))} slots remaining
                    </div>
                  </div>
                )}

                <div style={{ display:"flex", gap:8 }}>
                  <button type="submit" disabled={saving}
                    style={{ flex:1, background:saving?"#555555":"#378add", border:"none", borderRadius:8, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"11px", cursor:saving?"not-allowed":"pointer" }}>
                    {saving?"Saving...":"Save"}
                  </button>
                  <button type="button" onClick={()=>setSelected(null)}
                    style={{ flex:1, background:"none", border:"1px solid #dddddd", borderRadius:8, color:"#555555", fontSize:13, padding:"11px", cursor:"pointer" }}>
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {tab==="settings"&&(
        <div style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:12, padding:"1.25rem", maxWidth:400 }}>
          <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, marginBottom:4, color:"#000000" }}>Default settings</div>
          <div style={{ fontSize:12, color:"#777777", marginBottom:"1.5rem" }}>Applied to days with no specific settings</div>

          <div style={{ marginBottom:"1.5rem" }}>
            <label style={{ fontSize:11, color:"#666", textTransform:"uppercase", letterSpacing:"0.05em", display:"block", marginBottom:8 }}>Default max bookings per day</label>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <button onClick={()=>setDefaultMaxBookings(m=>Math.max(1,m-1))}
                style={{ width:40, height:40, borderRadius:8, background:"#f5f5f5", border:"1px solid #dddddd", color:"#000000", fontSize:20, cursor:"pointer" }}>ΓêÆ</button>
              <div style={{ fontFamily:"Syne", fontSize:28, fontWeight:800, color:"#378add", width:50, textAlign:"center" }}>{defaultMaxBookings}</div>
              <button onClick={()=>setDefaultMaxBookings(m=>Math.min(20,m+1))}
                style={{ width:40, height:40, borderRadius:8, background:"#f5f5f5", border:"1px solid #dddddd", color:"#000000", fontSize:20, cursor:"pointer" }}>+</button>
            </div>
            <div style={{ fontSize:11, color:"#777777", marginTop:8 }}>
              This applies to all days unless you set a specific limit on the calendar
            </div>
          </div>

          <div style={{ background:"#ffffff", border:"1px solid #e5e5e5", borderRadius:10, padding:"1rem" }}>
            <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, marginBottom:8, color:"#000000" }}>How it works</div>
            {[
              { icon:"🟢", text:"Open — day has available slots" },
              { icon:"🟡", text:"Partial — some bookings made" },
              { icon:"🔴", text:"Full — max bookings reached" },
              { icon:"Γ¢ö", text:"Blocked — no bookings allowed" },
            ].map(i=>(
              <div key={i.text} style={{ display:"flex", gap:8, marginBottom:6, fontSize:12, color:"#555555" }}>
                <span>{i.icon}</span><span>{i.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}




