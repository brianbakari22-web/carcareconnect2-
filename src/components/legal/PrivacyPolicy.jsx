import { useNavigate } from "react-router-dom"
export default function PrivacyPolicy() {
  const navigate = useNavigate()
  const Section = ({ title, children }) => (
    <div style={{ marginBottom:"2.5rem" }}>
      <div style={{ fontFamily:"Syne", fontSize:20, fontWeight:800, color:"#000", marginBottom:"1rem", paddingBottom:"0.5rem", borderBottom:"2px solid #e6821e20" }}>{title}</div>
      <div style={{ fontSize:14, color:"#444", lineHeight:1.9 }}>{children}</div>
    </div>
  )
  const Li = ({ children }) => (
    <div style={{ display:"flex", gap:10, marginBottom:6 }}>
      <span style={{ color:"#e6821e", flexShrink:0 }}>•</span>
      <span>{children}</span>
    </div>
  )
  return (
    <div style={{ minHeight:"100vh", background:"#ffffff", fontFamily:"DM Sans,sans-serif", color:"#000000" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500&display=swap');`}</style>
      <nav style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"1.25rem 2rem", borderBottom:"1px solid #eeeeee", position:"sticky", top:0, background:"#ffffff", zIndex:10 }}>
        <div style={{ fontFamily:"Syne", fontSize:16, fontWeight:800, color:"#000000", cursor:"pointer" }} onClick={()=>navigate("/")}>Car<span style={{ color:"#e6821e" }}>Care</span> Connect</div>
        <button onClick={()=>navigate(-1)} style={{ background:"none", border:"1px solid #ddd", borderRadius:8, color:"#555", fontSize:13, padding:"8px 16px", cursor:"pointer" }}>Back</button>
      </nav>
      <div style={{ maxWidth:760, margin:"0 auto", padding:"3rem 2rem 5rem" }}>
        <div style={{ marginBottom:"2.5rem" }}>
          <div style={{ fontSize:12, color:"#e6821e", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:8 }}>Legal</div>
          <div style={{ fontFamily:"Syne", fontSize:"clamp(28px,4vw,40px)", fontWeight:800, color:"#000", marginBottom:8 }}>Privacy Policy</div>
          <div style={{ fontSize:13, color:"#777" }}>Last updated: June 25, 2026 - Effective: June 25, 2026</div>
        </div>
        <div style={{ background:"#fff8f0", border:"1px solid #e6821e30", borderRadius:12, padding:"1.25rem", marginBottom:"2rem" }}>
          <div style={{ fontSize:14, color:"#555", lineHeight:1.8 }}>Car Care Connect (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) is committed to protecting your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our platform at carcareconnect.care. By using Car Care Connect, you consent to the practices described in this policy.</div>
        </div>
        <Section title="1. Who We Are">
          <div>Car Care Connect is an automotive services marketplace based in Nairobi, Kenya. We connect car owners with verified mechanics, parts dealers, car wash providers and concierge drivers.</div>
          <div style={{ marginTop:12 }}>
            <Li>Platform: carcareconnect.care</Li>
            <Li>Contact: carcareconnect254@gmail.com</Li>
            <Li>Phone: 0113858966</Li>
            <Li>Location: Nairobi, Kenya</Li>
          </div>
        </Section>
        <Section title="2. Information We Collect">
          <div><strong>Account Information:</strong></div>
          <div style={{ marginTop:8, marginBottom:12 }}>
            <Li>Full name, email address, phone number</Li>
            <Li>Profile photo (optional)</Li>
            <Li>Role: Customer, Service Provider, or Driver</Li>
            <Li>Business name and type (for providers)</Li>
            <Li>Vehicle type and driver documents (for drivers)</Li>
          </div>
          <div><strong>Location Data:</strong></div>
          <div style={{ marginTop:8, marginBottom:12 }}>
            <Li>Precise GPS location when using GO Service emergency feature</Li>
            <Li>Approximate location for finding nearby providers</Li>
            <Li>Driver location during active deliveries</Li>
            <Li>Mechanic location during GO Service jobs</Li>
          </div>
          <div><strong>Transaction Data:</strong></div>
          <div style={{ marginTop:8, marginBottom:12 }}>
            <Li>Booking details, service history, payment amounts</Li>
            <Li>Payment method type (M-Pesa, card) - we do not store card numbers</Li>
            <Li>Commission and earnings records for providers and drivers</Li>
          </div>
          <div><strong>Financial &amp; Tax Information (Providers and Drivers only):</strong></div>
          <div style={{ marginTop:8, marginBottom:12 }}>
            <Li>Bank name, account holder name, and account number (for payout processing)</Li>
            <Li>M-Pesa number (for mobile money payouts)</Li>
            <Li>National ID number (for identity verification and KRA compliance)</Li>
            <Li>KRA PIN (required for payments above KES 24,999 per Kenya Revenue Authority regulations)</Li>
          </div>
          <div><strong>Usage Data:</strong></div>
          <div style={{ marginTop:8, marginBottom:12 }}>
            <Li>Pages visited, features used, search queries</Li>
            <Li>Device type, browser type, IP address</Li>
            <Li>Crash reports and performance data</Li>
          </div>
          <div><strong>User Content:</strong></div>
          <div style={{ marginTop:8 }}>
            <Li>Reviews and ratings you submit</Li>
            <Li>Before and after photos uploaded by providers</Li>
            <Li>Vehicle condition reports</Li>
            <Li>Chat messages between users (contact sharing is blocked)</Li>
          </div>
        </Section>
        <Section title="3. How We Use Your Information">
          <Li>To create and manage your account</Li>
          <Li>To connect customers with service providers</Li>
          <Li>To process bookings and payments via Pesapal</Li>
          <Li>To enable live GPS tracking of drivers and mechanics</Li>
          <Li>To dispatch mechanics for GO Service emergency requests</Li>
          <Li>To calculate and process earnings and payouts</Li>
          <Li>To send booking confirmations and service notifications</Li>
          <Li>To manage loyalty points and rewards</Li>
          <Li>To investigate service guarantee claims</Li>
          <Li>To improve the platform and fix bugs</Li>
          <Li>To comply with Kenyan law and regulations</Li>
          <Li>To prevent fraud and abuse</Li>
        </Section>
        <Section title="4. How We Share Your Information">
          <div><strong>With Service Providers:</strong> When you book a service, your name and vehicle details are shared with the relevant provider.</div>
          <div style={{ marginTop:10 }}><strong>With Drivers:</strong> Your pickup/delivery address is shared with the assigned driver.</div>
          <div style={{ marginTop:10 }}><strong>With Pesapal:</strong> Payment data is processed by Pesapal, regulated by the Central Bank of Kenya. We do not store your card details.</div>
          <div style={{ marginTop:10 }}><strong>With Supabase:</strong> Our database and authentication provider stores your account data securely.</div>
          <div style={{ marginTop:12 }}><strong>We do NOT:</strong></div>
          <div style={{ marginTop:8 }}>
            <Li>Sell your personal data to third parties</Li>
            <Li>Share your data with advertisers</Li>
            <Li>Allow providers or drivers to see your full contact details without your consent</Li>
            <Li>Share your data outside Kenya except with our cloud service providers</Li>
          </div>
        </Section>
        <Section title="5. Location Data">
          <div>We collect location data for the following purposes:</div>
          <div style={{ marginTop:8 }}>
            <Li>Finding service providers near you</Li>
            <Li>Dispatching mechanics to your GPS location during GO Service emergencies</Li>
            <Li>Tracking driver and mechanic location during active bookings</Li>
            <Li>Recording location history for safety and dispute resolution</Li>
          </div>
          <div style={{ marginTop:12 }}>Location tracking is only active when you are using the app. You can disable location access in your device settings, but this will limit GO Service and tracking features.</div>
        </Section>
        <Section title="6. Data Security">
          <Li>All data is transmitted over encrypted HTTPS connections</Li>
          <Li>Passwords are hashed and never stored in plain text</Li>
          <Li>Database access is protected by Row Level Security (RLS)</Li>
          <Li>Payment processing is handled by Pesapal (PCI DSS compliant)</Li>
          <Li>We conduct regular security reviews</Li>
          <Li>Access to user data is restricted to authorised staff only</Li>
        </Section>
        <Section title="6b. Financial &amp; Tax Data">
          <div>For service providers and drivers, we collect financial and tax information for the following purposes:</div>
          <div style={{ marginTop:8 }}>
            <Li>Processing earnings payouts to your bank account or M-Pesa</Li>
            <Li>Complying with Kenya Revenue Authority (KRA) withholding tax requirements</Li>
            <Li>Verifying your identity before releasing payments</Li>
            <Li>Maintaining accurate financial records as required by Kenyan law</Li>
          </div>
          <div style={{ marginTop:12, background:"#f0fdf4", border:"1px solid #1d9e7530", borderRadius:10, padding:"1rem" }}>
            <div style={{ fontSize:13, fontWeight:600, color:"#1d9e75", marginBottom:6 }}>🔒 How we protect your financial data</div>
            <Li>Bank details and ID information are stored in an encrypted, access-restricted database</Li>
            <Li>Only authorised CCC administrators can view your financial details for payout processing</Li>
            <Li>We never share your bank details, National ID or KRA PIN with third parties</Li>
            <Li>Financial data is retained for 7 years as required by Kenyan tax law</Li>
          </div>
        </Section>
        <Section title="7. Data Retention">
          <Li>Account data is retained for as long as your account is active</Li>
          <Li>Booking and transaction records are retained for 7 years for legal and tax purposes</Li>
          <Li>Location history is retained for 90 days then automatically deleted</Li>
          <Li>Chat messages are retained for 12 months</Li>
          <Li>After account deletion, anonymised data may be retained for analytics</Li>
        </Section>
        <Section title="8. Your Rights">
          <div>You have the right to:</div>
          <div style={{ marginTop:8 }}>
            <Li>Access the personal data we hold about you</Li>
            <Li>Correct inaccurate personal data</Li>
            <Li>Request deletion of your account and personal data</Li>
            <Li>Object to processing of your personal data</Li>
            <Li>Export your data in a portable format</Li>
            <Li>Withdraw consent at any time</Li>
          </div>
          <div style={{ marginTop:12 }}>To exercise any of these rights, contact us at carcareconnect254@gmail.com.</div>
        </Section>
        <Section title="9. Account Deletion">
          <div style={{ background:"#fff8f0", border:"1px solid #e6821e30", borderRadius:10, padding:"1rem", marginBottom:12 }}>
            <strong>How to delete your account and data:</strong>
          </div>
          <div style={{ marginBottom:8 }}>You can request deletion of your account and all associated personal data by:</div>
          <Li>Emailing carcareconnect254@gmail.com with subject "Delete My Account"</Li>
          <Li>Including your registered email address in the request</Li>
          <Li>We will process your request within 30 days</Li>
          <div style={{ marginTop:12 }}><strong>What gets deleted:</strong></div>
          <div style={{ marginTop:8 }}>
            <Li>Your profile and account credentials</Li>
            <Li>Your vehicles, bookings history and reviews</Li>
            <Li>Your chat messages and notifications</Li>
            <Li>Your loyalty points and referral data</Li>
          </div>
          <div style={{ marginTop:12 }}><strong>What may be retained:</strong></div>
          <div style={{ marginTop:8 }}>
            <Li>Transaction records required by Kenyan tax law (7 years)</Li>
            <Li>Anonymised analytics data with no personal identifiers</Li>
          </div>
        </Section>
        <Section title="10. Cookies and Tracking">
          <Li>We use essential cookies to keep you logged in</Li>
          <Li>We use analytics to understand how the platform is used</Li>
          <Li>We do not use advertising cookies or tracking pixels</Li>
          <Li>You can clear cookies in your browser settings at any time</Li>
        </Section>
        <Section title="11. Children Privacy">
          Car Care Connect is not intended for users under 18 years of age. We do not knowingly collect personal data from children. If you believe a child has provided us with personal data, please contact us immediately at carcareconnect254@gmail.com.
        </Section>
        <Section title="12. Third Party Services">
          <div>Our platform integrates with:</div>
          <div style={{ marginTop:8 }}>
            <Li>Supabase - database and authentication</Li>
            <Li>Pesapal - payment processing, regulated by Central Bank of Kenya</Li>
            <Li>Cloudflare - hosting and CDN</Li>
            <Li>Leaflet - mapping and location services</Li>
            <Li>Anthropic Claude - AI assistant feature</Li>
            <Li>OneSignal - push notification delivery</Li>
          </div>
        </Section>
        <Section title="13. Changes to This Policy">
          <div>We may update this Privacy Policy from time to time. We will notify you of any significant changes by:</div>
          <div style={{ marginTop:8 }}>
            <Li>Posting the updated policy on this page with a new effective date</Li>
            <Li>Sending a notification to your registered email address</Li>
          </div>
          <div style={{ marginTop:12 }}>Continued use of the platform after changes constitutes acceptance of the updated policy.</div>
        </Section>
        <Section title="14. Contact Us">
          <div>If you have any questions about this Privacy Policy or how we handle your data:</div>
          <div style={{ marginTop:12, background:"#f8f8f8", borderRadius:10, padding:"1rem" }}>
            <Li>Email: carcareconnect254@gmail.com</Li>
            <Li>Phone: 0113858966</Li>
            <Li>Location: Nairobi, Kenya</Li>
            <Li>Website: carcareconnect.care</Li>
          </div>
          <div style={{ marginTop:12 }}>We aim to respond to all privacy enquiries within 5 business days.</div>
        </Section>
        <div style={{ borderTop:"1px solid #eeeeee", paddingTop:"2rem", marginTop:"2rem", fontSize:13, color:"#999", textAlign:"center" }}>
          2026 Car Care Connect - Nairobi, Kenya - All rights reserved
        </div>
      </div>
    </div>
  )
}
