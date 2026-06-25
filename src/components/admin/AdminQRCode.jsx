import QRCodeCard from "../shared/QRCodeCard"
import useIsMobile from "../../lib/useIsMobile"

export default function AdminQRCode() {
  const isMobile = useIsMobile()
  const platformUrl = "https://carcareconnect.care"

  return (
    <div>
      <div style={{ fontFamily:"Syne", fontSize:isMobile?16:20, fontWeight:800, color:"#000", marginBottom:4 }}>Platform QR Code</div>
      <div style={{ fontSize:12, color:"#777", marginBottom:"1.5rem" }}>CCC platform QR code for marketing and business cards</div>

      <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:"1.5rem" }}>
        <QRCodeCard
          url={platformUrl}
          title="Car Care Connect"
          subtitle="Official CCC platform QR code"
          name="Nairobi's #1 Auto Services Platform"
          isAdmin={true}
        />

        <div>
          <div style={{ background:"#f8f8f8", borderRadius:12, padding:"1.25rem", marginBottom:"1rem" }}>
            <div style={{ fontFamily:"Syne", fontSize:14, fontWeight:700, color:"#000", marginBottom:12 }}>🖨️ Print specifications</div>
            {[
              { label:"Business card", size:"3.5 × 2 inches", qrSize:"0.8 × 0.8 inches", tip:"Place QR on back" },
              { label:"Flyer (A5)", size:"5.8 × 8.3 inches", qrSize:"1.5 × 1.5 inches", tip:"Bottom right corner" },
              { label:"Shop sticker (A4)", size:"8.3 × 11.7 inches", qrSize:"3 × 3 inches", tip:"Center placement" },
              { label:"Banner", size:"2 × 4 feet", qrSize:"6 × 6 inches", tip:"Bottom corner" },
            ].map(item=>(
              <div key={item.label} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:"1px solid #eeeeee" }}>
                <div>
                  <div style={{ fontSize:12, fontWeight:600, color:"#000" }}>{item.label}</div>
                  <div style={{ fontSize:10, color:"#888" }}>{item.size} · QR: {item.qrSize}</div>
                </div>
                <div style={{ fontSize:10, color:"#e6821e", background:"#fff8f0", padding:"2px 8px", borderRadius:6 }}>{item.tip}</div>
              </div>
            ))}
          </div>

          <div style={{ background:"#fff8f0", border:"1px solid #e6821e30", borderRadius:12, padding:"1.25rem" }}>
            <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:700, color:"#e6821e", marginBottom:8 }}>📞 Platform contact info</div>
            {[
              { label:"Website", value:"carcareconnect.care" },
              { label:"Email", value:"carcareconnect254@gmail.com" },
              { label:"Phone", value:"0113858966" },
              { label:"Location", value:"Nairobi, Kenya" },
            ].map(item=>(
              <div key={item.label} style={{ display:"flex", justifyContent:"space-between", fontSize:12, padding:"4px 0" }}>
                <span style={{ color:"#888" }}>{item.label}</span>
                <span style={{ color:"#000", fontWeight:600 }}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}