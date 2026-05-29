import { useState } from "react"
import { supabase } from "../../lib/supabase"
import { useAuth } from "../../contexts/AuthContext"
import { useNavigate } from "react-router-dom"
import useIsMobile from "../../lib/useIsMobile"
import toast from "react-hot-toast"
import PhotoUpload from "./PhotoUpload"

const PART_CATEGORIES = ["Engine","Brakes","Suspension","Electrical","Body & Panel","Tyres & Wheels","Exhaust","Cooling","Transmission","Interior","Exterior","Accessories","Other"]
const MAKES = ["Toyota","Nissan","Honda","Mitsubishi","Subaru","Mazda","BMW","Mercedes","Volkswagen","Ford","Chevrolet","Isuzu","Suzuki","Hyundai","Kia","Peugeot","Renault","Other"]
const BODY_TYPES = ["Sedan","SUV","Hatchback","Pickup","Van","Coupe","Convertible","Wagon","Bus","Truck"]

export default function CreateListing() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [saving, setSaving] = useState(false)
  const [listingId, setListingId] = useState(null)
  const [step, setStep] = useState("form")
  const [agreed, setAgreed] = useState(false)
  const [form, setForm] = useState({
    listing_type:"vehicle", title:"", description:"", price:"", negotiable:true,
    condition:"used", city:"", location:"", make:"", model:"", year:"", mileage:"",
    color:"", transmission:"manual", fuel_type:"petrol", engine_size:"", body_type:"",
    drive_type:"2wd", part_category:"", compatible_makes:[], part_number:"", quantity:"1",
  })

  const f = (key, val) => setForm(prev=>({...prev,[key]:val}))

  async function submit(e) {
    e.preventDefault()
    if (!agreed) return toast.error("Please agree to marketplace terms")
    setSaving(true)
    try {
      const payload = {
        seller_id: user.id,
        listing_type: form.listing_type,
        title: form.title,
        description: form.description,
        price: parseFloat(form.price),
        negotiable: form.negotiable,
        condition: form.condition,
        city: form.city,
        location: form.location,
        status: "pending",
        commission_rate: form.listing_type==="vehicle" ? 0.02 : 0.08,
      }
      if (form.listing_type==="vehicle") {
        Object.assign(payload, {
          make:form.make, model:form.model,
          year:parseInt(form.year)||null,
          mileage:parseInt(form.mileage)||null,
          color:form.color, transmission:form.transmission,
          fuel_type:form.fuel_type, engine_size:form.engine_size,
          body_type:form.body_type, drive_type:form.drive_type,
        })
      }
      if (form.listing_type==="part"||form.listing_type==="accessory") {
        Object.assign(payload, {
          part_category:form.part_category,
          part_number:form.part_number,
          quantity:parseInt(form.quantity)||1,
          compatible_makes:form.compatible_makes,
        })
      }
      const { data, error } = await supabase.from("marketplace_listings").insert(payload).select().single()
      if (error) throw error
      if (!data?.id) throw new Error("Failed to create listing")
      setListingId(data.id)
      setStep("photos")
      toast.success("Listing created! Now add photos.")
    } catch(err) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  const inp = { width:"100%", background:"#111", border:"1px solid #222", borderRadius:8, padding:"11px 12px", color:"#f0ede6", fontSize:13, outline:"none", fontFamily:"'DM Sans',sans-serif", marginBottom:12 }
  const lbl = { fontSize:11, color:"#666", textTransform:"uppercase", letterSpacing:"0.05em", display:"block", marginBottom:4 }

  if (step==="photos") return (
    <div style={{ maxWidth:600 }}>
      <div style={{ fontFamily:"Syne", fontSize:20, fontWeight:800, color:"#f0ede6", marginBottom:4 }}>Add photos 📸</div>
      <div style={{ fontSize:12, color:"#555", marginBottom:"1.5rem" }}>
        Listings with photos get 5x more views. Add up to 10 photos.
      </div>
      <div style={{ background:"#111", border:"1px solid #1e1e1e", borderRadius:12, padding:"1.25rem", marginBottom:"1.25rem" }}>
        <PhotoUpload listingId={listingId} existingPhotos={[]} onUploaded={()=>{}}/>
      </div>
      <div style={{ display:"flex", gap:8 }}>
        <button onClick={()=>navigate("/dashboard/marketplace")}
          style={{ flex:1, background:"#e6821e", border:"none", borderRadius:10, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:14, fontWeight:700, padding:"14px", cursor:"pointer" }}>
          Done — view listing →
        </button>
        <button onClick={()=>navigate("/dashboard/marketplace")}
          style={{ background:"none", border:"1px solid #333", borderRadius:10, color:"#666", fontSize:13, padding:"14px 18px", cursor:"pointer" }}>
          Skip
        </button>
      </div>
      <div style={{ fontSize:11, color:"#444", textAlign:"center", marginTop:8 }}>
        Your listing is submitted for review. Photos help admin approve faster.
      </div>
    </div>
  )

  return (
    <div style={{ maxWidth:600 }}>
      <button onClick={()=>navigate("/dashboard/marketplace")} style={{ background:"none", border:"none", color:"#e6821e", cursor:"pointer", fontSize:13, marginBottom:"1rem", fontFamily:"'DM Sans',sans-serif", padding:0 }}>← Back</button>
      <div style={{ fontFamily:"Syne", fontSize:isMobile?18:22, fontWeight:800, color:"#f0ede6", marginBottom:4 }}>List an item</div>
      <div style={{ fontSize:12, color:"#555", marginBottom:"1.5rem" }}>Reviewed within 24 hours before going live</div>

      <div style={{ background:"#1a0808", border:"1px solid #e24b4a30", borderRadius:10, padding:"0.9rem", marginBottom:"1.5rem" }}>
        <div style={{ fontSize:12, color:"#e24b4a", fontWeight:600, marginBottom:4 }}>⚠️ Important rules</div>
        {["Do NOT include phone number, WhatsApp or email in listing","All buyer communication must stay within Car Care Connect","Violation results in listing removal and account suspension","Platform commission applies on successful sale"].map((r,i)=>(
          <div key={i} style={{ display:"flex", gap:8, marginBottom:4 }}><span style={{ color:"#e24b4a" }}>•</span><span style={{ fontSize:11, color:"#888" }}>{r}</span></div>
        ))}
      </div>

      <form onSubmit={submit}>
        <div style={{ marginBottom:16 }}>
          <label style={lbl}>What are you selling? *</label>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8 }}>
            {[{k:"vehicle",l:"🚗 Vehicle",d:"Cars, trucks"},{k:"part",l:"🔧 Car part",d:"Engine, brakes"},{k:"accessory",l:"✨ Accessory",d:"Mats, covers"}].map(t=>(
              <button key={t.k} type="button" onClick={()=>f("listing_type",t.k)}
                style={{ background:form.listing_type===t.k?"#1a1208":"#0f0f0f", border:`1px solid ${form.listing_type===t.k?"#e6821e":"#222"}`, borderRadius:10, padding:"0.75rem", cursor:"pointer", textAlign:"left" }}>
                <div style={{ fontSize:16, marginBottom:4 }}>{t.l.split(" ")[0]}</div>
                <div style={{ fontSize:11, fontWeight:600, color:form.listing_type===t.k?"#e6821e":"#666" }}>{t.l.split(" ").slice(1).join(" ")}</div>
                <div style={{ fontSize:9, color:"#444", marginTop:2 }}>{t.d}</div>
              </button>
            ))}
          </div>
        </div>

        <label style={lbl}>Listing title *</label>
        <input style={inp} placeholder={form.listing_type==="vehicle"?"e.g. 2018 Toyota Vitz 1300cc":"e.g. Toyota Vitz Brake Pads (Front)"} value={form.title} onChange={e=>f("title",e.target.value)} required/>

        <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:10 }}>
          <div><label style={lbl}>Price (KES) *</label><input style={inp} type="number" placeholder="e.g. 850000" value={form.price} onChange={e=>f("price",e.target.value)} required min="0"/></div>
          <div><label style={lbl}>Condition *</label>
            <select style={inp} value={form.condition} onChange={e=>f("condition",e.target.value)}>
              <option value="new">New</option><option value="used">Used</option><option value="refurbished">Refurbished</option><option value="for_parts">For parts only</option>
            </select>
          </div>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:10 }}>
          <div><label style={lbl}>City *</label><input style={inp} placeholder="e.g. Nairobi" value={form.city} onChange={e=>f("city",e.target.value)} required/></div>
          <div><label style={lbl}>Area/Estate</label><input style={inp} placeholder="e.g. Westlands" value={form.location} onChange={e=>f("location",e.target.value)}/></div>
        </div>

        <label style={{ display:"flex", alignItems:"center", gap:8, marginBottom:16, cursor:"pointer" }}>
          <input type="checkbox" checked={form.negotiable} onChange={e=>f("negotiable",e.target.checked)} style={{ accentColor:"#e6821e" }}/>
          <span style={{ fontSize:12, color:"#666" }}>Price is negotiable</span>
        </label>

        {form.listing_type==="vehicle"&&(
          <div>
            <div style={{ height:1, background:"#1e1e1e", margin:"8px 0 16px" }}/>
            <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, color:"#f0ede6", marginBottom:12 }}>Vehicle details</div>
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:10 }}>
              <div><label style={lbl}>Make *</label>
                <select style={inp} value={form.make} onChange={e=>f("make",e.target.value)} required>
                  <option value="">Select make</option>{MAKES.map(m=><option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div><label style={lbl}>Model *</label><input style={inp} placeholder="e.g. Vitz, Fielder" value={form.model} onChange={e=>f("model",e.target.value)} required/></div>
              <div><label style={lbl}>Year *</label><input style={inp} type="number" placeholder="2018" min="1990" max="2026" value={form.year} onChange={e=>f("year",e.target.value)} required/></div>
              <div><label style={lbl}>Mileage (km)</label><input style={inp} type="number" placeholder="45000" value={form.mileage} onChange={e=>f("mileage",e.target.value)}/></div>
              <div><label style={lbl}>Color</label><input style={inp} placeholder="Pearl White" value={form.color} onChange={e=>f("color",e.target.value)}/></div>
              <div><label style={lbl}>Engine size</label><input style={inp} placeholder="1300cc" value={form.engine_size} onChange={e=>f("engine_size",e.target.value)}/></div>
              <div><label style={lbl}>Transmission</label>
                <select style={inp} value={form.transmission} onChange={e=>f("transmission",e.target.value)}>
                  <option value="manual">Manual</option><option value="automatic">Automatic</option>
                </select>
              </div>
              <div><label style={lbl}>Fuel type</label>
                <select style={inp} value={form.fuel_type} onChange={e=>f("fuel_type",e.target.value)}>
                  <option value="petrol">Petrol</option><option value="diesel">Diesel</option><option value="electric">Electric</option><option value="hybrid">Hybrid</option>
                </select>
              </div>
              <div><label style={lbl}>Body type</label>
                <select style={inp} value={form.body_type} onChange={e=>f("body_type",e.target.value)}>
                  <option value="">Select</option>{BODY_TYPES.map(b=><option key={b} value={b.toLowerCase()}>{b}</option>)}
                </select>
              </div>
              <div><label style={lbl}>Drive type</label>
                <select style={inp} value={form.drive_type} onChange={e=>f("drive_type",e.target.value)}>
                  <option value="2wd">2WD</option><option value="4wd">4WD</option><option value="awd">AWD</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {(form.listing_type==="part"||form.listing_type==="accessory")&&(
          <div>
            <div style={{ height:1, background:"#1e1e1e", margin:"8px 0 16px" }}/>
            <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, color:"#f0ede6", marginBottom:12 }}>Part details</div>
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:10 }}>
              <div><label style={lbl}>Category *</label>
                <select style={inp} value={form.part_category} onChange={e=>f("part_category",e.target.value)} required>
                  <option value="">Select</option>{PART_CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div><label style={lbl}>Part number</label><input style={inp} placeholder="04465-52080" value={form.part_number} onChange={e=>f("part_number",e.target.value)}/></div>
              <div><label style={lbl}>Quantity</label><input style={inp} type="number" min="1" value={form.quantity} onChange={e=>f("quantity",e.target.value)}/></div>
            </div>
            <label style={lbl}>Compatible makes</label>
            <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:12 }}>
              {MAKES.filter(m=>m!=="Other").map(m=>(
                <button key={m} type="button"
                  onClick={()=>f("compatible_makes",form.compatible_makes.includes(m)?form.compatible_makes.filter(x=>x!==m):[...form.compatible_makes,m])}
                  style={{ padding:"4px 10px", borderRadius:6, border:"none", fontSize:11, cursor:"pointer", background:form.compatible_makes.includes(m)?"#e6821e":"#111", color:form.compatible_makes.includes(m)?"#fff":"#666" }}>
                  {m}
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{ height:1, background:"#1e1e1e", margin:"8px 0 16px" }}/>
        <label style={lbl}>Description *</label>
        <textarea style={{ ...inp, resize:"vertical", minHeight:100 }}
          placeholder="Describe the item. Do NOT include phone numbers or contact details."
          value={form.description} onChange={e=>f("description",e.target.value)} required/>

        <div style={{ background:"#0f0f0f", borderRadius:8, padding:"0.75rem", marginBottom:16 }}>
          <div style={{ fontSize:11, color:"#555", marginBottom:4 }}>Commission on sale:</div>
          <div style={{ fontSize:13, color:"#e6821e", fontWeight:600 }}>{form.listing_type==="vehicle"?"2% of sale price":"8% of sale price"}</div>
          {form.price&&<div style={{ fontSize:11, color:"#555", marginTop:4 }}>On KES {Number(form.price).toLocaleString()} → You receive: KES {(Number(form.price)*(form.listing_type==="vehicle"?0.98:0.92)).toFixed(0)}</div>}
        </div>

        <label style={{ display:"flex", alignItems:"flex-start", gap:10, marginBottom:20, cursor:"pointer" }}>
          <input type="checkbox" checked={agreed} onChange={e=>setAgreed(e.target.checked)} style={{ accentColor:"#e6821e", marginTop:2, flexShrink:0 }}/>
          <span style={{ fontSize:12, color:"#666", lineHeight:1.6 }}>I agree to Car Care Connect Marketplace Terms. I confirm no personal contact details are included. I understand platform commission applies on sale.</span>
        </label>

        <button type="submit" disabled={saving||!agreed}
          style={{ width:"100%", background:saving||!agreed?"#333":"#e6821e", border:"none", borderRadius:10, color:saving||!agreed?"#555":"#fff", fontFamily:"Syne,sans-serif", fontSize:14, fontWeight:700, padding:"14px", cursor:saving||!agreed?"not-allowed":"pointer" }}>
          {saving?"Submitting...":"Submit listing for review →"}
        </button>
        <div style={{ fontSize:11, color:"#444", textAlign:"center", marginTop:8 }}>Listings reviewed within 24 hours</div>
      </form>
    </div>
  )
}



