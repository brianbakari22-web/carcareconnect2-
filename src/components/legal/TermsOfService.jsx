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
          <div style={{ fontSize:13, color:"#555" }}>Last updated: June 1, 2026 · Effective: June 1, 2026</div>
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
              "Car Care Connect is a digital marketplace connecting vehicle owners (customers) with automotive service providers, mechanics, and concierge drivers in Nairobi, Kenya.",
              "We offer three service categories: Shop Standard (customer brings car to shop), Shop Premium (mechanic travels to customer location), and GO Service (emergency roadside assistance).",
              "We provide the platform and technology infrastructure but are not directly responsible for the quality of services provided by independent service providers, mechanics, and drivers.",
              "We reserve the right to modify, suspend, or discontinue any part of the service at any time with reasonable notice.",
            ]
          },
          {
            title: "3. Service Categories and Commission Structure",
            items: [
              "Shop Standard Services: Customer brings their vehicle to the provider's shop. Platform commission is 10%. Provider receives 90% of the service fee.",
              "Shop Premium Services: Provider's mechanic travels to the customer's home or office. Platform commission is 20%. Provider receives 80% of the service fee.",
              "GO Service (Emergency Roadside): Provider dispatches a mechanic to the customer's breakdown location. Platform commission is 15%. Provider receives 85% of the service fee.",
              "Concierge Driver Services: A platform driver picks up and delivers the customer's vehicle. Commission split is 15% platform, 70% provider, 15% driver.",
              "Parts and Commodities: When service providers supply parts or materials as part of a booking, the platform charges a 10% commission on the parts cost. The provider receives 90% of the parts value.",
              "Commission rates are subject to change with 30 days notice to registered providers.",
            ]
          },
          {
            title: "4. GO Service (Emergency Roadside) Terms",
            items: [
              "GO Service is available only through online payment (M-Pesa or card). Cash payments are not accepted for emergency services to ensure platform commission accountability.",
              "When a GO Service request is submitted, it is sent to available providers in sequence. Each provider has 15 minutes to accept the request.",
              "If a provider does not respond within 15 minutes, the request is automatically forwarded to the next available provider. After 5 unsuccessful attempts, the customer is notified that no providers are currently available.",
              "Providers who are marked as offline will not receive GO Service requests.",
              "A KES 500 non-refundable callout fee is required before dispatch. Fee split: KES 425 to mechanic and KES 75 to platform.",
              "Car Care Connect is not a substitute for emergency services. In life-threatening situations, contact emergency services (999) immediately.",
            ]
          },
          {
            title: "5. Vehicle Condition Reports",
            items: [
              "For all concierge, Shop Premium, and GO Service bookings where a driver or mechanic takes custody of a customer's vehicle, a pickup condition report must be completed before taking the vehicle and a dropoff report must be completed before returning it.",
              "Drivers and mechanics are required to accurately record the vehicle's odometer reading, fuel level, and any pre-existing damage at both pickup and dropoff.",
              "If the odometer difference between pickup and dropoff exceeds 30km (or the customer's custom threshold), an automatic mileage alert is sent to the customer.",
              "Customers have 24 hours after service completion to raise a vehicle condition dispute. Disputes are reviewed by platform administrators within 5 business days.",
              "Filing false condition reports is a serious violation that may result in immediate account termination and legal action.",
              "Car Care Connect acts as a neutral dispute resolver and will review evidence from both parties before making a determination.",
            ]
          },
          {
            title: "6. Parts and Commodities",
            items: [
              "Service providers may add parts and materials to bookings when required to complete the service.",
              "Before adding parts, providers must review the customer's problem description and parts requirements submitted at booking.",
              "Customers must approve any parts additions before they are charged. An updated booking total will be shown for approval.",
              "Parts pricing must be fair and transparent. Providers may not inflate parts prices. Car Care Connect reserves the right to investigate pricing complaints.",
              "Platform commission of 10% applies to all parts and materials supplied through the platform.",
              "Once a customer approves parts, the updated total is final and non-negotiable unless there is a genuine dispute.",
            ]
          },
          {
            title: "7. Customer Terms",
            items: [
              "Customers may browse services across all categories, book appointments, make payments, track mechanics, and leave reviews for completed services.",
              "For Shop Premium and GO Service bookings, customers must provide accurate location information and be reachable during the service.",
              "Customers must provide accurate vehicle information and problem descriptions when making bookings.",
              "Cancellations made less than 24 hours before a scheduled appointment may be subject to cancellation fees at the provider's discretion.",
              "Reviews must be honest and based on actual service experiences. False or defamatory reviews are prohibited.",
              "Customers are responsible for ensuring their vehicle is accessible for pickup in concierge and Shop Premium bookings.",
            ]
          },
          {
            title: "8. Service Provider Terms",
            items: [
              "Service providers must be legally registered businesses or sole traders operating in Kenya.",
              "Providers must maintain all required licenses, permits, and insurance for their services and for all mechanics they register on the platform.",
              "Providers are responsible for the quality, safety, and accountability of all services performed by their registered mechanics.",
              "Providers must ensure mechanics complete vehicle condition reports for all concierge, Shop Premium, and GO Service bookings.",
              "Providers must honor confirmed bookings. Repeated cancellations may result in account suspension.",
              "Parts pricing must reflect fair market value. Overpricing parts to inflate commissions may result in account termination.",
              "Providers must not solicit customers to transact outside the platform to avoid commission fees.",
              "For GO Service, providers who are marked online must maintain the ability to dispatch mechanics promptly. Accepting emergency requests without capability to dispatch may result in account suspension.",
            ]
          },
          {
            title: "9. Mechanic Terms",
            items: [
              "Mechanics are registered and managed by service providers. They are not independent contractors of Car Care Connect.",
              "Mechanics must complete accurate vehicle condition reports at pickup and dropoff for all applicable service types.",
              "Mechanics must not use customer vehicles for any purpose other than the assigned service.",
              "Mechanics dispatched for GO Service must share their live location with customers during the service.",
              "Mechanics must maintain professional conduct and treat all customer vehicles with due care.",
            ]
          },
          {
            title: "10. Driver Terms",
            items: [
              "Drivers must hold a valid Kenyan driver's license and maintain a clean driving record.",
              "Drivers must maintain valid vehicle insurance and registration at all times.",
              "Drivers receive 15% of the booking value for concierge delivery services.",
              "Drivers must complete vehicle condition reports at pickup and dropoff for all concierge bookings.",
              "Drivers must not use customer vehicles for any purpose other than the assigned delivery.",
              "Drivers are independent contractors, not employees of Car Care Connect.",
            ]
          },
          {
            title: "11. Payments and Refunds",
            items: [
              "Payments are processed securely through Pesapal (regulated by the Central Bank of Kenya). Accepted methods include M-Pesa, Visa, and Mastercard.",
              "Cash payments are accepted for Shop Standard and Shop Premium services but are NOT accepted for GO Service emergency requests.",
              "Parts costs require customer approval before payment. Once approved, the updated total is charged.",
              "Refund requests must be submitted within 7 days of service completion.",
              "Refunds are reviewed within 5 business days. Approved refunds are processed within 7 business days.",
              "Car Care Connect reserves the right to withhold payouts in cases of disputed transactions, vehicle condition disputes, or suspected fraud.",
              "Loyalty points have no cash value and cannot be transferred between accounts.",
            ]
          },
          {
            title: "12. Marketplace Terms",
            items: [
              "Using the platform for any unlawful purpose or in violation of any local, national, or international law.",
              "Harassing, threatening, or abusing other users, providers, drivers, or mechanics.",
              "Filing false vehicle condition reports or mileage readings.",
              "Submitting false GO Service emergency requests.",
              "Posting false, misleading, or defamatory reviews or content.",
              "Attempting to circumvent the platform's commission structure.",
              "Using customer vehicles for unauthorized purposes.",
              "Creating fake accounts, impersonating others, or providing false information.",
              "Inflating parts prices to manipulate commission calculations.",
            ]
          },
          {
            title: "15. Limitation of Liability",
            items: [
              "Car Care Connect is a marketplace platform and is not liable for the quality, safety, or legality of services provided by third-party service providers, mechanics, and drivers.",
              "We are not liable for any vehicle damage that occurs outside of documented vehicle condition reports. Disputes must follow our vehicle condition dispute process.",
              "We are not liable for any indirect, incidental, special, or consequential damages arising from your use of the platform.",
              "Our total liability to you for any claims arising from these terms shall not exceed the amount you paid to Car Care Connect in the 3 months preceding the claim.",
              "We do not guarantee uninterrupted or error-free operation of the platform.",
              "For GO Service emergencies, Car Care Connect facilitates dispatch but is not liable for delays caused by traffic, unavailability of providers, or force majeure events.",
            ]
          },
          {
            title: "16. Intellectual Property",
            items: [
              "The Car Care Connect name, logo, and platform design are our intellectual property. You may not use them without our written permission.",
              "User-generated content (reviews, photos) remains your property, but you grant us a license to display it on the platform.",
              "You may not copy, reproduce, or distribute platform content without permission.",
            ]
          },
          {
            title: "17. Governing Law and Disputes",
            items: [
              "These Terms of Service are governed by the laws of Kenya.",
              "Any disputes shall first be attempted to be resolved through good-faith negotiation.",
              "If negotiation fails, disputes shall be resolved through arbitration in Nairobi, Kenya in accordance with the Arbitration Act of Kenya.",
              "Nothing in these terms prevents either party from seeking emergency injunctive relief from a court.",
            ]
          },
          {
            title: "18. Termination",
            items: [
              "You may terminate your account at any time by contacting us at carcareconnect254@gmail.com.",
              "We may terminate or suspend your account immediately for violations of these terms.",
              "Upon termination, your right to use the platform ceases immediately. Outstanding bookings and payments will be handled per our refund policy.",
            ]
          },
          {
            title: "19. Contact Information",
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







