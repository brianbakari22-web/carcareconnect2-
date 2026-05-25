import useIsMobile from "../../lib/useIsMobile"
import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"

export default function AdminRevenue() {
  const isMobile = useIsMobile()
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
    const sub = supabase.channel("admin-revenue")
      .on("postgres_changes", { event:"*", schema:"public", table:"bookings" }, () => load())
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [])

  async function load() {
    const { data } = await supabase.from("bookings").select("*").eq("status","completed").order("created_at",{ascending:false})
    setBookings(data||[])
    setLoading(false)
  }

  const total = bookings.reduce((s,b)=>s+Number(b.total_amount),0)
  const commission = total*0.15
  const providerPaid = bookings.reduce((s,b)=>s+Number(b.provider_earnings||0),0)
  const driverPaid = bookings.reduce((s,b)=>s+Number(b.driver_earnings||0),0)

  const byMonth = bookings.reduce((acc,b)=>{
    const month = b.booking_date?.slice(0,7)
    if (!month) return acc
    acc[month] = (acc[month]||0) + Number(b.total_amount)
    return acc
  },{})

  return (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:10, marginBottom:"1.5rem" }}>
        {[
          { label:"Total revenue", value:`$${total.toFixed(2)}` },
          { label:"Platform commission (15%)", value:`$${commission.toFixed(2)}`, color:"#e6821e" },
          { label:"Paid to providers", value:`$${providerPaid.toFixed(2)}` },
          { label:"Paid to drivers", value:`$${driverPaid.toFixed(2)}` },
        ].map(s => (
          <div key={s.label} style={{ background:"#111", borderRadius:10, padding:"1rem", border:"1px solid #1e1e1e" }}>
            <div style={{ fontSize:11, color:"#555", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:6 }}>{s.label}</div>
            <div style={{ fontFamily:"Syne", fontSize:22, fontWeight:800, color:s.color||"#f0ede6" }}>{s.value}</div>
          </div>
        ))}
      </div>
      <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, marginBottom:10 }}>Revenue by month</div>
      {Object.entries(byMonth).sort((a,b)=>b[0].localeCompare(a[0])).map(([month,amount]) => (
        <div key={month} style={{ background:"#111", border:"1px solid #1e1e1e", borderRadius:10, padding:"1rem", marginBottom:8, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ fontSize:13 }}>{new Date(month+"-01").toLocaleString("default",{month:"long",year:"numeric"})}</div>
          <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, color:"#e6821e" }}>${Number(amount).toFixed(2)}</div>
        </div>
      ))}
      {!loading && Object.keys(byMonth).length===0 && <div style={{ color:"#444", fontSize:13, textAlign:"center", padding:"2rem" }}>No completed bookings yet</div>}
    </div>
  )
}


