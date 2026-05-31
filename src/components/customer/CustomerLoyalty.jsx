import useIsMobile from "../../lib/useIsMobile"
import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import toast from "react-hot-toast"
import { useLanguage } from "../../contexts/LanguageContext"

export default function CustomerLoyalty() {
  const isMobile = useIsMobile()
  const { user } = useAuth()
  const { t } = useLanguage()
  const [loyalty, setLoyalty] = useState(null)
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [redeeming, setRedeeming] = useState(false)
  const [redeemAmount, setRedeemAmount] = useState("")

  useEffect(() => { if (user) load() }, [user])

  async function load() {
    const [{ data: lp }, { data: bks }] = await Promise.all([
      supabase.from("loyalty_points").select("*").eq("user_id", user.id).single(),
      supabase.from("bookings").select("service_name,total_amount,booking_date,status,created_at").eq("customer_id", user.id).eq("status", "completed").order("created_at", { ascending:false })
    ])
    setLoyalty(lp)
    setBookings(bks||[])
    setLoading(false)
  }

  const points = loyalty?.points || 0
  const lifetime = loyalty?.lifetime_points || 0
  const tier = points<1000?"Bronze":points<5000?"Silver":points<10000?"Gold":"Platinum"
  const tierColor = { Bronze:"#cd7f32", Silver:"#aaa", Gold:"#e6821e", Platinum:"#d4537e" }[tier]
  const tierNext = { Bronze:1000, Silver:5000, Gold:10000, Platinum:10000 }[tier]
  const tierBase = { Bronze:0, Silver:1000, Gold:5000, Platinum:10000 }[tier]
  const progress = tier==="Platinum"?100:Math.min(100,((points-tierBase)/(tierNext-tierBase))*100)

  // Redemption rate per tier: Bronze 100pts=$1, Silver 90pts=$1, Gold 80pts=$1, Platinum 70pts=$1
  const redemptionRate = { Bronze:100, Silver:90, Gold:80, Platinum:70 }[tier]
  const maxRedeemPoints = points
  const maxRedeemValue = (points / redemptionRate).toFixed(2)

  async function redeemPoints(e) {
    e.preventDefault()
    const pts = parseInt(redeemAmount)
    if (!pts || pts <= 0) return toast.error("Enter a valid amount")
    if (pts > points) return toast.error(`You only have ${points} points`)
    if (pts < redemptionRate) return toast.error(`Minimum redemption is ${redemptionRate} points ($1)`)
    const dollarValue = (pts / redemptionRate).toFixed(2)
    setRedeeming(true)
    try {
      await supabase.from("loyalty_points")
        .update({ points: points - pts })
        .eq("user_id", user.id)
      toast.success(`Redeemed ${pts} points for KES ${Math.floor(parseInt(redeemAmount||0)/redemptionRate).toLocaleString()} discount! Use it on your next booking.`)
      setRedeemAmount("")
      load()
    } catch(err) { toast.error(err.message) }
    finally { setRedeeming(false) }
  }

  const TIERS = [
    { name:"Bronze", min:0, max:999, rate:100, color:"#cd7f32" },
    { name:"Silver", min:1000, max:4999, rate:90, color:"#aaa" },
    { name:"Gold", min:5000, max:9999, rate:80, color:"#e6821e" },
    { name:"Platinum", min:10000, max:null, rate:70, color:"#d4537e" },
  ]

  if (loading) return <div style={{ color:"#555", fontSize:13 }}>Loading...</div>

  return (
    <div>
      <div style={{ background:"#111", border:`1px solid ${tierColor}40`, borderRadius:12, padding:"1.25rem", marginBottom:"1.25rem" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
          <div>
            <div style={{ fontSize:11, color:"#666", marginBottom:4 }}>Your points balance</div>
            <div style={{ fontFamily:"Syne", fontSize:36, fontWeight:800, color:tierColor, lineHeight:1 }}>{points.toLocaleString()}</div>
            <div style={{ fontSize:11, color:"#555", marginTop:4 }}>Lifetime earned: {lifetime.toLocaleString()} pts</div>
          </div>
          <div style={{ textAlign:"right" }}>
            <span style={{ background:"#1a1208", border:`1px solid ${tierColor}40`, color:tierColor, fontSize:12, padding:"4px 12px", borderRadius:20, fontWeight:600 }}>{tier}</span>
            <div style={{ fontSize:11, color:"#555", marginTop:6 }}>
              {tier !== "Platinum" ? `${(tierNext-points).toLocaleString()} pts to ${TIERS[TIERS.findIndex(t=>t.name===tier)+1]?.name}` : "Max tier reached"}
            </div>
          </div>
        </div>
        <div style={{ height:6, background:"#1e1e1e", borderRadius:3, overflow:"hidden", marginBottom:6 }}>
          <div style={{ height:"100%", background:tierColor, borderRadius:3, width:progress+"%", transition:"width 0.5s" }}/>
        </div>
        <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, color:"#444" }}>
          <span>{tier} {tierBase.toLocaleString()}</span>
          {tier !== "Platinum" && <span>{tierNext.toLocaleString()} pts</span>}
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"repeat(3,1fr)", gap:10, marginBottom:"1.5rem" }}>
        {[
          { label:t("pointsBalance"), value:points.toLocaleString(), color:tierColor },
          { label:t("cashValue"), value:"KES " + Math.floor(points/redemptionRate).toLocaleString() },
          { label:t("redemptionRate"), value:redemptionRate + " pts = KES 1" },
        ].map(s=>(
          <div key={s.label} style={{ background:"#111", borderRadius:10, padding:"1rem", border:"1px solid #1e1e1e" }}>
            <div style={{ fontSize:11, color:"#555", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:6 }}>{s.label}</div>
            <div style={{ fontFamily:"Syne", fontSize:18, fontWeight:800, color:s.color||"#f0ede6" }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ background:"#111", border:"1px solid #1e1e1e", borderRadius:12, padding:"1.25rem", marginBottom:"1.5rem" }}>
        <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, marginBottom:12, color:"#f0ede6" }}>Tier benefits</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8 }}>
          {TIERS.map(t=>(
            <div key={t.name} style={{ background: tier===t.name?"#161208":"#0f0f0f", border:`1px solid ${tier===t.name?t.color+"40":"#222"}`, borderRadius:10, padding:"0.9rem", textAlign:"center" }}>
              <div style={{ fontSize:13, fontWeight:700, color:t.color, marginBottom:4 }}>{t.name}</div>
              <div style={{ fontSize:10, color:"#555", marginBottom:6 }}>
                {t.max ? `KES {t.min.toLocaleString()}–${t.max.toLocaleString()}` : `KES {t.min.toLocaleString()}+`} pts
              </div>
              <div style={{ fontFamily:"Syne", fontSize:12, fontWeight:700, color: tier===t.name?t.color:"#888" }}>{t.rate} pts = KES 1</div>
              {tier===t.name&&<div style={{ fontSize:9, color:t.color, marginTop:4 }}>Your tier</div>}
            </div>
          ))}
        </div>
      </div>

      {points >= redemptionRate && (
        <div style={{ background:"#111", border:`1px solid ${tierColor}30`, borderRadius:12, padding:"1.25rem", marginBottom:"1.5rem" }}>
          <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, marginBottom:4, color:"#f0ede6" }}>Redeem points</div>
          <div style={{ fontSize:12, color:"#555", marginBottom:"1rem" }}>
            You can redeem up to {points.toLocaleString()} points for ${maxRedeemValue} off your next booking
          </div>
          <form onSubmit={redeemPoints}>
            <div style={{ display:"flex", gap:10, alignItems:"flex-end" }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:11, color:"#666", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:6 }}>Points to redeem</div>
                <input
                  type="number"
                  min={redemptionRate}
                  max={points}
                  step={redemptionRate}
                  value={redeemAmount}
                  onChange={e=>setRedeemAmount(e.target.value)}
                  placeholder={`Min ${redemptionRate} points`}
                  style={{ width:"100%", background:"#0f0f0f", border:"1px solid #222", borderRadius:8, padding:"10px 12px", color:"#f0ede6", fontSize:13, outline:"none", fontFamily:"'DM Sans',sans-serif" }}
                />
              </div>
              <div style={{ textAlign:"right", flexShrink:0 }}>
                <div style={{ fontSize:11, color:"#555", marginBottom:6 }}>Value</div>
                <div style={{ fontFamily:"Syne", fontSize:18, fontWeight:800, color:tierColor }}>
                  KES ${redeemAmount ? Math.floor(parseInt(redeemAmount||0)/redemptionRate).toLocaleString() : "0"}
                </div>
              </div>
            </div>
            <button type="submit" disabled={redeeming||!redeemAmount||parseInt(redeemAmount)<redemptionRate}
              style={{ width:"100%", marginTop:12, background: redeemAmount&&parseInt(redeemAmount)>=redemptionRate?"#e6821e":"#333", border:"none", borderRadius:9, color: redeemAmount&&parseInt(redeemAmount)>=redemptionRate?"#fff":"#666", fontFamily:"Syne,sans-serif", fontSize:14, fontWeight:700, padding:"12px", cursor: redeemAmount&&parseInt(redeemAmount)>=redemptionRate?"pointer":"not-allowed" }}>
              {redeeming ? "Redeeming..." : `Redeem ${redeemAmount||0} points for KES ${Math.floor(parseInt(redeemAmount||0)/redemptionRate).toLocaleString()}`}
            </button>
          </form>
        </div>
      )}

      {points < redemptionRate && points > 0 && (
        <div style={{ background:"#1a1208", border:"1px solid #e6821e20", borderRadius:10, padding:"1rem", marginBottom:"1.5rem", fontSize:13, color:"#888" }}>
          You need {redemptionRate - points} more points to start redeeming. Keep booking to earn more!
        </div>
      )}

      <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, marginBottom:10, color:"#f0ede6" }}>Points earned from bookings</div>
      {bookings.length===0&&<div style={{ color:"#444", fontSize:13, textAlign:"center", padding:"1.5rem" }}>No completed bookings yet</div>}
      {bookings.map((b,i)=>(
        <div key={i} style={{ background:"#111", border:"1px solid #1e1e1e", borderRadius:10, padding:"0.9rem", marginBottom:8, display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:36, height:36, background:"#071a12", borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>🔧</div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:13, fontWeight:500, color:"#f0ede6" }}>{b.service_name}</div>
            <div style={{ fontSize:11, color:"#555", marginTop:2 }}>{b.booking_date}</div>
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, color:"#1d9e75" }}>+{Math.floor(Number(b.total_amount)*10).toLocaleString()} pts</div>
            <div style={{ fontSize:10, color:"#555" }}>${Number(b.total_amount).toFixed(2)} spent</div>
          </div>
        </div>
      ))}
    </div>
  )
}










