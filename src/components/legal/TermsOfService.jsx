import { useNavigate } from "react-router-dom"

export default function TermsOfService() {
  const navigate = useNavigate()

  return (
    <div style={{ minHeight:"100vh", background:"#0a0a0a", fontFamily:"'DM Sans',sans-serif", color:"#f0ede6" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500&display=swap');`}</style>

      <nav style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"1.25rem 2rem", borderBottom:"1px solid #1a1a1a", position:"sticky", top:0, background:"#0a0a0a", zIndex:10 }}>
        <div style={{ fontFamily:"Syne", fontSize:16, fontWeight:800, color:"#f0ede6", cursor:"pointer" }} onClick={()=>navigate("/auth")}>
          🚗 Car<span style={{ color:"#e6821e" }}>Care</span> Connect
        </div>
        <button onClick={()=>navigate("/auth")}
          style={{ background:"none", border:"1px solid #333", borderRadius:8, color:"#888", fontSize:13, padding:"8px 16px", cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>
          ← Back
        </button>
      </nav>

      <div style={{ maxWidth:760, margin:"0 auto", padding:"3rem 2rem 5rem" }}>
        <div style={{ marginBottom:"2.5rem" }}>
          <div style={{ fontSize:12, color:"#e6821e", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:8 }}>Legal</div>
          <div style={{ fontFamily:"Syne", fontSize:"clamp(28px,4vw,40px)", fontWeight:800, color:"#f0ede6", marginBottom:8 }}>Terms of Service</div>
          <div style={{ fontSize:13, color:"#555" }}>Last updated: January 1, 2026 · Effective: January 1, 2026</div>
        </div>

        <div style={{ background:"#111", border:"1px solid #e6821e30", borderRadius:12, padding:"1.25rem", marginBottom:"2rem" }}>
          <div style={{ fontSize:13, color:"#888", lineHeight:1.7 }}>
            Welcome to Car Care Connect. By accessing or using our platform, you agree to be bound by these Terms of Service. Please read them carefully before using the platform. If you do not agree to these terms, you may not use Car Care Connect.
          </div>
        </div>

        {[
          {
            title: "1. Acceptance of Terms",
            items: [
              "By creating an account or using Car Care Connect, you confirm that you are at least 18 years old, have the legal capacity to enter into this agreement, and agree to these Terms of Service and our Privacy Policy.",
              "We reserve the right to update these terms at any time. Continued use of the platform after changes constitutes acceptance of the updated terms.",
            ]
          },
          {
            title: "2. Description of Service",
            items: [
              "Car Care Connect is a digital marketplace connecting vehicle owners (customers) with automotive service providers and concierge drivers in Nairobi, Kenya.",
              "We provide the platform and technology infrastructure but are not directly responsible for the quality of services provided by independent service providers and drivers.",
              "We reserve the right to modify, suspend, or discontinue any part of the service at any time with reasonable notice.",
            ]
          },
          {
            title: "3. User Accounts",
            items: [
              "You must provide accurate, complete, and current information when creating your account. You are responsible for maintaining the confidentiality of your login credentials.",
              "You are responsible for all activities that occur under your account. You must notify us immediately of any unauthorized use.",
              "We reserve the right to suspend or terminate accounts that violate these terms, engage in fraudulent activity, or pose a risk to other users.",
              "You may only create one account per person. Creating multiple accounts to circumvent bans or restrictions is prohibited.",
            ]
          },
          {
            title: "4. Customer Terms",
            items: [
              "Customers may browse services, book appointments, make payments, and leave reviews for completed services.",
              "Bookings are confirmed upon acceptance by the service provider. Car Care Connect does not guarantee availability.",
              "Cancellations made less than 24 hours before a scheduled appointment may be subject to cancellation fees at the provider's discretion.",
              "Customers must provide accurate vehicle information and be present or available at the time of service.",
              "Reviews must be honest and based on actual service experiences. False or defamatory reviews are prohibited.",
            ]
          },
          {
            title: "5. Service Provider Terms",
            items: [
              "Service providers must be legally registered businesses or sole traders operating in Kenya.",
              "Providers must maintain all required licenses, permits, and insurance for their services.",
              "Providers are responsible for the quality and safety of services they offer. Car Care Connect is not liable for service quality.",
              "Providers must honor confirmed bookings. Repeated cancellations may result in account suspension.",
              "Car Care Connect charges a 15% platform commission on all completed transactions. Providers receive 70% of the booking value.",
              "Payouts are processed within 3-5 business days of a completed booking upon request.",
              "Providers must not solicit customers to transact outside the platform to avoid commission fees.",
            ]
          },
          {
            title: "6. Driver Terms",
            items: [
              "Drivers must hold a valid Kenyan driver's license and have a clean driving record.",
              "Drivers must maintain valid vehicle insurance and registration at all times.",
              "Drivers receive 15% of the booking value for concierge delivery services.",
              "Drivers must maintain professional conduct and treat vehicles in their care with the utmost care.",
              "Drivers are independent contractors, not employees of Car Care Connect.",
              "Drivers must not transport vehicles for purposes other than the assigned booking.",
            ]
          },
          {
            title: "7. Payments and Refunds",
            items: [
              "Payments are processed securely through Flutterwave. Accepted methods include M-Pesa, Visa, and Mastercard.",
              "Cash payments are also accepted and must be recorded in the platform by the service provider.",
              "Refund requests must be submitted within 7 days of service completion.",
              "Refunds are reviewed within 5 business days. Approved refunds are processed within 7 business days.",
              "Car Care Connect reserves the right to withhold payouts in cases of disputed transactions or suspected fraud.",
              "Loyalty points have no cash value and cannot be transferred between accounts.",
            ]
          },
          {
            title: "8. Prohibited Conduct",
            items: [
              "Using the platform for any unlawful purpose or in violation of any local, national, or international law.",
              "Harassing, threatening, or abusing other users, providers, or drivers.",
              "Posting false, misleading, or defamatory reviews or content.",
              "Attempting to circumvent the platform's commission structure by transacting directly with providers or customers met through the platform.",
              "Creating fake accounts, impersonating others, or providing false information.",
              "Interfering with or disrupting the platform's infrastructure or security.",
              "Scraping, copying, or reproducing platform content without permission.",
            ]
          },
          {
            title: "9. Limitation of Liability",
            items: [
              "Car Care Connect is a marketplace platform and is not liable for the quality, safety, or legality of services provided by third-party service providers and drivers.",
              "We are not liable for any indirect, incidental, special, or consequential damages arising from your use of the platform.",
              "Our total liability to you for any claims arising from these terms shall not exceed the amount you paid to Car Care Connect in the 3 months preceding the claim.",
              "We do not guarantee uninterrupted or error-free operation of the platform.",
            ]
          },
          {
            title: "10. Intellectual Property",
            items: [
              "The Car Care Connect name, logo, and platform design are our intellectual property. You may not use them without our written permission.",
              "User-generated content (reviews, photos) remains your property, but you grant us a license to display it on the platform.",
              "You may not copy, reproduce, or distribute platform content without permission.",
            ]
          },
          {
            title: "11. Governing Law and Disputes",
            items: [
              "These Terms of Service are governed by the laws of Kenya.",
              "Any disputes shall first be attempted to be resolved through good-faith negotiation.",
              "If negotiation fails, disputes shall be resolved through arbitration in Nairobi, Kenya in accordance with the Arbitration Act of Kenya.",
              "Nothing in these terms prevents either party from seeking emergency injunctive relief from a court.",
            ]
          },
          {
            title: "12. Termination",
            items: [
              "You may terminate your account at any time by contacting us at carcareconnect254@gmail.com.",
              "We may terminate or suspend your account immediately for violations of these terms.",
              "Upon termination, your right to use the platform ceases immediately. Outstanding bookings and payments will be handled per our refund policy.",
            ]
          },
          {
            title: "13. Contact Information",
            items: [],
            contact: true
          },
        ].map(section=>(
          <div key={section.title} style={{ marginBottom:"2.5rem" }}>
            <div style={{ fontFamily:"Syne", fontSize:18, fontWeight:800, color:"#f0ede6", marginBottom:"1rem", paddingBottom:"0.5rem", borderBottom:"1px solid #1e1e1e" }}>{section.title}</div>
            {section.items.map((item,i)=>(
              <div key={i} style={{ display:"flex", gap:12, marginBottom:10 }}>
                <div style={{ width:6, height:6, borderRadius:"50%", background:"#e6821e", flexShrink:0, marginTop:7 }}/>
                <div style={{ fontSize:13, color:"#888", lineHeight:1.8 }}>{item}</div>
              </div>
            ))}
            {section.contact&&(
              <div style={{ background:"#111", border:"1px solid #1e1e1e", borderRadius:10, padding:"1rem" }}>
                {[
                  { icon:"🏢", text:"Car Care Connect" },
                  { icon:"📍", text:"Nairobi, Kenya" },
                  { icon:"📧", text:"carcareconnect254@gmail.com" },
                  { icon:"📞", text:"0113858966" },
                ].map(c=>(
                  <div key={c.text} style={{ display:"flex", gap:10, alignItems:"center", marginBottom:8, fontSize:13, color:"#888" }}>
                    <span>{c.icon}</span><span>{c.text}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <footer style={{ borderTop:"1px solid #1a1a1a", padding:"1.5rem 2rem", textAlign:"center" }}>
        <div style={{ fontSize:11, color:"#333" }}>© 2026 Car Care Connect · All rights reserved</div>
      </footer>
    </div>
  )
}
