import { useNavigate } from "react-router-dom"
export default function TermsOfService() {
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
  const Sub = ({ title, children }) => (
    <div style={{ marginTop:12, marginBottom:8 }}>
      <div style={{ fontSize:13, fontWeight:700, color:"#000", marginBottom:6 }}>{title}</div>
      {children}
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
          <div style={{ fontFamily:"Syne", fontSize:"clamp(28px,4vw,40px)", fontWeight:800, color:"#000", marginBottom:8 }}>Terms of Service</div>
          <div style={{ fontSize:13, color:"#777" }}>Last updated: June 25, 2026 · Effective: June 25, 2026</div>
        </div>
        <div style={{ background:"#fff8f0", border:"1px solid #e6821e30", borderRadius:12, padding:"1.25rem", marginBottom:"2rem" }}>
          <div style={{ fontSize:14, color:"#555", lineHeight:1.8 }}>Welcome to Car Care Connect. By accessing or using our platform at carcareconnect.care, you agree to be bound by these Terms of Service and our Privacy Policy. Please read them carefully. If you do not agree, you may not use Car Care Connect.</div>
        </div>

        <Section title="1. Acceptance of Terms">
          <div>By creating an account or using Car Care Connect, you confirm that you:</div>
          <div style={{ marginTop:8 }}>
            <Li>Are at least 18 years old and have legal capacity to enter this agreement</Li>
            <Li>Agree to these Terms of Service and our Privacy Policy</Li>
            <Li>Will provide accurate and complete information when registering</Li>
            <Li>Are responsible for maintaining the confidentiality of your account credentials</Li>
          </div>
          <div style={{ marginTop:12 }}>We reserve the right to update these terms at any time. Continued use of the platform after changes constitutes acceptance of the updated terms. Significant changes will be communicated via email.</div>
        </Section>

        <Section title="2. Description of Service">
          <div>Car Care Connect is a digital marketplace connecting vehicle owners with verified automotive service providers, mechanics, parts dealers, and concierge drivers in Nairobi, Kenya.</div>
          <div style={{ marginTop:12 }}>We provide the platform and technology infrastructure but are not directly responsible for the quality of services provided by independent service providers, mechanics, and drivers. Car Care Connect is a marketplace facilitator, not a direct service provider.</div>
          <div style={{ marginTop:12 }}>We reserve the right to modify, suspend, or discontinue any part of the service at any time with reasonable notice.</div>
        </Section>

        <Section title="3. Service Categories">
          <Sub title="Shop Standard">Customer brings their vehicle to the provider&apos;s shop. Platform commission: 10%. Provider receives: 90% of the service fee.</Sub>
          <Sub title="Shop Premium">Provider&apos;s mechanic travels to the customer&apos;s location. Platform commission: 20%. Provider receives: 80% of the service fee.</Sub>
          <Sub title="GO Service (Emergency Roadside)">Provider dispatches a mechanic to the customer&apos;s breakdown location. Platform commission: 15%. Provider receives: 85% of the service fee. A non-refundable KES 500 callout fee is charged upfront (KES 425 to mechanic, KES 75 to platform).</Sub>
          <Sub title="Concierge Driver Services">A platform driver picks up and delivers the customer&apos;s vehicle to a service provider. Earnings split: 15% platform, 70% provider, 15% driver.</Sub>
          <Sub title="Parts and Materials">When providers supply parts as part of a booking, a 10% platform commission applies to the parts cost. Providers receive 90% of the parts value. Parts must be approved by the customer before being charged.</Sub>
          <div style={{ marginTop:12, background:"#f8f8f8", borderRadius:8, padding:"0.75rem", fontSize:13, color:"#666" }}>Commission rates are configurable by platform administrators and are subject to change with 30 days notice to registered providers.</div>
        </Section>

        <Section title="4. GO Service (Emergency Roadside) Terms">
          <Li>GO Service is available only through online payment (M-Pesa or card). Cash payments are not accepted for emergency services.</Li>
          <Li>A non-refundable KES 500 callout fee is required before dispatch.</Li>
          <Li>When a GO Service request is submitted, it is sent to available providers in sequence. Each provider has 10 minutes to accept.</Li>
          <Li>If a provider does not respond within 10 minutes, the request is automatically forwarded to the next available provider.</Li>
          <Li>After 6 unsuccessful dispatch attempts, the customer is notified that no providers are currently available and the callout fee is refunded.</Li>
          <Li>Providers who are offline will not receive GO Service requests.</Li>
          <Li>Providers who accept GO Service requests must dispatch a mechanic immediately. Accepting without capability to dispatch may result in account suspension.</Li>
          <Li>Car Care Connect is not a substitute for emergency services. In life-threatening situations, contact Police (999) or Ambulance (0800 722 203) immediately.</Li>
        </Section>

        <Section title="5. Vehicle Condition Reports">
          <div>For all concierge, Shop Premium, and GO Service bookings where a driver or mechanic takes custody of a customer&apos;s vehicle:</div>
          <div style={{ marginTop:8 }}>
            <Li>A pickup condition report must be completed before taking the vehicle</Li>
            <Li>A dropoff condition report must be completed before returning the vehicle</Li>
            <Li>Reports must include odometer reading, fuel level, and any pre-existing damage</Li>
            <Li>Up to 6 photos may be uploaded per report to document vehicle condition</Li>
          </div>
          <div style={{ marginTop:12 }}>If the odometer difference between pickup and dropoff exceeds 30km (or a customer-defined threshold), an automatic mileage alert is sent to the customer and platform administrators.</div>
          <div style={{ marginTop:12 }}>Customers have 24 hours after service completion to raise a vehicle condition dispute. Disputes are reviewed by platform administrators within 5 business days. Filing false condition reports may result in immediate account termination and legal action.</div>
        </Section>

        <Section title="6. Marketplace — Buying and Selling">
          <Sub title="Listing Approval">
            <Li>All vehicle and parts listings require a CCC inspection before going live</Li>
            <Li>A non-refundable inspection fee of KES 500 applies to each listing submission</Li>
            <Li>Listings are reviewed and approved or rejected by CCC administrators after inspection</Li>
            <Li>Only approved listings are visible to buyers in the marketplace</Li>
          </Sub>
          <Sub title="Featured Listings">
            <Li>Sellers may promote listings with Standard or Premium featured placement</Li>
            <Li>Premium listings appear above Standard listings in search results</Li>
            <Li>Featured listing fees are charged per day, week, or month as selected</Li>
            <Li>Featured listing fees are non-refundable once the promotion period has started</Li>
          </Sub>
          <Sub title="Escrow and Buyer Protection">
            <Li>All marketplace transactions are processed through an escrow system</Li>
            <Li>Funds are held by Car Care Connect until the buyer confirms receipt</Li>
            <Li>Buyers have 48 hours after reported delivery to raise a dispute</Li>
            <Li>After 48 hours without dispute, funds are automatically released to the seller</Li>
            <Li>Car Care Connect acts as a neutral escrow agent and is not party to the transaction</Li>
            <Li>In disputes, Car Care Connect will review evidence from both parties within 5 business days</Li>
            <Li>Fraudulent listings, misrepresentation of items, or refusal to deliver may result in account suspension and forfeiture of escrowed funds</Li>
          </Sub>
          <Sub title="Marketplace Conduct">
            <Li>Listings must be accurate, honestly described, and legally owned by the seller</Li>
            <Li>Contact information may not be shared in listings, comments, or chats (the platform blocks this automatically)</Li>
            <Li>Comments must be respectful, honest, and relevant to the listing</Li>
            <Li>Spam, harassment, false information, and hate speech are strictly prohibited</Li>
          </Sub>
        </Section>

        <Section title="7. Customer Terms">
          <Li>Customers may browse, book, pay, track, and review services across all categories</Li>
          <Li>Customers must provide accurate vehicle information and problem descriptions when booking</Li>
          <Li>For Shop Premium and GO Service, customers must be reachable and provide accurate location</Li>
          <Li>Cancellations made less than 24 hours before a scheduled appointment may be subject to cancellation fees at the provider&apos;s discretion</Li>
          <Li>Reviews must be honest and based on actual service experiences. False or defamatory reviews are prohibited</Li>
          <Li>Customers are responsible for ensuring their vehicle is accessible for pickup in concierge bookings</Li>
          <Li>Customers earn loyalty points on completed bookings which may be redeemed for discounts per the loyalty programme terms</Li>
        </Section>

        <Section title="8. Service Provider Terms">
          <Li>Service providers must be legally registered businesses or sole traders operating in Kenya</Li>
          <Li>Providers must maintain all required licenses, permits, and insurance for their services</Li>
          <Li>Providers are responsible for the quality, safety, and conduct of all mechanics they register</Li>
          <Li>Providers must ensure mechanics complete vehicle condition reports for all applicable bookings</Li>
          <Li>Providers must honor confirmed bookings. Repeated cancellations may result in account suspension</Li>
          <Li>Parts pricing must reflect fair market value. Overpricing to inflate commissions may result in termination</Li>
          <Li>Providers must not solicit customers to transact outside the platform to avoid commission fees</Li>
          <Li>Cash commissions are due within 30 days of the completed booking. After 3 unpaid commission cycles, the provider account will be automatically suspended</Li>
          <Li>Suspended providers may reinstate their account by paying all outstanding commissions plus a KES 500 reinstatement fee</Li>
        </Section>

        <Section title="9. Mechanic Sub-Accounts">
          <Li>Service providers may register mechanics as sub-accounts on the platform</Li>
          <Li>Each mechanic is assigned a unique mechanic code and accesses the platform via phone number and PIN</Li>
          <Li>Mechanics must upload valid identification documents: National ID, Driver&apos;s License, Certificate of Good Conduct, and Medical Certificate</Li>
          <Li>Documents are subject to verification by CCC administrators. Unverified mechanics may not be dispatched for GO Service</Li>
          <Li>Service providers are fully responsible for the conduct and compliance of all their registered mechanics</Li>
          <Li>Providers must immediately deactivate mechanic accounts upon termination of employment</Li>
          <Li>Mechanics must maintain live GPS sharing with customers during all active GO Service and Shop Premium jobs</Li>
          <Li>Mechanics must not use customer vehicles for any purpose other than the assigned service</Li>
        </Section>

        <Section title="10. Driver Terms and Vetting">
          <Sub title="Eligibility">
            <Li>Drivers must hold a valid Kenyan driver&apos;s license</Li>
            <Li>Drivers must maintain valid vehicle insurance and registration</Li>
            <Li>Drivers must pass the CCC driver vetting process before accepting jobs</Li>
          </Sub>
          <Sub title="Vetting Process">
            <Li>Drivers must submit an application with personal details, vehicle information, and required documents</Li>
            <Li>Required documents include: National ID, driver&apos;s license, vehicle logbook, insurance certificate, and Certificate of Good Conduct</Li>
            <Li>Documents are reviewed by CCC administrators. Approved applicants must attend an in-person vetting appointment</Li>
            <Li>New drivers are placed on a probation period during which their performance is monitored</Li>
            <Li>Drivers who fail to meet performance standards during probation may be removed from the platform</Li>
          </Sub>
          <Sub title="Driver Obligations">
            <Li>Drivers receive 15% of the booking value for concierge delivery services</Li>
            <Li>Drivers must complete vehicle condition reports at pickup and dropoff for all concierge bookings</Li>
            <Li>Drivers must not use customer vehicles for any purpose other than the assigned delivery</Li>
            <Li>Drivers are independent contractors, not employees of Car Care Connect</Li>
          </Sub>
        </Section>

        <Section title="11. Payments and Refunds">
          <Sub title="Payment Methods">
            <Li>Payments are processed securely through Pesapal, regulated by the Central Bank of Kenya</Li>
            <Li>Accepted methods include M-Pesa, Visa, and Mastercard</Li>
            <Li>Cash payments are accepted for Shop Standard and Shop Premium services only</Li>
            <Li>GO Service emergency requests require online payment only</Li>
          </Sub>
          <Sub title="Refunds">
            <Li>Refund requests must be submitted within 7 days of service completion</Li>
            <Li>Refunds are reviewed by CCC administrators within 5 business days</Li>
            <Li>Approved refunds are processed within 7 business days via the original payment method or M-Pesa</Li>
            <Li>Refund amounts are determined case by case based on the circumstances</Li>
            <Li>The KES 500 GO Service callout fee is non-refundable unless no provider was found after 6 dispatch attempts</Li>
            <Li>The KES 500 marketplace inspection fee is non-refundable</Li>
            <Li>Featured listing fees are non-refundable once the promotion period has started</Li>
          </Sub>
          <Sub title="Payouts to Providers and Drivers">
            <Li>Providers and drivers may request payouts of their earned balance through the platform</Li>
            <Li>Minimum payout amount is KES 500 (subject to change by platform administrators)</Li>
            <Li>Payout requests are processed manually by CCC administrators within 2-3 business days</Li>
            <Li>Providers and drivers must provide bank details, National ID, and KRA PIN for payout processing</Li>
            <Li>For payments above KES 24,999, KRA withholding tax regulations apply</Li>
            <Li>Car Care Connect reserves the right to withhold payouts in cases of disputed transactions or suspected fraud</Li>
          </Sub>
        </Section>

        <Section title="12. Financial Data and KRA Compliance">
          <div>Car Care Connect collects and stores the following financial and tax information from service providers and drivers for the purposes of payout processing and Kenya Revenue Authority compliance:</div>
          <div style={{ marginTop:8 }}>
            <Li>Bank name, account holder name, and account number</Li>
            <Li>M-Pesa number for mobile money payouts</Li>
            <Li>National ID number for identity verification</Li>
            <Li>KRA PIN for tax compliance on payments above KES 24,999</Li>
          </div>
          <div style={{ marginTop:12 }}>This information is encrypted, access-restricted, and only used for payout processing and regulatory compliance. It is never shared with third parties outside of mandatory tax reporting obligations to the Kenya Revenue Authority.</div>
        </Section>

        <Section title="13. Loyalty Programme">
          <Li>Customers earn loyalty points on completed and paid bookings</Li>
          <Li>Points accumulate to Bronze, Silver, Gold, and Platinum membership tiers</Li>
          <Li>Points may be redeemed for discounts on future bookings as determined by the platform</Li>
          <Li>Loyalty points have no cash value and cannot be transferred between accounts</Li>
          <Li>Car Care Connect reserves the right to modify or discontinue the loyalty programme with reasonable notice</Li>
          <Li>Points earned fraudulently will be forfeited and the account may be suspended</Li>
        </Section>

        <Section title="14. Prohibited Conduct">
          <div>The following are strictly prohibited on Car Care Connect:</div>
          <div style={{ marginTop:8 }}>
            <Li>Using the platform for any unlawful purpose or in violation of Kenyan law</Li>
            <Li>Harassing, threatening, or abusing other users, providers, drivers, or mechanics</Li>
            <Li>Filing false vehicle condition reports or mileage readings</Li>
            <Li>Submitting false GO Service emergency requests</Li>
            <Li>Posting false, misleading, or defamatory reviews or listings</Li>
            <Li>Attempting to circumvent the platform commission structure by transacting directly</Li>
            <Li>Using customer vehicles for unauthorized purposes</Li>
            <Li>Creating fake accounts, impersonating others, or providing false information</Li>
            <Li>Inflating parts prices to manipulate commission calculations</Li>
            <Li>Sharing personal contact information in chats, listings, or comments</Li>
            <Li>Misusing emergency PANIC or SOS alert features</Li>
            <Li>Uploading fraudulent documents during driver vetting or mechanic onboarding</Li>
          </div>
          <div style={{ marginTop:12 }}>Violations may result in immediate account suspension, termination, forfeiture of earnings, and/or legal action depending on severity.</div>
        </Section>

        <Section title="15. Emergency Alerts and Safety">
          <Li>Car Care Connect provides PANIC and SOS emergency alert buttons for drivers and mechanics during active sessions</Li>
          <Li>Activating these buttons sends an immediate alert to CCC administrators including the user&apos;s GPS coordinates</Li>
          <Li>Emergency alerts are to be used only in genuine emergencies such as accidents, medical emergencies, or safety threats</Li>
          <Li>Car Care Connect will make reasonable efforts to respond to emergency alerts but is not a substitute for emergency services</Li>
          <Li>In life-threatening situations, contact Police (999) or Ambulance (0800 722 203) immediately</Li>
          <Li>Misuse of emergency alert features may result in account suspension</Li>
          <Li>Car Care Connect is not liable for outcomes arising from emergency situations but will cooperate fully with law enforcement</Li>
        </Section>

        <Section title="16. GPS Location Data">
          <Li>Car Care Connect collects GPS location from drivers and mechanics during active service sessions to enable live tracking for customers</Li>
          <Li>Customer location shared during bookings is used solely to facilitate service delivery</Li>
          <Li>Driver and mechanic location history is retained for 90 days for dispute resolution then permanently deleted</Li>
          <Li>Location data is never sold to third parties or used for advertising</Li>
          <Li>By using Car Care Connect, drivers and mechanics consent to GPS location sharing during active sessions as a condition of platform participation</Li>
        </Section>

        <Section title="17. Limitation of Liability">
          <Li>Car Care Connect is a marketplace platform and is not liable for the quality, safety, or legality of services provided by third-party providers, mechanics, and drivers</Li>
          <Li>We are not liable for vehicle damage that occurs outside of documented vehicle condition reports</Li>
          <Li>We are not liable for any indirect, incidental, special, or consequential damages arising from your use of the platform</Li>
          <Li>Our total liability for any claims shall not exceed the amount you paid to Car Care Connect in the 3 months preceding the claim</Li>
          <Li>We do not guarantee uninterrupted or error-free operation of the platform</Li>
          <Li>For GO Service, Car Care Connect facilitates dispatch but is not liable for delays caused by traffic, unavailability of providers, or force majeure events</Li>
        </Section>

        <Section title="18. Intellectual Property">
          <Li>The Car Care Connect name, logo, and platform design are our intellectual property</Li>
          <Li>You may not use our branding without written permission</Li>
          <Li>User-generated content (reviews, photos, listings) remains your property, but you grant us a licence to display it on the platform</Li>
          <Li>You may not copy, reproduce, or distribute platform content without permission</Li>
        </Section>

        <Section title="19. Governing Law and Disputes">
          <Li>These Terms of Service are governed by the laws of Kenya</Li>
          <Li>Any disputes shall first be attempted to be resolved through good-faith negotiation</Li>
          <Li>If negotiation fails, disputes shall be resolved through arbitration in Nairobi, Kenya in accordance with the Arbitration Act of Kenya</Li>
          <Li>Nothing in these terms prevents either party from seeking emergency injunctive relief from a court</Li>
        </Section>

        <Section title="20. Termination">
          <Li>You may terminate your account at any time by contacting carcareconnect254@gmail.com</Li>
          <Li>We may terminate or suspend your account immediately for violations of these terms</Li>
          <Li>Upon termination, your right to use the platform ceases immediately</Li>
          <Li>Outstanding bookings and payments will be handled per our refund policy</Li>
          <Li>Account deletion requests are processed within 30 days per our Privacy Policy</Li>
        </Section>

        <Section title="21. Contact Information">
          <div style={{ background:"#f8f8f8", borderRadius:10, padding:"1rem", marginTop:8 }}>
            <Li>Platform: carcareconnect.care</Li>
            <Li>Email: carcareconnect254@gmail.com</Li>
            <Li>Phone: 0113858966</Li>
            <Li>Location: Nairobi, Kenya</Li>
          </div>
          <div style={{ marginTop:12 }}>We aim to respond to all enquiries within 5 business days.</div>
        </Section>

        <div style={{ borderTop:"1px solid #eeeeee", paddingTop:"2rem", marginTop:"2rem", fontSize:13, color:"#999", textAlign:"center" }}>
          &copy; 2026 Car Care Connect &mdash; Nairobi, Kenya &mdash; All rights reserved
        </div>
      </div>
    </div>
  )
}
