import { useNavigate } from "react-router-dom"

export default function PrivacyPolicy() {
  const navigate = useNavigate()

  return (
    <div style={{ minHeight:"100vh", background:"#ffffff", fontFamily:"'DM Sans',sans-serif", color:"#000000" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500&display=swap');`}</style>

      <nav style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"1.25rem 2rem", borderBottom:"1px solid #1a1a1a", position:"sticky", top:0, background:"#ffffff", zIndex:10 }}>
        <div style={{ fontFamily:"Syne", fontSize:16, fontWeight:800, color:"#000000", cursor:"pointer" }} onClick={()=>navigate("/auth")}>
          🚗 Car<span style={{ color:"#e6821e" }}>Care</span> Connect
        </div>
        <button onClick={()=>navigate("/auth")}
          style={{ background:"none", border:"1px solid #dddddd", borderRadius:8, color:"#555555", fontSize:13, padding:"8px 16px", cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>
          ← Back
        </button>
      </nav>

      <div style={{ maxWidth:760, margin:"0 auto", padding:"3rem 2rem 5rem" }}>
        <div style={{ marginBottom:"2.5rem" }}>
          <div style={{ fontSize:12, color:"#e6821e", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:8 }}>Legal</div>
          <div style={{ fontFamily:"Syne", fontSize:"clamp(28px,4vw,40px)", fontWeight:800, color:"#000000", marginBottom:8 }}>Privacy Policy</div>
          <div style={{ fontSize:13, color:"#777777" }}>Last updated: January 1, 2026 · Effective: January 1, 2026</div>
        </div>

        <div style={{ background:"#ffffff", border:"1px solid #e6821e30", borderRadius:12, padding:"1.25rem", marginBottom:"2rem" }}>
          <div style={{ fontSize:13, color:"#555555", lineHeight:1.7 }}>
            Car Care Connect ("we", "us", or "our") is committed to protecting your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our platform. Please read it carefully. By using Car Care Connect, you consent to the practices described in this policy.
          </div>
        </div>

        {[
          {
            title: "1. Information We Collect",
            content: [
              { sub: "1.1 Information you provide directly", text: "When you create an account, we collect your full name, email address, phone number, and password. Service providers additionally provide business name, location, and banking details for payouts. Drivers provide their driver's license, vehicle information, and insurance documents." },
              { sub: "1.2 Information collected automatically", text: "When you use our platform, we automatically collect your device type, browser type, IP address, operating system, pages visited, time spent on pages, and referring URLs. We also collect GPS location data when you use our location-based features or driver tracking." },
              { sub: "1.3 Payment information", text: "Payment transactions are processed through Flutterwave. We do not store your full card details on our servers. We receive transaction IDs, payment status, and partial payment information (last 4 digits) from our payment processor." },
              { sub: "1.4 Communications", text: "We collect messages you send through our chat system between customers, providers, and drivers. We also collect support tickets and correspondence with our team." },
            ]
          },
          {
            title: "2. How We Use Your Information",
            content: [
              { sub: "2.1 Service delivery", text: "We use your information to create and manage your account, process bookings, connect customers with service providers and drivers, process payments and payouts, and send service-related notifications." },
              { sub: "2.2 Platform improvement", text: "We analyze usage patterns to improve our platform, personalize your experience, develop new features, and conduct research and analytics." },
              { sub: "2.3 Communications", text: "We send transactional emails (booking confirmations, receipts, reminders), service notifications, and where permitted, promotional communications. You may opt out of promotional communications at any time." },
              { sub: "2.4 Safety and security", text: "We use your information to verify identities, prevent fraud, investigate disputes, enforce our Terms of Service, and comply with legal obligations." },
            ]
          },
          {
            title: "3. Information Sharing",
            content: [
              { sub: "3.1 With service providers and drivers", text: "When you make a booking, we share your name and contact information with the relevant service provider and/or driver to fulfill the service. Providers and drivers can only see information relevant to their assigned bookings." },
              { sub: "3.2 With payment processors", text: "We share necessary information with Flutterwave to process payments. Flutterwave's privacy policy governs how they handle this information." },
              { sub: "3.3 With service providers (vendors)", text: "We use trusted third-party services including Supabase (database and authentication), Resend (email delivery), and Flutterwave (payments). These parties are contractually bound to protect your information." },
              { sub: "3.4 Legal requirements", text: "We may disclose your information if required by law, court order, or government authority, or if we believe disclosure is necessary to protect our rights, your safety, or the safety of others." },
              { sub: "3.5 No selling of data", text: "We do not sell, rent, or trade your personal information to third parties for their marketing purposes." },
            ]
          },
          {
            title: "4. Data Storage and Security",
            content: [
              { sub: "4.1 Storage location", text: "Your data is stored on Supabase servers. We implement industry-standard security measures including encryption in transit (TLS/SSL), encryption at rest, row-level security policies, and access controls." },
              { sub: "4.2 Retention", text: "We retain your personal data for as long as your account is active or as needed to provide services. You may request deletion of your account and associated data at any time by contacting us." },
              { sub: "4.3 Security measures", text: "We use two-factor authentication for admin access, role-based access control, secure password hashing, and regular security reviews. However, no method of transmission over the internet is 100% secure." },
            ]
          },
          {
            title: "5. Your Rights (Kenya Data Protection Act 2019)",
            content: [
              { sub: "5.1 Right to access", text: "You have the right to request a copy of the personal data we hold about you." },
              { sub: "5.2 Right to rectification", text: "You have the right to correct inaccurate or incomplete personal data." },
              { sub: "5.3 Right to erasure", text: "You have the right to request deletion of your personal data, subject to our legal obligations." },
              { sub: "5.4 Right to data portability", text: "You have the right to receive your data in a structured, machine-readable format." },
              { sub: "5.5 Right to object", text: "You have the right to object to processing of your personal data for marketing purposes." },
              { sub: "5.6 How to exercise your rights", text: "To exercise any of these rights, contact us at carcareconnect254@gmail.com. We will respond within 30 days." },
            ]
          },
          {
            title: "6. Cookies and Tracking",
            content: [
              { sub: "6.1 What we use", text: "We use essential cookies and local storage to maintain your session, remember your language preference and theme settings, and keep you logged in. We do not use advertising or tracking cookies." },
              { sub: "6.2 Your choices", text: "You can clear cookies and local storage through your browser settings. Note that this will log you out and reset your preferences." },
            ]
          },
          {
            title: "7. Children's Privacy",
            content: [
              { sub: "", text: "Car Care Connect is not intended for users under 18 years of age. We do not knowingly collect personal information from minors. If you believe a minor has provided us with personal information, please contact us immediately." },
            ]
          },
          {
            title: "8. Changes to This Policy",
            content: [
              { sub: "", text: "We may update this Privacy Policy from time to time. We will notify you of significant changes by email or through an in-app notification. Your continued use of the platform after changes constitutes acceptance of the updated policy." },
            ]
          },
          {
            title: "9. Contact Us",
            content: [
              { sub: "", text: "For privacy-related questions, concerns, or to exercise your rights, contact us at:" },
            ],
            contact: true
          },
        ].map(section=>(
          <div key={section.title} style={{ marginBottom:"2.5rem" }}>
            <div style={{ fontFamily:"Syne", fontSize:18, fontWeight:800, color:"#000000", marginBottom:"1rem", paddingBottom:"0.5rem", borderBottom:"1px solid #eeeeee" }}>{section.title}</div>
            {section.content.map((item,i)=>(
              <div key={i} style={{ marginBottom:"1rem" }}>
                {item.sub&&<div style={{ fontSize:13, fontWeight:600, color:"#e6821e", marginBottom:4 }}>{item.sub}</div>}
                <div style={{ fontSize:13, color:"#555555", lineHeight:1.8 }}>{item.text}</div>
              </div>
            ))}
            {section.contact&&(
              <div style={{ background:"#ffffff", border:"1px solid #eeeeee", borderRadius:10, padding:"1rem", marginTop:8 }}>
                {[
                  { icon:"🏢", text:"Car Care Connect" },
                  { icon:"📍", text:"Nairobi, Kenya" },
                  { icon:"📧", text:"carcareconnect254@gmail.com" },
                  { icon:"📞", text:"0113858966" },
                ].map(c=>(
                  <div key={c.text} style={{ display:"flex", gap:10, alignItems:"center", marginBottom:8, fontSize:13, color:"#555555" }}>
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




