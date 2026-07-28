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
  const Warning = ({ children }) => (
    <div style={{ background:"#fff8f0", border:"1px solid #e6821e30", borderRadius:8, padding:"0.9rem", marginTop:12, fontSize:13, color:"#666", lineHeight:1.7 }}>{children}</div>
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
          <div style={{ fontSize:13, color:"#777" }}>Last updated: July 3, 2026 · Effective: July 3, 2026</div>
        </div>
        <div style={{ background:"#fff8f0", border:"1px solid #e6821e30", borderRadius:12, padding:"1.25rem", marginBottom:"2rem" }}>
          <div style={{ fontSize:14, color:"#555", lineHeight:1.8 }}>Welcome to Car Care Connect. By accessing or using our platform at carcareconnect.care, you agree to be bound by these Terms of Service and our Privacy Policy. Please read them carefully.</div>
        </div>

        <Section title="1. Acceptance of Terms">
          <div>By creating an account or using Car Care Connect, you confirm that you:</div>
          <div style={{ marginTop:8 }}>
            <Li>Are at least 18 years old and have legal capacity to enter this agreement</Li>
            <Li>Agree to these Terms of Service and our Privacy Policy</Li>
            <Li>Will provide accurate and complete information when registering</Li>
            <Li>Are responsible for maintaining the confidentiality of your account credentials</Li>
          </div>
          <div style={{ marginTop:12 }}>We reserve the right to update these terms at any time. Continued use of the platform after changes constitutes acceptance of the updated terms.</div>
        </Section>

        <Section title="2. Nature of the Platform — Important Disclaimer">
          <div style={{ fontWeight:600, color:"#000", marginBottom:8 }}>Car Care Connect is a technology marketplace platform, not a service provider.</div>
          <div>Car Care Connect operates solely as a digital marketplace that connects vehicle owners with independent, third-party automotive service providers, mechanics, parts dealers, and drivers. We provide the platform technology and facilitate connections — we do not employ, supervise, or control any service provider, mechanic, driver, or parts dealer on our platform.</div>
          <div style={{ marginTop:12 }}>By using Car Care Connect, you expressly acknowledge and agree that:</div>
          <div style={{ marginTop:8 }}>
            <Li>Car Care Connect does not provide automotive services, mechanical repairs, parts supply, or delivery services directly</Li>
            <Li>All service providers, mechanics, drivers, and parts dealers are independent contractors — not employees or agents of Car Care Connect</Li>
            <Li>Car Care Connect is not responsible for the acts, omissions, quality, safety, or legality of any service provided by independent parties on the platform</Li>
            <Li>Any agreement for services is directly between the customer and the service provider — Car Care Connect is not a party to that agreement</Li>
          </div>
          <Warning>Car Care Connect acts purely as a bridge connecting you to independent service providers. Our role is verification, facilitation, and platform management — not service delivery.</Warning>
        </Section>

        <Section title="3. No Guarantee of Service Quality or Availability">
          <div>While Car Care Connect verifies providers and drivers before listing them, we do not and cannot guarantee:</div>
          <div style={{ marginTop:8 }}>
            <Li>The quality, standard, or outcome of any service performed by a provider or mechanic</Li>
            <Li>That any particular provider or driver will be available at any given time</Li>
            <Li>That services will be completed within any specific timeframe</Li>
            <Li>Uninterrupted or error-free availability of the platform itself</Li>
          </div>
          <div style={{ marginTop:12 }}>The platform Service Guarantee is a goodwill mediation mechanism — it does not constitute a legal warranty or admission of liability by Car Care Connect.</div>
        </Section>

        <Section title="4. Force Majeure — Unavoidable Circumstances">
          <div>Car Care Connect and all service providers, mechanics, and drivers shall not be held liable for any delay, failure, or inability to perform services caused by circumstances beyond reasonable control, including but not limited to:</div>
          <div style={{ marginTop:8 }}>
            <Li>Traffic congestion, road closures, or accidents along the service route</Li>
            <Li>Natural disasters, floods, severe weather conditions, or acts of God</Li>
            <Li>Civil unrest, strikes, protests, or government-imposed restrictions</Li>
            <Li>Mechanical breakdown or vehicle failure beyond reasonable control</Li>
            <Li>Power outages, internet disruptions, or telecommunications failures</Li>
            <Li>Government orders, regulations, or emergency declarations</Li>
          </div>
          <Warning>If a driver or mechanic is delayed due to traffic, road accidents, or other unavoidable circumstances, this does not constitute a breach of terms by Car Care Connect. We encourage customers and providers to communicate directly through the platform chat.</Warning>
        </Section>

        <Section title="5. Vehicle Damage — Limitation of Liability">
          <Sub title="Concierge Driver Vehicle Custody">
            <Li>The concierge driver is an independent contractor — not an employee or agent of Car Care Connect</Li>
            <Li>Any damage to a customer vehicle during a concierge delivery is a matter between the customer and the driver directly</Li>
            <Li>Car Care Connect may mediate disputes at its sole discretion but assumes no financial liability for vehicle damage</Li>
            <Li>Customers are strongly advised to maintain comprehensive vehicle insurance before using concierge services</Li>
            <Li>Vehicle condition reports serve as the primary evidence in any damage dispute</Li>
          </Sub>
          <Sub title="Service Provider Work">
            <Li>The service provider is solely responsible for the quality and safety of their work</Li>
            <Li>Car Care Connect is not liable for any damage resulting from work performed by any provider</Li>
            <Li>Any warranty on parts or labor is the sole responsibility of the service provider</Li>
          </Sub>
          <Warning>Car Care Connect does not carry insurance for customer vehicles or services rendered. All parties must maintain appropriate insurance coverage.</Warning>
        </Section>

        <Section title="6. Service Categories and Commission Structure">
          <Sub title="Standard Service Booking">Customer brings vehicle to provider. Platform commission: 10% of service fee. Provider receives: 90% minus 1% processing fee share. Processing fee (3% Safaricom Daraja M-Pesa fee) is split equally: 1% charged to customer, 1% absorbed by provider, 1% absorbed by CCC.</Sub>
          <Sub title="GO Service — Callout Fee">Emergency roadside mechanic dispatch. Non-refundable KES 500 callout fee required upfront. Fee held in escrow until mechanic arrival is verified via OTP. On verification: provider receives 70%, CCC retains 30%. No-show results in full refund to customer.</Sub>
          <Sub title="GO Service — Service Fee">Charged separately after job completion via automatic M-Pesa STK push. Provider receives 85%, CCC retains 15%.</Sub>
          <Sub title="GO Parts">Parts requested by mechanic during GO Service. Customer pays upfront (held in escrow). Payment released to parts provider only after customer confirms receipt. Provider receives 90%, CCC retains 10%.</Sub>
          <Sub title="Concierge Driver Services">CCC vetted driver picks up and delivers customer vehicle. Concierge surcharge (15% of service fee) added to booking. Driver receives 15% of surcharge plus KES 200 transport allowance. Provider receives service fee minus platform commission. CCC retains platform commission plus majority of surcharge.</Sub>
          <Sub title="Parts & Inventory Marketplace">Platform commission: 5-10% depending on provider type. Parts dealers: 5%, accessories: 8%, tyres: 6%. Sellers receive remainder directly to their registered M-Pesa/Till/Paybill/Pochi account.</Sub>
          <Sub title="Marketplace Escrow">High-value marketplace transactions (vehicles, parts) use escrow protection. Buyer payment held until buyer confirms receipt. Dispute window: 48 hours after delivery confirmation. Seller paid directly to registered account after confirmation.</Sub>
          <div style={{ marginTop:12, background:"#f8f8f8", borderRadius:8, padding:"0.75rem", fontSize:13, color:"#666" }}>All commission rates are admin-configurable and subject to change with 30 days written notice to registered providers. Current rates are displayed in your provider dashboard.</div>
        </Section>

        <Section title="7. GO Service Terms">
          <Li>GO Service requires online payment only (M-Pesa or card)</Li>
          <Li>KES 500 callout fee required before dispatch — held in escrow until mechanic arrival verified via OTP</Li>
          <Li>Requests sent to nearest available providers — each has 15 minutes to accept</Li>
          <Li>After 6 unsuccessful attempts, customer is notified and full callout fee is refunded</Li>
          <Li>Response times are estimates only — Car Care Connect does not guarantee any specific response time</Li>
          <Li>Car Care Connect is not a substitute for emergency services. In life-threatening situations, contact Police (999) or Ambulance (0800 722 203)</Li>
        </Section>

        <Section title="8. Vehicle Condition Reports">
          <Li>A pickup condition report must be completed before taking custody of a vehicle</Li>
          <Li>A dropoff condition report must be completed before returning the vehicle</Li>
          <Li>Reports must include odometer reading, fuel level, and any pre-existing damage</Li>
          <Li>Customers have 24 hours after service completion to raise a vehicle condition dispute</Li>
        </Section>

        <Section title="9. Payments — Processed Exclusively by M-Pesa">
          <div style={{ fontWeight:600, color:"#000", marginBottom:8 }}>All payments on Car Care Connect are processed via Safaricom Daraja, a licensed payment service provider regulated by the Central Bank of Kenya.</div>
          <Sub title="Payment Processing Fee">
            <Li>Safaricom Daraja charges a 1% processing fee per transaction.</Li>
            <Li>This fee is shared equally: 1% added to customer total, 1% deducted from provider payout, 1% absorbed by Car Care Connect</Li>
            <Li>Processing fees are non-refundable in all circumstances</Li>
            <Li>Accepted payment methods: M-Pesa STK Push</Li>
          </Sub>
          <Sub title="Automatic Payouts">
            <Li>Providers and drivers are paid automatically and instantly upon payment confirmation</Li>
            <Li>Payouts sent directly to registered M-Pesa number, Till Number, Paybill, or Pochi la Biashara</Li>
            <Li>Car Care Connect platform commission is retained by Safaricom Daraja for up to 72 hours (regulatory requirement) before withdrawal</Li>
            <Li>Providers can register their preferred payout method in Profile → Contact Details</Li>
            <Li>KRA withholding tax applies for payments above KES 24,999 per transaction</Li>
          </Sub>
          <Sub title="Escrow Protection">
            <Li>GO Service callout fee (KES 500) held in escrow until mechanic arrival verified via OTP — refunded in full on no-show</Li>
            <Li>GO Parts payments held in escrow until customer confirms receipt — refunded if part not delivered</Li>
            <Li>Marketplace high-value transactions held until buyer confirms receipt — 48 hour dispute window</Li>
          </Sub>
          <Sub title="Refunds">
            <Li>Refund requests must be submitted within 7 days via the Service Claims feature</Li>
            <Li>Approved refunds processed within 7 business days to original payment method</Li>
            <Li>GO Service callout fee automatically refunded if no provider found after 6 attempts</Li>
            <Li>GO Parts payment automatically refunded if customer reports non-delivery</Li>
          </Sub>
          <Sub title="Provider Commission Structure">
            <Li>CCC charges providers a platform commission on every completed booking (rates vary by provider type — see Section 6)</Li>
            <Li>Commission covers: customer acquisition, payment processing infrastructure, trust verification, dispute resolution, and platform maintenance</Li>
            <Li>Providers are independent contractors — commission is NOT charged on bookings sourced outside the platform</Li>
            <Li>Commission rates displayed in provider dashboard and subject to 30 days notice before changes</Li>
            <Li>By listing services on CCC, providers agree to the current commission structure</Li>
          </Sub>
        </Section>

        <Section title="10. Customer Terms">
          <Li>Customers acknowledge all service providers are independent contractors, not Car Care Connect employees</Li>
          <Li>Customers must provide accurate vehicle information and problem descriptions</Li>
          <Li>Cancellations less than 24 hours before appointment may incur fees at provider discretion</Li>
          <Li>Reviews must be honest and based on actual service experiences</Li>
          <Li>Customers are advised to maintain comprehensive vehicle insurance before using concierge or mobile mechanic services</Li>
        </Section>

        <Section title="11. Service Provider Terms">
          <Li>Providers must be legally registered businesses or sole traders in Kenya</Li>
          <Li>Providers must maintain all required licenses, permits, and insurance</Li>
          <Li>Providers are fully responsible for the quality, safety, and outcome of all services they provide</Li>
          <Li>Providers must not solicit customers to transact outside the platform</Li>
          <Li>Car Care Connect may suspend or terminate provider accounts for poor service quality or violations</Li>
        </Section>

        <Section title="12. Driver Terms">
          <Sub title="Independent Contractor Status">
            <div style={{ marginBottom:8 }}>All drivers are independent contractors — not employees, agents, or representatives of Car Care Connect. Car Care Connect does not control how drivers perform services, their working hours, or their routes.</div>
          </Sub>
          <Sub title="Driver Obligations">
            <Li>Must complete vehicle condition reports at pickup and dropoff</Li>
            <Li>Must not use customer vehicles for unauthorized purposes</Li>
            <Li>Are solely responsible for any damage caused to customer vehicles during their custody</Li>
            <Li>Must maintain their own vehicle and personal liability insurance</Li>
          </Sub>
        </Section>

        <Section title="13. Limitation of Liability">
          <div>To the maximum extent permitted by Kenyan law, Car Care Connect total liability shall not exceed the total platform fees paid by the user in the 30 days preceding the claim.</div>
          <div style={{ marginTop:12 }}>Car Care Connect shall not be liable for:</div>
          <div style={{ marginTop:8 }}>
            <Li>Damage to vehicles or property caused by independent providers or drivers</Li>
            <Li>Personal injury arising from services by independent contractors</Li>
            <Li>Delays or non-performance caused by force majeure events</Li>
            <Li>Acts, omissions, or conduct of any independent provider, mechanic, driver, or dealer</Li>
            <Li>Indirect, incidental, consequential, or punitive damages of any kind</Li>
          </div>
          <Warning>By using Car Care Connect, you accept that the platform facilitates connections but does not guarantee outcomes. All users engage with independent third parties at their own risk.</Warning>
        </Section>

        <Section title="14. Prohibited Conduct">
          <Li>Using the platform for unlawful purposes or in violation of Kenyan law</Li>
          <Li>Harassing, threatening, or abusing other users, providers, drivers, or mechanics</Li>
          <Li>Filing false vehicle condition reports, mileage readings, or emergency requests</Li>
          <Li>Posting false, misleading, or defamatory reviews or listings</Li>
          <Li>Circumventing the platform commission structure by transacting directly</Li>
          <Li>Using customer vehicles for unauthorized purposes</Li>
          <Li>Creating fake accounts or providing false information</Li>
          <Li>Sharing personal contact information in chats, listings, or comments</Li>
          <div style={{ marginTop:12 }}>Violations may result in immediate account suspension or permanent termination without notice or refund.</div>
        </Section>

        <Section title="15. Dispute Resolution">
          <Li>Users must first attempt resolution through the platform claims system</Li>
          <Li>Unresolved disputes may be escalated to carcareconnect254@gmail.com</Li>
          <Li>Car Care Connect may mediate at its discretion — mediation does not create legal liability</Li>
          <Li>Payment disputes involving M-Pesa may also be raised directly with M-Pesa</Li>
          <Li>These terms are governed by the laws of Kenya. Legal disputes are subject to Kenyan court jurisdiction</Li>
        </Section>

        <Section title="16. Loyalty Programme">
          <Li>Customers earn loyalty points on completed and paid bookings</Li>
          <Li>Points have no cash value and cannot be transferred between accounts</Li>
          <Li>Car Care Connect reserves the right to modify or discontinue the loyalty programme with reasonable notice</Li>
        </Section>

        <Section title="17. Account Termination">
          <Li>Car Care Connect may suspend or terminate any account at any time for terms violations</Li>
          <Li>Users may delete their own accounts via platform settings</Li>
          <Li>Car Care Connect is not liable for any loss resulting from account termination due to violations</Li>
        </Section>

        <Section title="18. Contact Information">
          <div style={{ background:"#f8f8f8", borderRadius:8, padding:"1rem", fontSize:13, color:"#555", lineHeight:2, marginTop:8 }}>
            <div><strong>Car Care Connect</strong></div>
            <div>📧 carcareconnect254@gmail.com</div>
            <div>📞 0113858966</div>
            <div>🌐 carcareconnect.care</div>
            <div>🇰🇪 Nairobi, Kenya</div>
          </div>
        </Section>

        <div style={{ borderTop:"1px solid #eeeeee", paddingTop:"2rem", marginTop:"1rem", fontSize:12, color:"#999", lineHeight:1.8 }}>
          Last updated: July 3, 2026. Car Care Connect reserves the right to update these terms at any time.
        </div>
      </div>
    </div>
  )
}