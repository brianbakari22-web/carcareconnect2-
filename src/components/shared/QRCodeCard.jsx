import { useEffect, useRef, useState } from "react"
import QRCode from "qrcode"
import toast from "react-hot-toast"

export default function QRCodeCard({ url, title, subtitle, name, providerType, isAdmin }) {
  const canvasRef = useRef(null)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    if (!canvasRef.current) return
    QRCode.toCanvas(canvasRef.current, url, {
      width: 200,
      margin: 2,
      color: {
        dark: "#1a1a1a",
        light: "#ffffff"
      },
      errorCorrectionLevel: "H"
    })
  }, [url])

  async function downloadQR() {
    setDownloading(true)
    try {
      // Create a high-res canvas for printing
      const canvas = document.createElement("canvas")
      canvas.width = 1200
      canvas.height = 800
      const ctx = canvas.getContext("2d")

      // Background
      ctx.fillStyle = "#ffffff"
      ctx.fillRect(0, 0, 1200, 800)

      // Orange sidebar
      ctx.fillStyle = "#E6821E"
      ctx.fillRect(0, 0, 40, 800)

      // CCC branding
      ctx.fillStyle = "#1a1a1a"
      ctx.font = "bold 52px Arial"
      ctx.fillText("Car", 80, 100)
      ctx.fillStyle = "#E6821E"
      ctx.fillText("Care", 80 + ctx.measureText("Car").width + 10, 100)
      ctx.fillStyle = "#1a1a1a"
      ctx.fillText(" Connect", 80 + ctx.measureText("Car").width + ctx.measureText("Care").width + 20, 100)

      // Title
      ctx.fillStyle = "#1a1a1a"
      ctx.font = "bold 36px Arial"
      ctx.fillText(title || "Automotive Services", 80, 160)

      // Subtitle / name
      if (name) {
        ctx.fillStyle = "#555555"
        ctx.font = "28px Arial"
        ctx.fillText(name, 80, 210)
      }

      if (providerType) {
        ctx.fillStyle = "#E6821E"
        ctx.font = "22px Arial"
        ctx.fillText(providerType.replace(/_/g," ").replace(/\b\w/g,l=>l.toUpperCase()), 80, 250)
      }

      // Divider
      ctx.fillStyle = "#E6821E"
      ctx.fillRect(80, 280, 400, 3)

      // URL text
      ctx.fillStyle = "#555555"
      ctx.font = "20px Arial"
      ctx.fillText(url, 80, 320)

      // Tagline
      ctx.fillStyle = "#888888"
      ctx.font = "18px Arial"
      ctx.fillText("Scan to book automotive services in Nairobi", 80, 360)

      // Website
      ctx.fillStyle = "#1a1a1a"
      ctx.font = "bold 20px Arial"
      ctx.fillText("carcareconnect.care", 80, 720)

      ctx.fillStyle = "#888888"
      ctx.font = "16px Arial"
      ctx.fillText("📞 0113858966  ✉️ carcareconnect254@gmail.com", 80, 760)

      // QR Code (high res)
      const qrCanvas = document.createElement("canvas")
      await QRCode.toCanvas(qrCanvas, url, {
        width: 500,
        margin: 2,
        color: { dark: "#1a1a1a", light: "#ffffff" },
        errorCorrectionLevel: "H"
      })
      ctx.drawImage(qrCanvas, 650, 150, 480, 480)

      // QR label
      ctx.fillStyle = "#888888"
      ctx.font = "18px Arial"
      ctx.textAlign = "center"
      ctx.fillText("Scan to visit", 890, 670)

      // Download
      const link = document.createElement("a")
      link.download = (isAdmin ? "CCC-Platform-QR" : "CCC-Provider-QR") + ".png"
      link.href = canvas.toDataURL("image/png")
      link.click()
      toast.success("QR code downloaded!")
    } catch(e) {
      toast.error("Download failed")
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:16, padding:"1.5rem", maxWidth:400 }}>
      <div style={{ fontFamily:"Syne", fontSize:16, fontWeight:800, color:"#000", marginBottom:4 }}>{title}</div>
      {subtitle&&<div style={{ fontSize:12, color:"#888", marginBottom:"1.25rem" }}>{subtitle}</div>}

      {/* QR Preview */}
      <div style={{ display:"flex", justifyContent:"center", marginBottom:"1.25rem" }}>
        <div style={{ background:"#ffffff", border:"2px solid #e6821e", borderRadius:12, padding:12, display:"inline-block" }}>
          <canvas ref={canvasRef} style={{ display:"block" }}/>
        </div>
      </div>

      {/* URL */}
      <div style={{ background:"#f8f8f8", borderRadius:8, padding:"0.75rem", marginBottom:"1.25rem", wordBreak:"break-all" }}>
        <div style={{ fontSize:10, color:"#888", marginBottom:4 }}>QR code links to:</div>
        <div style={{ fontSize:12, color:"#378add", fontWeight:600 }}>{url}</div>
      </div>

      {/* Info */}
      <div style={{ background:"#fff8f0", border:"1px solid #e6821e30", borderRadius:8, padding:"0.75rem", marginBottom:"1.25rem" }}>
        <div style={{ fontSize:11, color:"#e6821e", fontWeight:600, marginBottom:4 }}>📱 How to use</div>
        <div style={{ fontSize:11, color:"#555", lineHeight:1.6 }}>Print this QR code on your business cards, flyers, shop window stickers, or vehicle wraps. Customers scan it with their phone camera to book instantly.</div>
      </div>

      <button onClick={downloadQR} disabled={downloading}
        style={{ width:"100%", background:downloading?"#ccc":"#e6821e", border:"none", borderRadius:10, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:14, fontWeight:700, padding:"13px", cursor:downloading?"not-allowed":"pointer" }}>
        {downloading?"Generating...":"⬇ Download for Print"}
      </button>
      <div style={{ fontSize:10, color:"#888", textAlign:"center", marginTop:8 }}>High-resolution PNG ready for professional printing</div>
    </div>
  )
}