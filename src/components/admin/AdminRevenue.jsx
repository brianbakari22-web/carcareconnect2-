import useIsMobile from "../../lib/useIsMobile"
import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"

export default function AdminRevenue() {
  const isMobile = useIsMobile()
  const [bookings, setBookings] = useState([])
  const [clvData, setClvData] = useState([])
  const [tab, setTab] = useState("revenue")
  const [heatmap, setHeatmap] = useState({ byDay:{}, byService:{}, byHour:{} })
  const [gaps, setGaps] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
    const sub = supabase.channel("admin-revenue")
      .on("postgres_changes", { event:"*", schema:"public", table:"bookings" }, () => load())
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [])

  async function load() {
    const [{ data }, { data: allBookings }] = await Promise.all([
      supabase.from("bookings").select("*").eq("status","completed").order("created_at",{ascending:false}),
      supabase.from("bookings").select("customer_id, total_amount, booking_date, status").eq("status","completed")
    ])
    setBookings(data||[])
    const clvMap = {}
    ;(allBookings||[]).forEach(b => {
      if (!clvMap[b.customer_id]) clvMap[b.customer_id] = { total:0, count:0, lastDate:null }
      clvMap[b.customer_id].total += Number(b.total_amount)
      clvMap[b.customer_id].count++
      if (!clvMap[b.customer_id].lastDate || b.booking_date > clvMap[b.customer_id].lastDate)
        clvMap[b.customer_id].lastDate = b.booking_date
    })
    const clv = Object.entries(clvMap).map(([id, v]) => ({
      customer_id: id,
      total_spend: v.total,
      bookings: v.count,
      avg_order: v.total / v.count,
      last_booking: v.lastDate,
      predicted_clv: (v.total / v.count) * Math.min(v.count * 1.5, 20)
    })).sort((a,b)=>b.predicted_clv-a.predicted_clv).slice(0,20)
    // Fetch customer names for CLV
    const custIds = clv.map(r=>r.customer_id)
    const { data: custProfs } = custIds.length>0 ? await supabase.from("profile_public").select("id,first_name,last_name").in("id", custIds) : { data:[] }
    const custMap = {}
    custProfs?.forEach(p => { custMap[p.id] = p })
    setClvData(clv.map(r=>({...r, customerName:`${custMap[r.customer_id]?.first_name||""} ${custMap[r.customer_id]?.last_name||""}`.trim()||"Customer"})))
    // Compute demand heatmap
    const byDay = {}; const byService = {}; const byHour = {}
    const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"]
    ;(allBookings||[]).forEach(b => {
      if (b.booking_date) {
        const day = days[new Date(b.booking_date).getDay()]
        byDay[day] = (byDay[day]||0) + 1
      }
      if (b.booking_date && b.status) {
        const svc = b.service_name||(b.service_category)||"Other"
      }
    })
    ;(data||[]).forEach(b => {
      const svc = b.service_name||"Other"
      byService[svc] = (byService[svc]||0) + 1
      if (b.booking_time) {
        const hr = b.booking_time.slice(0,2)+":00"
        byHour[hr] = (byHour[hr]||0) + 1
      }
    })
    setHeatmap({ byDay, byService, byHour })
    // Provider gap analysis
    const { data: providers } = await supabase.from("profiles").select("provider_type, city").eq("role","provider").eq("is_active",true)
    const providersByCity = {}
    ;(providers||[]).forEach(p => {
      if (!p.city) return
      if (!providersByCity[p.city]) providersByCity[p.city] = {}
      providersByCity[p.city][p.provider_type] = (providersByCity[p.city][p.provider_type]||0) + 1
    })
    // Find cities with high booking demand but few providers
    const cityDemand = {}
    ;(data||[]).forEach(b => {
      const city = b.city||"Unknown"
      cityDemand[city] = (cityDemand[city]||0) + 1
    })
    const gapAnalysis = Object.entries(cityDemand).map(([city, demand]) => ({
      city,
      demand,
      providerCount: Object.values(providersByCity[city]||{}).reduce((s,v)=>s+v,0),
      ratio: demand / Math.max(Object.values(providersByCity[city]||{}).reduce((s,v)=>s+v,0), 1),
      missingTypes: ["garage","car_wash","mobile_mechanic"].filter(t => !(providersByCity[city]||{})[t])
    })).filter(g=>g.demand>0).sort((a,b)=>b.ratio-a.ratio).slice(0,10)
    setGaps(gapAnalysis)
    setLoading(false)
  }

  const total = bookings.reduce((s,b)=>s+Number(b.total_amount),0)
  const commission = bookings.reduce((s,b)=>s+Number(b.platform_commission||0),0)
  const providerPaid = bookings.reduce((s,b)=>s+Number(b.provider_earnings||0),0)
  const driverPaid = bookings.reduce((s,b)=>s+Number(b.driver_earnings||0),0)

  const byMonth = bookings.reduce((acc,b)=>{
    const month = b.booking_date?.slice(0,7)
    if (!month) return acc
    acc[month] = (acc[month]||0) + Number(b.total_amount)
    return acc
  },{})

  function forecastNextMonth() {
    const months = Object.entries(byMonth).sort((a,b)=>a[0].localeCompare(b[0]))
    if (months.length < 2) return null
    const last3 = months.slice(-3)
    const n = last3.length
    const avgGrowth = last3.reduce((sum,[,v],i) => {
      if (i===0) return sum
      const prev = Number(last3[i-1][1])
      return sum + (prev > 0 ? (Number(v)-prev)/prev : 0)
    }, 0) / (n-1)
    const lastRevenue = Number(last3[n-1][1])
    const nextMonth = new Date(last3[n-1][0]+"-01")
    nextMonth.setMonth(nextMonth.getMonth()+1)
    return {
      amount: Math.max(0, lastRevenue*(1+avgGrowth)),
      month: nextMonth.toLocaleString("default",{month:"long",year:"numeric"}),
      growth: (avgGrowth*100).toFixed(1),
      trend: avgGrowth>=0?"up":"down"
    }
  }

  const forecast = forecastNextMonth()
  const sortedMonths = Object.entries(byMonth).sort((a,b)=>b[0].localeCompare(a[0]))
  const maxMonthly = Math.max(...sortedMonths.map(([,v])=>Number(v)),1)

  if (loading) return <div style={{color:"#888",fontSize:13}}>Loading...</div>

  return (
    <div>
      <div style={{display:"flex",gap:8,marginBottom:"1.5rem"}}>
        <button onClick={()=>setTab("revenue")} style={{padding:"6px 16px",borderRadius:8,border:"none",fontSize:12,fontWeight:700,cursor:"pointer",background:tab==="revenue"?"#e6821e":"#f8f8f8",color:tab==="revenue"?"#fff":"#666"}}>Revenue</button>
        <button onClick={()=>setTab("clv")} style={{padding:"6px 16px",borderRadius:8,border:"none",fontSize:12,fontWeight:700,cursor:"pointer",background:tab==="clv"?"#8b5cf6":"#f8f8f8",color:tab==="clv"?"#fff":"#666"}}>Customer LTV</button>
        <button onClick={()=>setTab("heatmap")} style={{padding:"6px 16px",borderRadius:8,border:"none",fontSize:12,fontWeight:700,cursor:"pointer",background:tab==="heatmap"?"#378add":"#f8f8f8",color:tab==="heatmap"?"#fff":"#666"}}>Demand Heatmap</button>
        <button onClick={()=>setTab("gaps")} style={{padding:"6px 16px",borderRadius:8,border:"none",fontSize:12,fontWeight:700,cursor:"pointer",background:tab==="gaps"?"#1d9e75":"#f8f8f8",color:tab==="gaps"?"#fff":"#666"}}>Provider Gaps</button>
      </div>

      {tab==="revenue"&&(
        <>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(4,1fr)",gap:10,marginBottom:"1.5rem"}}>
            {[
              {label:"Total revenue",value:`KES ${total.toLocaleString()}`},
              {label:"Platform commission",value:`KES ${commission.toLocaleString()}`,color:"#e6821e"},
              {label:"Paid to providers",value:`KES ${providerPaid.toLocaleString()}`},
              {label:"Paid to drivers",value:`KES ${driverPaid.toLocaleString()}`},
            ].map(s=>(
              <div key={s.label} style={{background:"#f8f8f8",borderRadius:10,padding:"1rem",border:"1px solid #eeeeee"}}>
                <div style={{fontSize:11,color:"#888",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:6}}>{s.label}</div>
                <div style={{fontFamily:"Syne",fontSize:isMobile?16:22,fontWeight:800,color:s.color||"#000000"}}>{s.value}</div>
              </div>
            ))}
          </div>

          {forecast&&(
            <div style={{background:forecast.trend==="up"?"#f0fdf4":"#fff5f5",border:`1px solid ${forecast.trend==="up"?"#1d9e7540":"#e24b4a40"}`,borderRadius:12,padding:"1.25rem",marginBottom:"1.5rem"}}>
              <div style={{fontFamily:"Syne",fontSize:14,fontWeight:700,marginBottom:4,color:"#000000"}}>📈 Revenue Forecast — {forecast.month}</div>
              <div style={{display:"flex",alignItems:"baseline",gap:12}}>
                <div style={{fontFamily:"Syne",fontSize:28,fontWeight:800,color:forecast.trend==="up"?"#1d9e75":"#e24b4a"}}>KES {Math.round(forecast.amount).toLocaleString()}</div>
                <div style={{fontSize:13,color:forecast.trend==="up"?"#1d9e75":"#e24b4a"}}>{forecast.trend==="up"?"↑":"↓"} {Math.abs(forecast.growth)}% vs last month</div>
              </div>
              <div style={{fontSize:11,color:"#888",marginTop:4}}>Based on average growth rate over last 3 months</div>
            </div>
          )}

          <div style={{fontFamily:"Syne",fontSize:14,fontWeight:700,marginBottom:10}}>Revenue by month</div>
          {sortedMonths.length===0&&<div style={{color:"#888",fontSize:13,textAlign:"center",padding:"2rem"}}>No completed bookings yet</div>}
          {sortedMonths.map(([month,amount])=>(
            <div key={month} style={{background:"#f8f8f8",border:"1px solid #eeeeee",borderRadius:10,padding:"1rem",marginBottom:8}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                <div style={{fontSize:13}}>{new Date(month+"-01").toLocaleString("default",{month:"long",year:"numeric"})}</div>
                <div style={{fontFamily:"Syne",fontSize:14,fontWeight:700,color:"#e6821e"}}>KES {Number(amount).toLocaleString()}</div>
              </div>
              <div style={{height:6,background:"#eeeeee",borderRadius:3,overflow:"hidden"}}>
                <div style={{height:"100%",background:"#e6821e",borderRadius:3,width:`${(Number(amount)/maxMonthly)*100}%`,transition:"width 0.5s"}}/>
              </div>
            </div>
          ))}
        </>
      )}

      {tab==="clv"&&(
        <div>
          <div style={{fontSize:12,color:"#888",marginBottom:"1rem"}}>Top 20 customers by predicted lifetime value. LTV = avg order value × projected future bookings.</div>
          {clvData.length===0&&<div style={{color:"#888",fontSize:13,textAlign:"center",padding:"2rem"}}>No completed bookings yet</div>}
          {clvData.map((row,i)=>(
            <div key={row.customer_id} style={{background:"#f8f8f8",border:"1px solid #eeeeee",borderRadius:10,padding:"1rem",marginBottom:8}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"start",marginBottom:6}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <div style={{width:24,textAlign:"center",fontFamily:"Syne",fontSize:12,fontWeight:800,color:i===0?"#e6821e":i===1?"#888":i===2?"#a0703a":"#bbb"}}>{i+1}</div>
                  <div>
                    <div style={{fontSize:12,color:"#888"}}>{row.customerName}</div>
                    <div style={{fontSize:11,color:"#666",marginTop:2}}>{row.bookings} booking{row.bookings!==1?"s":""} · Last: {row.last_booking}</div>
                  </div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontFamily:"Syne",fontSize:14,fontWeight:800,color:"#8b5cf6"}}>KES {Math.round(row.predicted_clv).toLocaleString()}</div>
                  <div style={{fontSize:10,color:"#888"}}>predicted LTV</div>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
                {[
                  {l:"Total spent",v:`KES ${Math.round(row.total_spend).toLocaleString()}`},
                  {l:"Avg order",v:`KES ${Math.round(row.avg_order).toLocaleString()}`},
                  {l:"Bookings",v:row.bookings},
                ].map(f=>(
                  <div key={f.l}>
                    <div style={{fontSize:10,color:"#888",textTransform:"uppercase"}}>{f.l}</div>
                    <div style={{fontSize:12,fontWeight:600,marginTop:2}}>{f.v}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab==="heatmap"&&(
        <div>
          <div style={{fontFamily:"Syne",fontSize:14,fontWeight:700,marginBottom:10}}>Bookings by Day of Week</div>
          {Object.entries(heatmap.byDay).sort((a,b)=>["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].indexOf(a[0])-["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].indexOf(b[0])).map(([day,count])=>{
            const max = Math.max(...Object.values(heatmap.byDay),1)
            return (
              <div key={day} style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
                <div style={{width:32,fontSize:11,color:"#888"}}>{day}</div>
                <div style={{flex:1,height:20,background:"#eeeeee",borderRadius:4,overflow:"hidden"}}>
                  <div style={{height:"100%",background:"#378add",borderRadius:4,width:`${(count/max)*100}%`,transition:"width 0.5s"}}/>
                </div>
                <div style={{width:24,fontSize:11,fontWeight:700,color:"#378add"}}>{count}</div>
              </div>
            )
          })}
          <div style={{fontFamily:"Syne",fontSize:14,fontWeight:700,margin:"1.5rem 0 10px"}}>Top Services by Demand</div>
          {Object.entries(heatmap.byService).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([svc,count])=>{
            const max = Math.max(...Object.values(heatmap.byService),1)
            return (
              <div key={svc} style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
                <div style={{flex:1,fontSize:12,color:"#000",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{svc}</div>
                <div style={{width:120,height:16,background:"#eeeeee",borderRadius:4,overflow:"hidden"}}>
                  <div style={{height:"100%",background:"#e6821e",borderRadius:4,width:`${(count/max)*100}%`}}/>
                </div>
                <div style={{width:24,fontSize:11,fontWeight:700,color:"#e6821e"}}>{count}</div>
              </div>
            )
          })}
          <div style={{fontFamily:"Syne",fontSize:14,fontWeight:700,margin:"1.5rem 0 10px"}}>Bookings by Hour</div>
          {Object.entries(heatmap.byHour).sort((a,b)=>a[0].localeCompare(b[0])).map(([hr,count])=>{
            const max = Math.max(...Object.values(heatmap.byHour),1)
            return (
              <div key={hr} style={{display:"flex",alignItems:"center",gap:10,marginBottom:4}}>
                <div style={{width:40,fontSize:11,color:"#888"}}>{hr}</div>
                <div style={{flex:1,height:14,background:"#eeeeee",borderRadius:4,overflow:"hidden"}}>
                  <div style={{height:"100%",background:"#1d9e75",borderRadius:4,width:`${(count/max)*100}%`}}/>
                </div>
                <div style={{width:24,fontSize:11,fontWeight:700,color:"#1d9e75"}}>{count}</div>
              </div>
            )
          })}
        </div>
      )}
      {tab==="gaps"&&(
        <div>
          <div style={{fontSize:12,color:"#888",marginBottom:"1rem"}}>Areas with high booking demand but low provider coverage. These locations need more providers.</div>
          {gaps.length===0&&<div style={{color:"#888",fontSize:13,textAlign:"center",padding:"2rem"}}>Not enough data yet</div>}
          {gaps.map((g,i)=>(
            <div key={g.city} style={{background:"#f8f8f8",border:`1px solid ${g.ratio>3?"#e24b4a30":g.ratio>1.5?"#e6821e30":"#eeeeee"}`,borderRadius:10,padding:"1rem",marginBottom:8}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"start",marginBottom:6}}>
                <div>
                  <div style={{fontSize:14,fontWeight:700,color:"#000"}}>{g.city}</div>
                  <div style={{fontSize:11,color:"#888",marginTop:2}}>{g.demand} bookings · {g.providerCount} provider{g.providerCount!==1?"s":""}</div>
                </div>
                <span style={{fontSize:11,padding:"2px 8px",borderRadius:10,background:g.ratio>3?"#fff5f5":g.ratio>1.5?"#fff8f0":"#f0fdf4",color:g.ratio>3?"#e24b4a":g.ratio>1.5?"#e6821e":"#1d9e75"}}>
                  {g.ratio>3?"🔴 Critical":g.ratio>1.5?"🟡 Needed":"🟢 OK"}
                </span>
              </div>
              {g.missingTypes.length>0&&(
                <div style={{fontSize:11,color:"#555",marginTop:4}}>
                  Missing: {g.missingTypes.map(t=>t.replace(/_/g," ")).join(", ")}
                </div>
              )}
              <div style={{marginTop:8,height:4,background:"#eeeeee",borderRadius:2,overflow:"hidden"}}>
                <div style={{height:"100%",background:g.ratio>3?"#e24b4a":g.ratio>1.5?"#e6821e":"#1d9e75",borderRadius:2,width:`${Math.min(g.ratio*20,100)}%`}}/>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}