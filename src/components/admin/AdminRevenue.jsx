import useIsMobile from "../../lib/useIsMobile"
import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"

export default function AdminRevenue() {
  const isMobile = useIsMobile()
  const [bookings, setBookings] = useState([])
  const [clvData, setClvData] = useState([])
  const [tab, setTab] = useState("revenue")
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
    setClvData(clv)
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
                    <div style={{fontSize:12,color:"#888"}}>Customer: {row.customer_id.slice(0,8)}...</div>
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
    </div>
  )
}