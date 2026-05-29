import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import useIsMobile from "../../lib/useIsMobile"
import toast from "react-hot-toast"

export default function InspectionRequest({ listing, onSuccess }) {
  const { user, profile } = useAuth()
  const isMobile = useIsMobile()
  const [paying, setPaying] = useState(false)
  const [scheduled, setScheduled] = useState("")
  const [existing, setExisting] = useState(null)

  useEffect(() => {
    supabase.from("inspection_requests").select("*").eq("listing_id",listing.id).maybeSingle()
      .then(({ data }) => setExisting(data))
  }, [listing.id])

  async function requestInspection() {
    if (!scheduled) return toast.error("Please select a preferred date")
    setPaying(true)
    try {
      const ref = `INSP-${Date.now()}-${user.id.slice(0,8)}`
      window.FlutterwaveCheckout({
        public_key: "FLWPUBK_TEST-7cc800b81b21b4d7075e716052932f32-X",
        tx_ref: ref,
        amount: 500,
        currency: "KES",
        payment_options: "card,mpesa",
        customer: {
          email: user.email,
          name: `${profile?.first_name} ${profile?.last_name}`,
        },
        customizations: {
          title: "CCC Vehicle Inspection",
          description: `Inspection for: ${listing.title}`,
        },
        callback: async (response) => {
          if (response.status==="successful") {
            await createInspection(ref, response.transaction_id)
          } else {
            toast.error("Payment failed")
            setPaying(false)
          }
        },
        onclose: () => setPaying(false),
      })
    } catch(err) { toast.error(err.message); setPaying(false) }
  }

  async function createInspection(ref, flwTxId) {
    try {
      const { error } = await supabase.from("inspection_requests").insert({
        listing_id: listing.id,
        seller_id: user.id,
        status: "pending",
        amount: 500,
        flw_transaction_id: flwTxId,
        payment_status: "paid",
        scheduled_date: scheduled,
      })
      if (error) throw error

      // Notify admin
      const { data: admins } = await supabase.from("profiles").select("id").eq("role","admin")
      if (admins?.length) {
        await Promise.all(admins.map(a=>supabase.from("notifications").insert({
          user_id: a.id,
          title: "New inspection request 🔍",
          message: `Inspection requested for listing "${listing.title}". Preferred date: ${scheduled}. Please assign a mechanic.`,
          type: "info",
        })))
      }

      toast.success("Inspection booked! Admin will assign a mechanic shortly.")
      if (onSuccess) onSuccess()
    } catch(err) { toast.error(err.message); setPaying(false) }
  }

  if (existing) return (
    <div style={{ background:"#111", border:"1px solid #1d9e7540", borderRadius:12, padding:"1rem" }}>
      <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, color:"#1d9e75", marginBottom:4 }}>
        {existing.status==="completed"?"✓ CCC Inspected":"🔍 Inspection requested"}
      </div>
      <div style={{ fontSize:11, color:"#555" }}>
        {existing.status==="pending"&&"Waiting for mechanic assignment"}
        {existing.status==="assigned"&&`Mechanic assigned — scheduled ${existing.scheduled_date}`}
        {existing.status==="completed"&&`Inspection result: ${existing.inspection_result?.toUpperCase()}`}
      </div>
      {existing.inspection_notes&&(
        <div style={{ fontSize:11, color:"#888", marginTop:6, fontStyle:"italic" }}>
          "{existing.inspection_notes}"
        </div>
      )}
    </div>
  )

  return (
    <div style={{ background:"#111", border:"1px solid #e6821e30", borderRadius:12, padding:"1.25rem" }}>
      <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:800, color:"#f0ede6", marginBottom:4 }}>
        🔍 Request CCC Inspection
      </div>
      <div style={{ fontSize:12, color:"#555", marginBottom:12 }}>
        Get your vehicle professionally inspected by a CCC verified mechanic. Adds a ✓ CCC Inspected badge to your listing — builds buyer trust and faster sale.
      </div>

      {[
        { icon:"✓", text:"Full mechanical inspection by verified mechanic" },
        { icon:"✓", text:"Inspection report filed on listing" },
        { icon:"✓", text:"CCC Inspected badge on your listing" },
        { icon:"✓", text:"Inspection completed within 48 hours" },
      ].map((item,i)=>(
        <div key={i} style={{ display:"flex", gap:8, marginBottom:4 }}>
          <span style={{ color:"#1d9e75", flexShrink:0 }}>{item.icon}</span>
          <span style={{ fontSize:11, color:"#888" }}>{item.text}</span>
        </div>
      ))}

      <div style={{ margin:"12px 0" }}>
        <label style={{ fontSize:11, color:"#666", display:"block", marginBottom:4 }}>Preferred inspection date *</label>
        <input type="date" value={scheduled} onChange={e=>setScheduled(e.target.value)}
          min={new Date(Date.now()+24*60*60*1000).toISOString().split("T")[0]}
          style={{ width:"100%", background:"#0f0f0f", border:"1px solid #222", borderRadius:8, padding:"9px 12px", color:"#f0ede6", fontSize:13, outline:"none", fontFamily:"'DM Sans',sans-serif" }}/>
      </div>

      <button onClick={requestInspection} disabled={paying}
        style={{ width:"100%", background:paying?"#333":"#e6821e", border:"none", borderRadius:9, color:paying?"#555":"#fff", fontFamily:"Syne,sans-serif", fontSize:13, fontWeight:700, padding:"12px", cursor:paying?"not-allowed":"pointer" }}>
        {paying?"Processing...":"Pay KES 500 — Book inspection"}
      </button>
    </div>
  )
}
