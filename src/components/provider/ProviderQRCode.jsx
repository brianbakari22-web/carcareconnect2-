import { useAuth } from "../../contexts/AuthContext"
import QRCodeCard from "../shared/QRCodeCard"
import useIsMobile from "../../lib/useIsMobile"

const PROVIDER_TYPES = {
  garage: "Auto Garage",
  car_wash: "Car Wash",
  panel_beater: "Panel Beater",
  auto_glass: "Auto Glass",
  auto_electrician: "Auto Electrician",
  parts_dealer: "Parts Dealer",
  accessories_shop: "Accessories Shop",
  tyre_shop: "Tyre Shop",
  mobile_mechanic: "Mobile Mechanic",
}

export default function ProviderQRCode() {
  const { profile } = useAuth()
  const isMobile = useIsMobile()
  const providerUrl = `https://carcareconnect.care/provider/${profile?.id}`
  const providerType = PROVIDER_TYPES[profile?.provider_type] || "Service Provider"

  return (
    <div>
      <div style={{ fontFamily:"Syne", fontSize:isMobile?16:20, fontWeight:800, color:"#000", marginBottom:4 }}>My QR Code</div>
      <div style={{ fontSize:12, color:"#777", marginBottom:"1.5rem" }}>Share your unique QR code to get more customers</div>

      <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:"1.5rem" }}>
        <QRCodeCard
          url={providerUrl}
          title={profile?.business_name || profile?.first_name + " " + profile?.last_name}
          subtitle="Your unique CCC provider QR code"
          name={profile?.business_name || profile?.first_name + " " + profile?.last_name}
          providerType={providerType}
          isAdmin={false}
        />

        <div>
          <div style={{ background:"#f8f8f8", borderRadius:12, padding:"1.25rem", marginBottom:"1rem" }}>
            <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, color:"#000", marginBottom:12 }}>💡 Where to use your QR code</div>
            {[
              { icon:"💳", title:"Business cards", desc:"Print on the back of your business card — customers scan to book instantly" },
              { icon:"🪟", title:"Shop window sticker", desc:"A3 or A4 sticker on your shop window — drives walk-in traffic to online bookings" },
              { icon:"🚗", title:"Vehicle wrap/sticker", desc:"Put on your service vehicles so people on the road can find you" },
              { icon:"📄", title:"Flyers & brochures", desc:"Include in any printed marketing material" },
              { icon:"📱", title:"WhatsApp status", desc:"Screenshot the QR and share on your WhatsApp status" },
            ].map(item=>(
              <div key={item.title} style={{ display:"flex", gap:10, alignItems:"flex-start", marginBottom:10 }}>
                <span style={{ fontSize:20, flexShrink:0 }}>{item.icon}</span>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:"#000", marginBottom:2 }}>{item.title}</div>
                  <div style={{ fontSize:11, color:"#666", lineHeight:1.5 }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ background:"#f0fdf4", border:"1px solid #1d9e7530", borderRadius:12, padding:"1.25rem" }}>
            <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, color:"#1d9e75", marginBottom:8 }}>📍 Your storefront link</div>
            <div style={{ fontSize:12, color:"#555", marginBottom:8 }}>Share this link directly on social media or WhatsApp:</div>
            <div style={{ background:"#ffffff", borderRadius:8, padding:"0.75rem", fontSize:12, color:"#378add", wordBreak:"break-all", border:"1px solid #1d9e7530" }}>{providerUrl}</div>
            <button onClick={()=>{ navigator.clipboard.writeText(providerUrl); }}
              style={{ marginTop:10, background:"#1d9e75", border:"none", borderRadius:8, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:12, fontWeight:700, padding:"8px 16px", cursor:"pointer" }}>
              📋 Copy link
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}