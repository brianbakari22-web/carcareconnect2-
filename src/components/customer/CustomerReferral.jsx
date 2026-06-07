import useIsMobile from "../../lib/useIsMobile"
import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import toast from "react-hot-toast"

const REFERRAL_POINTS = 500
const REFERRED_POINTS = 200

export default function CustomerReferral() {
  const isMobile = useIsMobile()
  const { user, profile } = useAuth()
  const [referrals, setReferrals] = useState([])
  const [stats, setStats] = useState({ total:0, completed:0, pending:0, pointsEarned:0 })
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => { if (user) load() }, [user])

  async function load() {
    const { data } = await supabase.from("referrals")
      .select("*, profiles!referrals_referred_id_fkey(first_name,last_name,created_at)")
      .eq("referrer_id", user.id)
      .order("created_at", { ascending:false })

    const refs = data||[]
    setReferrals(refs)
    setStats({
      total: refs.length,
      completed: refs.filter(r=>r.status==="completed"||r.status==="rewarded").length,
      pending: refs.filter(r=>r.status==="pending").length,
      pointsEarned: refs.filter(r=>r.status==="rewarded").reduce((s,r)=>s+r.points_awarded,0)
    })
    setLoading(false)
  }

  function getReferralLink() {
    return `${window.location.origin}/auth?ref=${profile?.referral_code}`
  }

  async function copyLink() {
    await navigator.clipboard.writeText(getReferralLink())
    setCopied(true)
    toast.success("Referral link copied!")
    setTimeout(() => setCopied(false), 2000)
  }

  function shareWhatsApp() {
    const msg = encodeURIComponent(`Join Car Care Connect and get your car serviced easily! Use my referral link to sign up and earn ${REFERRED_POINTS} bonus points: ${getReferralLink()}`)
    window.open(`https://wa.me/?text=${msg}`, "_blank")
  }

  function shareEmail() {
    const subject = encodeURIComponent("Join Car Care Connect")
    const body = encodeURIComponent(`Hi!\n\nI've been using Car Care Connect for my car service needs and it's amazing.\n\nSign up using my referral link and get ${REFERRED_POINTS} bonus loyalty points:\n${getReferralLink()}\n\nSee you there!`)
    window.open(`mailto:?subject=${subject}&body=${body}`, "_blank")
  }

  const RC = { pending:"#e6821e", completed:"#378add", rewarded:"#1d9e75" }

  return (
    <div>
      <div style={{ marginBottom:"1.5rem" }}>
        <div style={{ fontFamily:"Syne", fontSize:20, fontWeight:800, color:"#000000" }}>
          Refer & <span style={{ color:"#e6821e" }}>Earn</span>
        </div>
        <div style={{ fontSize:12, color:"#777777", marginTop:2 }}>
          Earn {REFERRAL_POINTS} points for every friend who joins
        </div>
      </div>

      <div style={{ background:"linear-gradient(135deg, #1a1208 0%, #111 100%)", border:"1px solid #e6821e30", borderRadius:16, padding:"1.5rem", marginBottom:"1.5rem" }}>
        <div style={{ fontFamily:"Syne", fontSize:16, fontWeight:800, color:"#000000", marginBottom:4 }}>Your referral code</div>
        <div style={{ fontSize:12, color:"#555555", marginBottom:"1.25rem" }}>
          Share this code or link with friends. You earn <span style={{ color:"#e6821e", fontWeight:600 }}>{REFERRAL_POINTS} points</span> when they sign up and make their first booking. They get <span style={{ color:"#1d9e75", fontWeight:600 }}>{REFERRED_POINTS} bonus points</span> too!
        </div>

        <div style={{ background:"#ffffff", borderRadius:10, padding:"1rem", marginBottom:"1rem", display:"flex", alignItems:"center", justifyContent:"space-between", gap:10 }}>
          <div>
            <div style={{ fontSize:10, color:"#777777", textTransform:"uppercase", marginBottom:4 }}>Your code</div>
            <div style={{ fontFamily:"Syne", fontSize:28, fontWeight:800, color:"#e6821e", letterSpacing:4 }}>
              {profile?.referral_code || "..."}
            </div>
          </div>
          <button onClick={copyLink}
            style={{ background:copied?"#071a12":"#e6821e", border:`1px solid ${copied?"#1d9e7540":"transparent"}`, borderRadius:9, color:copied?"#1d9e75":"#fff", fontFamily:"Syne,sans-serif", fontSize:12, fontWeight:700, padding:"10px 18px", cursor:"pointer", flexShrink:0, transition:"all 0.2s" }}>
            {copied?"✓ Copied!":"Copy code"}
          </button>
        </div>

        <div style={{ background:"#ffffff", borderRadius:10, padding:"0.9rem", marginBottom:"1rem" }}>
          <div style={{ fontSize:10, color:"#777777", textTransform:"uppercase", marginBottom:4 }}>Referral link</div>
          <div style={{ fontSize:11, color:"#666", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{getReferralLink()}</div>
        </div>

        <div style={{ display:"flex", gap:8 }}>
          <button onClick={shareWhatsApp}
            style={{ flex:1, background:"#071a12", border:"1px solid #1d9e7540", borderRadius:9, color:"#1d9e75", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"11px", cursor:"pointer" }}>
            Share on WhatsApp
          </button>
          <button onClick={shareEmail}
            style={{ flex:1, background:"#0c1f2e", border:"1px solid #378add40", borderRadius:9, color:"#378add", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"11px", cursor:"pointer" }}>
            Share via Email
          </button>
          <button onClick={copyLink}
            style={{ background:"#f5f5f5", border:"1px solid #dddddd", borderRadius:9, color:"#555555", fontSize:13, padding:"11px 16px", cursor:"pointer" }}>
            🔗
          </button>
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(4,1fr)", gap:10, marginBottom:"1.5rem" }}>
        {[
          { label:"Total referrals", value:stats.total },
          { label:"Completed", value:stats.completed, color:"#1d9e75" },
          { label:"Pending", value:stats.pending, color:stats.pending>0?"#e6821e":undefined },
          { label:"Points earned", value:stats.pointsEarned.toLocaleString(), color:"#e6821e" },
        ].map(s=>(
          <div key={s.label} style={{ background:"#ffffff", borderRadius:10, padding:"1rem", border:"1px solid #eeeeee" }}>
            <div style={{ fontSize:11, color:"#777777", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:6 }}>{s.label}</div>
            <div style={{ fontFamily:"Syne", fontSize:20, fontWeight:800, color:s.color||"#f0ede6" }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:12, padding:"1.25rem", marginBottom:"1.5rem" }}>
        <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, marginBottom:"1rem", color:"#000000" }}>How it works</div>
        {[
          { step:"1", title:"Share your code", desc:`Send your unique referral code or link to friends`, icon:"📤" },
          { step:"2", title:"Friend signs up", desc:"They register using your referral link", icon:"👤" },
          { step:"3", title:"First booking made", desc:"They complete their first service booking", icon:"✅" },
          { step:"4", title:"Both earn points", desc:`You get ${REFERRAL_POINTS} pts · They get ${REFERRED_POINTS} pts`, icon:"🎉" },
        ].map((s,i)=>(
          <div key={s.step} style={{ display:"flex", gap:12, marginBottom:i<3?12:0 }}>
            <div style={{ width:40, height:40, borderRadius:10, background:"#1a1208", border:"1px solid #e6821e30", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, flexShrink:0 }}>
              {s.icon}
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:600, color:"#000000", marginBottom:2 }}>{s.title}</div>
              <div style={{ fontSize:11, color:"#666" }}>{s.desc}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, marginBottom:10, color:"#000000" }}>
        Your referrals ({referrals.length})
      </div>
      {loading&&<div style={{ color:"#777777", fontSize:13 }}>Loading...</div>}
      {!loading&&referrals.length===0&&(
        <div style={{ color:"#888888", fontSize:13, textAlign:"center", padding:"2rem", background:"#ffffff", borderRadius:10, border:"1px solid #eeeeee" }}>
          No referrals yet. Share your code to get started!
        </div>
      )}
      {referrals.map(r=>(
        <div key={r.id} style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:10, padding:"1rem", marginBottom:8, display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:40, height:40, borderRadius:"50%", background:"#1a1208", border:"1px solid #e6821e30", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"Syne", fontSize:14, fontWeight:800, color:"#e6821e", flexShrink:0 }}>
            {r.profiles?.first_name?.[0]||"?"}
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:13, fontWeight:500, color:"#000000" }}>
              {r.profiles?.first_name&&r.profiles?.last_name ? `${r.profiles.first_name} ${r.profiles.last_name}` : "Pending signup"}
            </div>
            <div style={{ fontSize:11, color:"#777777", marginTop:2 }}>
              {r.status==="rewarded" ? `+${r.points_awarded} points earned` : r.status==="completed" ? "Booking completed — points pending" : "Waiting for first booking"}
            </div>
            <div style={{ fontSize:10, color:"#888888", marginTop:2 }}>{new Date(r.created_at).toLocaleDateString()}</div>
          </div>
          <span style={{ fontSize:11, padding:"3px 9px", borderRadius:20, background:`${RC[r.status]||"#888"}20`, color:RC[r.status]||"#888", border:`1px solid ${RC[r.status]||"#888"}40`, flexShrink:0 }}>
            {r.status}
          </span>
        </div>
      ))}
    </div>
  )
}



