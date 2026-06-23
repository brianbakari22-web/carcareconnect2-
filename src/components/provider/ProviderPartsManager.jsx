import { useState, useEffect } from "react"
import { supabase } from "../../lib/supabase"
import useIsMobile from "../../lib/useIsMobile"
import toast from "react-hot-toast"

export default function ProviderPartsManager({ booking, onUpdate }) {
  const isMobile = useIsMobile()
  const [parts, setParts] = useState(booking.parts_details||[])
  const [newPart, setNewPart] = useState({ name:"", quantity:1, unit_price:"" })
  const [saving, setSaving] = useState(false)
  const [commissionRate, setCommissionRate] = useState(0.10)

  useEffect(() => {
    // Fetch commission rate for parts based on provider type
    supabase.from("profiles").select("provider_type").eq("id", booking.provider_id).maybeSingle()
      .then(({ data: prov }) => {
        if (!prov?.provider_type) return
        const key = prov.provider_type === "parts_dealer" ? "parts_dealer" : "marketplace_item"
        supabase.from("commission_rates").select("platform_rate").eq("provider_type", key).maybeSingle()
          .then(({ data: rate }) => { if (rate) setCommissionRate(Number(rate.platform_rate)) })
      })
  }, [booking.provider_id])

  function addPart() {
    if (!newPart.name||!newPart.unit_price) return toast.error("Part name and price required")
    const part = {
      id: Date.now(),
      name: newPart.name,
      quantity: parseInt(newPart.quantity)||1,
      unit_price: parseFloat(newPart.unit_price),
      total: parseInt(newPart.quantity||1) * parseFloat(newPart.unit_price),
    }
    setParts(p=>[...p, part])
    setNewPart({ name:"", quantity:1, unit_price:"" })
  }

  function removePart(id) {
    setParts(p=>p.filter(p=>p.id!==id))
  }

  const totalPartsCost = parts.reduce((s,p)=>s+p.total, 0)
  const partsCommission = totalPartsCost * commissionRate
  const partsProviderEarnings = totalPartsCost * (1 - commissionRate)
  const updatedTotal = Number(booking.total_amount) + totalPartsCost

  async function saveParts() {
    setSaving(true)
    try {
      const { error } = await supabase.from("bookings").update({
        parts_details: parts,
        parts_cost: totalPartsCost,
        parts_commission: partsCommission,
        parts_provider_earnings: partsProviderEarnings,
        updated_total: updatedTotal,
        parts_needed: parts.length > 0,
        parts_approved: false,
      }).eq("id", booking.id)
      if (error) throw error

      await supabase.from("notifications").insert({
        user_id: booking.customer_id,
        title: "Parts added to your booking 🔧",
        message: `Your provider has added parts worth KES ${totalPartsCost.toLocaleString()} to your booking. New total: KES ${updatedTotal.toLocaleString()}. Please review and approve.`,
        type: "info",
      })

      toast.success("Parts saved — customer notified")
      onUpdate()
    } catch(err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const inp = { background:"#ffffff", border:"1px solid #e5e5e5", borderRadius:8, padding:"9px 12px", color:"#000000", fontSize:13, outline:"none", fontFamily:"'DM Sans',sans-serif" }

  return (
    <div style={{ background:"#ffffff", border:"1px solid #378add30", borderRadius:12, padding:"1rem", marginTop:10 }}>
      <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, color:"#378add", marginBottom:8 }}>🔧 Parts & materials</div>

      {booking.problem_description&&(
        <div style={{ background:"#ffffff", borderRadius:8, padding:"0.75rem", marginBottom:12 }}>
          <div style={{ fontSize:10, color:"#777777", marginBottom:4 }}>Customer reported problem:</div>
          <div style={{ fontSize:12, color:"#555555", lineHeight:1.5 }}>"{booking.problem_description}"</div>
          {booking.parts_description&&(
            <div style={{ fontSize:11, color:"#666", marginTop:4 }}>Parts mentioned: {booking.parts_description}</div>
          )}
        </div>
      )}

      {parts.map(p=>(
        <div key={p.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 0", borderBottom:"1px solid #eeeeee" }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:12, color:"#000000" }}>{p.name}</div>
            <div style={{ fontSize:10, color:"#777777" }}>Qty: {p.quantity} × KES {p.unit_price.toLocaleString()}</div>
          </div>
          <div style={{ fontFamily:"Syne", fontSize:12, fontWeight:700, color:"#e6821e" }}>KES {p.total.toLocaleString()}</div>
          <button onClick={()=>removePart(p.id)} style={{ background:"none", border:"none", color:"#e24b4a", cursor:"pointer", fontSize:16, padding:"0 4px" }}>×</button>
        </div>
      ))}

      <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"2fr 1fr 1fr auto", gap:8, marginTop:10, marginBottom:10 }}>
        <input style={{ ...inp, width:"100%" }} placeholder="Part name (e.g. Brake pads)" value={newPart.name} onChange={e=>setNewPart(p=>({...p,name:e.target.value}))}/>
        <input style={{ ...inp, width:"100%" }} type="number" placeholder="Qty" min="1" value={newPart.quantity} onChange={e=>setNewPart(p=>({...p,quantity:e.target.value}))}/>
        <input style={{ ...inp, width:"100%" }} type="number" placeholder="Unit price (KES)" value={newPart.unit_price} onChange={e=>setNewPart(p=>({...p,unit_price:e.target.value}))}/>
        <button onClick={addPart} style={{ background:"#378add", border:"none", borderRadius:8, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:12, fontWeight:700, padding:"9px 14px", cursor:"pointer", whiteSpace:"nowrap" }}>+ Add</button>
      </div>

      {parts.length>0&&(
        <div style={{ background:"#ffffff", borderRadius:8, padding:"0.75rem", marginBottom:10 }}>
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"#777777", marginBottom:4 }}>
            <span>Parts total</span><span>KES {totalPartsCost.toLocaleString()}</span>
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"#777777", marginBottom:4 }}>
            <span>Platform fee ({Math.round(commissionRate*100)}%)</span><span>KES {partsCommission.toFixed(0)}</span>
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"#1d9e75", marginBottom:4 }}>
            <span>Your earnings (90%)</span><span>KES {partsProviderEarnings.toFixed(0)}</span>
          </div>
          <div style={{ height:1, background:"#f0f0f0", margin:"6px 0" }}/>
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, color:"#e6821e", fontWeight:700 }}>
            <span>New booking total</span><span>KES {updatedTotal.toLocaleString()}</span>
          </div>
        </div>
      )}

      <button onClick={saveParts} disabled={saving||parts.length===0}
        style={{ background:saving||parts.length===0?"#555555":"#378add", border:"none", borderRadius:8, color:saving||parts.length===0?"#555":"#fff", fontFamily:"Syne,sans-serif", fontSize:12, fontWeight:700, padding:"9px 18px", cursor:saving||parts.length===0?"not-allowed":"pointer" }}>
        {saving?"Saving...":"Save parts & notify customer"}
      </button>
    </div>
  )
}


