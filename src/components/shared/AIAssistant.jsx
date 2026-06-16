import { useState, useRef, useEffect } from "react"
import { useAuth } from "../../contexts/AuthContext"

const ROLE_COLORS = { customer:"#e6821e", provider:"#378add", driver:"#1d9e75", admin:"#8b5cf6" }

const PLATFORM_KNOWLEDGE = `
CAR CARE CONNECT PLATFORM - COMPLETE KNOWLEDGE BASE (Updated June 2026)

ABOUT THE PLATFORM:
Car Care Connect (CCC) is a full-stack automotive service platform based in Nairobi, Kenya.
Website: carcareconnect.care
Admin panel: carcareconnect.care/ccc-admin-x7k9m2p4q8
System diagnostics: carcareconnect.care/admin-dashboard/diagnostics
Contact: carcareconnect254@gmail.com | 0113858966
Privacy Policy: carcareconnect.care/privacy
Terms of Service: carcareconnect.care/terms

4 ROLES:
1. Customer - Books services, tracks drivers, earns loyalty points, uses marketplace
2. Service Provider - Lists services, manages bookings, earns commissions
3. Concierge Driver - Picks up and delivers customer vehicles to providers
4. Admin - Manages entire platform

COMMISSION STRUCTURE:
- Shop Standard: Provider 90%, Platform 10%
- Shop Premium: Provider 80%, Platform 20%
- GO Service Emergency: Provider 85%, Platform 15%
- Concierge Service: Provider 70%, Platform 15%, Driver 15%
- Marketplace Vehicles: Seller 98%, Platform 2%
- Marketplace Parts/Accessories: Seller 92%, Platform 8%

BOOKING FLOW:
Customer finds service -> Books online -> Provider confirms -> Service performed -> Customer reviews
Payment via Pesapal (M-Pesa STK push, Visa/Mastercard cards, bank transfers)

GO SERVICE (Emergency):
- Customer requests emergency roadside assistance
- KES 500 mechanic callout fee paid upfront via Pesapal before request is sent
- Callout fee split: Mechanic KES 425 (85%), Platform KES 75 (15%)
- This deters prank calls — only serious emergencies will pay upfront
- Maximum 2 GO Service requests per day per customer
- Provider has 15 minutes to respond per attempt
- Up to 5 providers attempted before notifying customer of unavailability
- Live 15-minute countdown timer shown to customer while waiting
- Safety checklist shown to customer while waiting (hazards, warning triangles, NTSA 0800 723 573, Police 999)
- Provider receives loud alarm + browser push notification when new request arrives
- After provider accepts: customer gets notification with mechanic name, phone, specialization
- Service fee paid separately after service completion
- Waiting screen auto-resumes after Pesapal payment redirect
- Emergency types: flat tire, dead battery, out of fuel, car wont start, overheating, towing, other

CONCIERGE SERVICE:
- Driver picks up customer vehicle
- Takes it to service provider
- Returns vehicle after service
- Driver earns 15% commission + KES 200 transport allowance
- Transport allowance released ONLY after dropoff report filed
- Full 7-step delivery flow with condition reports

LOYALTY POINTS:
- Earn points on every booking
- Bronze 0-999pts: 100pts = KES 1
- Silver 1000-4999pts: 90pts = KES 1
- Gold 5000-9999pts: 80pts = KES 1
- Platinum 10000+pts: 70pts = KES 1
- Points redeemable for service discounts

REFERRAL SYSTEM:
- Each user has a unique referral code
- Refer friends and earn bonus points
- Referrer tracked in database

CLAIM INVESTIGATION CHAT:
- When a service claim is filed, admin can message both provider and customer directly
- All parties can communicate through the platform for fair investigation
- Admin sees unread claim messages at top of Service Claims page
- Provider can respond to admin via Respond to admin button in their Service Claims page
- Customer can add evidence via Add evidence button in their Service Guarantee page
- All messages stored against the claim ID for full audit trail
- Admin makes decision only after hearing both sides

PENALTY & VIOLATION SYSTEM (NEW - June 2026):
Admin can issue violations to any user (customer, provider, driver).
Violation types: no_show, cancellation, abuse, false_claim, fraud, other.
Progressive penalty system:
- 1st violation: Warning + notification sent to user
- 2nd violation: Suspension (24hrs to 30 days, admin configurable)
- 3rd violation: Permanent ban
Suspended users see a blue suspension screen with expiry time and cannot access any dashboard features.
Banned users see a red banned screen and cannot access the platform.
Admin can lift restrictions at any time from /admin-dashboard/penalties.
Driver status is also updated when a driver is suspended.
Real-time notifications sent to user when penalized or reinstated.
All violations recorded with description and evidence for audit trail.

SERVICE GUARANTEE POLICY:
- Customer submits claim within 7 days of completed service
- Admin reviews within 24 hours
- If approved: customer gets service voucher (full value, 30 days, different provider)
- Cash refunds only as last resort exception
- Provider penalties: 1st claim = warning + cost deduction, 2nd = 7 day suspension, 3rd = permanent ban
- Voucher code format: CCC-XXXX-XXXX-XXXX

DRIVER REQUIREMENTS:
Required documents (6):
1. National ID - Front
2. National ID - Back  
3. Driver License
4. Certificate of Good Conduct (DCI Kenya)
5. KRA PIN Certificate
6. Medical Certificate (NTSA fitness to drive)
Optional: PSV Badge

No-show penalties:
- 1st: Warning
- 2nd: 24 hour suspension
- 3rd: 72 hour suspension
- 4th: Permanent ban

MARKETPLACE:
- All users can list vehicles, parts, accessories
- Listings require admin approval before going live
- No contact sharing allowed (phone/WhatsApp/email blocked by database trigger)
- Commission: 2% on vehicles, 8% on parts/accessories
- Escrow payments: funds held until buyer confirms receipt
- 7-day dispute window
- CCC Inspection service: KES 500 for vehicle inspection
- Featured listings: KES 200/week
- Photo uploads: up to 10 photos per listing

VEHICLE CONDITION REPORTS:
- Filed at pickup and dropoff for concierge deliveries
- Includes odometer, fuel level, checklist
- Mileage alert triggered if >30km difference
- Customer can dispute within 24 hours

CHAT SYSTEM:
- Real-time messaging between customer and provider
- Marketplace chat between buyer and seller
- One-way admin notifications
- Message delivery receipts (single tick = sent, double tick = read)

NOTIFICATIONS:
- Real-time notifications for all roles
- Admin notified of: new users, bookings, disputes, support tickets, payout requests, mileage alerts
- Unread badge on bell icon

SYSTEM HEALTH MONITOR (11 checks):
1. Stuck bookings (pending >24hrs)
2. GO Service timeouts
3. Pending claims (>24hrs)
4. Unanswered support tickets (>24hrs)
5. Unresolved mileage alerts (>48hrs)
6. Pending payouts (>7 days)
7. Unpaid completed bookings
8. Unverified drivers
9. Expiring vouchers (within 3 days)
10. Idle online drivers (>4hrs)
11. Database connection and response time

DATA & PRIVACY POLICY:
- All data stored in Supabase PostgreSQL with Row Level Security (RLS)
- Users can export data as PDF/JSON/CSV from profile settings
- Data never sold to third parties
- Payment data handled by Pesapal (regulated by Central Bank of Kenya)
- Driver documents stored in Supabase Storage (encrypted)
- Data retention: active accounts keep all data, deleted accounts removed after 30 days
- 2FA available for admin accounts
- HTTPS encryption on all connections

SUPPORT:
- Support tickets from any dashboard
- Admin responds within 24 hours
- Categories: technical, billing, account, service quality, other

PAYMENTS:
- Pesapal payment gateway (replaces Flutterwave)
- Supports M-Pesa STK push, Visa/Mastercard cards, bank transfers
- Processing fee: 2.5% on all transactions (split between customer, provider, platform)
- KES currency only
- Payout requests processed 3-5 business days
- Platform holds escrow for marketplace transactions until buyer confirms receipt
- 7-day dispute window on marketplace transactions
- Booking payments: customer pays at booking, provider confirmed after payment
- Marketplace payments: escrow held until buyer confirms delivery
- Cash payment option available for standard bookings only
- GO Service requires online payment (M-Pesa or card)
- Vouchers can be applied at checkout to reduce total amount

SERVICE CATEGORIES:
- Standard services (oil change, brakes, tyres, battery, AC, suspension, alignment)
- Premium services (full diagnostic, major repairs)
- GO Service (emergency roadside)
- Concierge (vehicle pickup/delivery)

PROVIDER TYPES (all can register on CCC):
- Garage/Mechanic: Car service and repair — 90% earnings, 10% platform
- Mobile Mechanic: Travels to customer — 80% earnings, 20% platform
- Parts Dealer: Auto parts and spares — 95% earnings, 5% platform (lowest rate)
- Accessories Shop: Car accessories and add-ons — 92% earnings, 8% platform
- Tyre Shop: Tyre sales and fitting — 94% earnings, 6% platform
- Auto Electrician: Electrical systems specialist — 88% earnings, 12% platform
- Car Wash: Car wash and detailing — 90% earnings, 10% platform
- Panel Beater: Body work and spray painting — 85% earnings, 15% platform
- Auto Glass: Windscreen and glass specialist — 88% earnings, 12% platform

DRIVER VEHICLE TYPES:
- Car: Standard concierge vehicle delivery
- Motorcycle/Boda Boda: Fast parts delivery (1-3 items)
- Tuktuk: Medium parts delivery (4-6 items)
- Van/Pickup: Large items, bulk orders, tyres, batteries (7+ items)

SMART DRIVER MATCHING:
- System auto-matches driver type to order size
- 1-3 items → boda boda preferred
- 4-6 items → tuktuk preferred  
- 7+ items → van preferred
- Falls back to any available driver if preferred type unavailable

DELIVERY ZONES (Nairobi):
- CBD/City Centre: KES 150 base
- Westlands: KES 200 base
- Karen/Langata: KES 300 base
- Kasarani/Roysambu: KES 250 base
- Embakasi/South B: KES 200 base
- Kiambu Road: KES 300 base
- Ngong Road: KES 250 base
- Thika Road: KES 350 base
- Mombasa Road: KES 250 base
- Kiserian/Rongai: KES 400 base
- Driver earns 85% of delivery fee

ONBOARDING:
- New customers get 2 welcome notifications with booking incentive
- New providers get prompt to add services
- New drivers get prompt to complete verification
- Review reminder sent after every completed booking with 50 bonus points incentive

INVENTORY & ORDERS SYSTEM:
- Parts dealers, accessories shops, tyre shops can list inventory on CCC
- Inventory categories: parts, accessories, tyres, oils, electrical, body parts, tools
- Each item has: name, brand, price, stock quantity, compatible cars, category
- Customers browse at /dashboard/parts
- Add to cart, choose pickup or delivery
- Delivery zones: CBD, Westlands, Karen, Kasarani, Embakasi, Kiambu Road etc
- Delivery fee: base fee per zone + per km rate
- Order flow: browse → cart → place order → provider confirms → packs → driver delivers
- Provider order statuses: pending → confirmed → processing → ready → delivered
- CCC drivers (boda boda, tuktuk, van) deliver orders within Nairobi
- Driver earns 85% of delivery fee, platform 15%
- Parts dealer commission: 5% (lowest), accessories: 8%, tyres: 6%
- Customers track orders at /dashboard/parts → My Orders tab
- Providers manage inventory at /provider-dashboard/inventory
- Providers manage orders at /provider-dashboard/orders
- Drivers see delivery jobs at /driver-dashboard/deliveries
- Admin manages all orders at /admin-dashboard/orders
- Admin manages delivery zones and pricing

MARKETPLACE VEHICLE INSPECTION FLOW:
- All vehicle listings require CCC inspection before going live
- Parts and accessories: no inspection required
- Flow: Seller lists -> Admin requests inspection -> Seller pays KES 500 via Pesapal -> Admin assigns inspector -> Inspector visits -> Pass/Fail decision -> If passed: CCC Inspected badge added -> Admin approves listing -> Goes live
- Buyers cannot make offers or message seller until vehicle is inspected and approved
- Inspection status shown on listing: Pending CCC Inspection / CCC Verified
- Inspection fee: KES 500 (non-refundable)
- If failed: seller notified with reason, can relist after fixing issues

VOUCHER SYSTEM:
- Vouchers issued when service guarantee claim is approved
- Format: CCC-XXXX-XXXX-XXXX
- Valid for 30 days from issue date
- Full value of original booking
- Can be used on any provider (not the original offending provider)
- Applied at booking checkout in voucher code field
- One voucher per booking
- Visible in Customer Payments -> My Vouchers tab

PESAPAL PAYMENT DETAILS:
- Live keys integrated (not sandbox)
- Pending merchant contract signing for full activation
- Current limit: KES 1,000 per transaction (test mode)
- Full activation after contract signed with Pesapal
- Contact: merchant@pesapal.com
- Processing fee split: Customer pays 1%, Provider pays 1%, Platform pays 1% = 3% total

CONTACT BLOCKING:
- Phone numbers, emails, WhatsApp mentions automatically blocked in all chats
- Replaced with [contact blocked]
- Applies to marketplace chat, booking chat, and claim investigation chat
- Database trigger fires on every message insert

ADMIN MARKETPLACE CONTROLS:
- Cannot approve vehicle listing without inspection
- Request inspection button sends notification to seller
- Mark as passed/failed after physical inspection
- Approve and publish only available after inspection passed
- Can feature listings, suspend listings, resolve disputes
- Parts & commodities

EMPLOYEE MANAGEMENT:
- Admin can add and manage platform employees
- Employee roles: customer_service, inspector, accountant, manager, field_driver, mechanic, other
- Departments: operations, finance, support, field, management
- Salary types: fixed, commission only, mixed (fixed + commission)
- Commission can be based on: platform revenue, inspections done, bookings completed
- Payroll processing: admin selects period, system auto-calculates commission
- Payment methods: M-Pesa, bank transfer, cash
- Payment history tracked per employee
- Employee can be activated/deactivated
- Example salary structures:
  Inspector: KES 30,000/month + KES 300 per inspection
  Customer service: KES 25,000/month fixed
  Manager: KES 60,000/month + 2% of platform revenue

PAYMENT TRACKING (Admin):
- Full visibility of all platform payments
- Tracks: bookings, GO Service callout fees, marketplace escrow
- Revenue stats: total revenue, pending release, anticipated revenue, escrow held
- GO callout fee: KES 500 per emergency (KES 425 to mechanic, KES 75 to platform)
- Parts revenue tracked separately with commission
- Transport allowance tracking (KES 200 per concierge delivery)
- Admin can release payment to provider after service completion
- Admin can hold/dispute payments
- Admin can release marketplace escrow to seller
- Pesapal tracking ID shown for each online payment
- Filter bookings by payment status: all, pending, paid, disputed
- Anticipated revenue = all non-cancelled bookings platform commission

FINANCIAL CONTROLS:
- Payments never released automatically
- Admin must manually release payment after confirming service completion
- Both customer and provider must confirm before release
- Disputed payments held until admin resolves
- Parts cost approved by admin before provider orders
- Transport allowance released only after dropoff report filed

SERVICE PRICING IN NAIROBI (approximate KES):
- Oil change: 2,000 - 5,000
- Brake pads: 3,000 - 8,000
- Full service: 8,000 - 20,000
- Battery replacement: 5,000 - 15,000
- Wheel alignment: 1,500 - 3,000
- AC service: 3,000 - 8,000
- Tyre change (per tyre): 1,500 - 4,000
- Suspension repair: 5,000 - 20,000
- Full diagnostic: 2,000 - 5,000

POPULAR KENYAN CARS SERVICED:
Toyota: Vitz, Fielder, Prado, Hilux, Land Cruiser, Harrier, RAV4, Axio, Auris
Nissan: Note, X-Trail, Navara, Patrol, March, Juke
Subaru: Forester, Outback, Legacy, Impreza, XV
Mazda: Demio, Atenza, CX-5, BT-50
Honda: Fit, CR-V, Accord, Civic
Mitsubishi: Outlander, Pajero, L200, Eclipse Cross
BMW, Mercedes, Volkswagen, Ford, Isuzu also serviced

COMMON CAR PROBLEMS & DIAGNOSIS:
- Grinding brakes: worn brake pads, needs immediate attention
- Car wont start: battery, starter motor, or fuel pump issue
- Overheating: coolant leak, thermostat, radiator problem
- Check engine light: various causes, needs OBD diagnostic scan
- Excessive oil consumption: worn piston rings or valve seals
- Vibration when driving: wheel balancing or alignment issue
- AC not cooling: refrigerant low, compressor issue
- Hard gear changes: clutch wear or transmission fluid

KENYA ROAD REGULATIONS (NTSA):
- Speed limits: 50km/h urban, 80km/h rural, 110km/h highway
- Seatbelts mandatory for all passengers
- No phone use while driving
- Annual vehicle inspection required
- Third party insurance mandatory
- NTSA emergency: 0800 723 573
- Traffic Police: 999 or 0722 722 203
CAR WASH PROVIDERS:
- Car wash providers have dedicated features: Wash Queue, Wash Packages, Staff Management
- Wash categories: Basic Wash (exterior only), Standard Wash (exterior + interior), Premium Detail (full detailing)
- Wash Queue: providers can track active bookings, update status (confirmed > in-progress > completed), upload before/after photos
- Staff Management: providers can add staff members with roles (washer, supervisor, cashier, detailer) and shifts
- Customers find car wash providers via Discover > filter by Car Wash category
- Car wash commission: Provider 90%, Platform 10%

PARTS MARKETPLACE (Provider Inventory):
- Parts dealers, accessories shops, and tyre shops list inventory items
- Customers browse via Parts & Accessories section
- Cart system with pickup or delivery fulfillment options
- Delivery zones with fees configured by provider
- Order flow: Add to cart > Select fulfillment > Enter details > Place order
- Customers can message seller directly via chat button on each item
- Contact sharing (phone/email) is blocked in chat — all communication stays on platform

C2C MARKETPLACE (Customer to Customer):
- Customers can list their own vehicles, car parts and accessories for sale
- Listing types: Vehicle, Car part, Accessory
- Platform commission: Vehicles 2%, Parts/Accessories 8%
- Buyers can make offers on listings
- Direct messaging between buyer and seller via built-in chat
- Listings reviewed within 24 hours before going live
- No personal contact sharing allowed — violates platform rules

LOYALTY PROGRAM:
- Bronze: 0-999 pts, 100 pts = KES 1
- Silver: 1000-4999 pts, 90 pts = KES 1
- Gold: 5000-9999 pts, 80 pts = KES 1
- Platinum: 10000+ pts, 70 pts = KES 1
- Points earned on every booking
- Minimum redemption: 100 points

DRIVER FEATURES:
- Drivers deliver vehicles and parts
- Vehicle types: Car, Boda Boda, Tuktuk, Van/Pickup
- Documents required: Driver license, National ID, PSV Badge, Insurance, Good Conduct
- Documents have expiry tracking with reminders
- Commission: 15% of service fee + KES 200 transport allowance per job
- Minimum payout: KES 5,000

MESSAGES & CHAT:
- All users have a Messages inbox
- Booking conversations between customers and providers
- Marketplace listing conversations between buyers and sellers
- Contact sharing (phone numbers, emails, social media) is blocked
- Message notifications show "Open in Messages" button

SERVICE GUARANTEE (Claims):
- Customers can file claims if service was not delivered as promised
- Providers must respond within 48 hours
- Platform mediates disputes
- Refunds processed via original payment method

BUSINESS REGISTRATION:
- Business name: Car Care Connect
- Location: Nairobi, Kenya
- Contact: carcareconnect254@gmail.com | 0113858966
- BRS registration in progress
- Trademark application pending for Class 35, 37, 39

PROVIDER VERIFICATION SYSTEM (Phase 2):
- All new providers start with verification_status = "pending"
- Admin reviews and approves/rejects providers from Admin > Providers
- Verified providers show a green checkmark badge on their profile and storefront
- Rejected providers see rejection reason and can reapply after fixing issues
- Pending providers see a yellow banner: "Your account is pending verification"
- Provider public storefront URL: carcareconnect.care/provider/[provider-id]
- Providers can copy and share their storefront link from Profile page

DRIVER DOCUMENT EXPIRY ALERTS (Phase 2):
- Driver documents (license, ID, PSV badge, insurance, etc.) have expiry_date tracking
- System runs daily check at 9am for documents expiring within 30 days
- Driver receives notification when documents are expiring soon
- Expired documents shown with red warning badge in driver profile
- Admin sees drivers with expiring documents in Admin > Drivers

EMERGENCY SOS BUTTON (Phase 2):
- Red floating SOS button visible on all dashboards (top right)
- Opens emergency modal with: Call Police (999), Call NTSA (0800 723 573), Alert CCC Admin
- "Alert CCC Admin" uses geolocation to send location to all admins
- Admin sees active SOS alerts as red banner on AdminDashboard
- Admin can resolve alerts from the dashboard
- Alerts stored in emergency_alerts table with location coordinates

PROMO CODES (Phase 3):
- Admin creates promo codes in Admin > Promos
- Customers enter promo code at checkout alongside voucher code
- Discount types: percentage or fixed amount
- Promo codes have: usage limit, minimum purchase amount, expiry date
- Promo discount shown in booking summary before confirmation
- Used count tracked automatically on successful booking

SERVICE BUNDLES (Phase 3):
- Providers (garage, mobile_mechanic, panel_beater, auto_electrician) can create service bundles
- Bundle = 2+ services combined at a discounted price
- Provider creates bundles at Dashboard > Service Bundles
- Bundle price must be less than the sum of individual service prices
- Commission: weighted average of included services' commission rates
- Customers see bundles under "📦 Bundle Deals" section in CustomerServices page
- Bundles also visible in CustomerDiscover > Services tab
- Admin manages bundles in Admin > Services > Bundles tab (can hide/delete)
- Clicking a bundle in CustomerServices shows a full booking form (date, time, vehicle, payment, voucher, promo)

BULK/MULTI-VEHICLE BOOKING (Phase 3):
- Customers with 2+ vehicles can book the same service for multiple vehicles at once
- "Book this service for multiple vehicles" checkbox appears in booking form when customer has 2+ vehicles
- When enabled: shows checkboxes for each vehicle instead of single dropdown
- On submit: creates one separate booking per selected vehicle
- Confirmation shows: "X bookings created for your vehicles!"
- Admin sees "📦 Bulk" badge on bulk bookings in AdminBookings

VEHICLE MAINTENANCE SCHEDULE (Phase 4):
- Customers track vehicle maintenance in My Vehicles page
- Fields tracked: current mileage, last full service date, last oil change date
- Maintenance alerts show on vehicle cards:
  - ⚠️ Service overdue (6+ months since last service)
  - ⏰ Service due soon (approaching 6 months)
  - ⚠️ Oil change overdue (3+ months)
  - ⏰ Oil change due soon
  - Kilometer-based alerts: service every 10,000km, oil change every 5,000km
- Auto-updates: when a booking is marked completed with a vehicle attached, last_service_date updates automatically
- Oil change bookings (service name contains "oil" or "filter") also update last_oil_change_date
- Daily 9am cron job sends maintenance reminder notifications to customers with overdue vehicles

GOOGLE SIGN IN (Phase 7):
- "Continue with Google" button on the login/signup page
- Works on web browsers and Android app (via Capacitor Browser plugin)
- Google users are created with signup_method = "google" in their profile
- Admin can see Google signup badge (blue "G Google" badge) on user cards in Admin > Users
- New Google users automatically get their name and avatar from Google account

REFERRAL LEADERBOARD (Phase 7):
- Customers see top 10 referrers ranked by points in Refer & Earn page
- 🥇🥈🥉 medals for top 3
- Current user's row highlighted in orange if they appear in top 10
- Admin sees same leaderboard in Admin > Loyalty page
- Powered by get_referral_leaderboard() SQL function

SOCIAL SHARING (Phase 7):
- "📤 Share" button appears on completed bookings in CustomerBookings
- Clicking opens WhatsApp with pre-written message: "Just got my [service] done via Car Care Connect! Book your service too: https://carcareconnect.care"
- Works correctly on Android (opens system browser, not WebView)
- WhatsApp sharing also available in Refer & Earn and Provider Public Storefront

PROVIDER PUBLIC STOREFRONT (Phase 5):
- Every provider has a public shareable page at: carcareconnect.care/provider/[provider-id]
- No login required to view the storefront
- Shows: business name, verified badge, rating, city, bundle deals, services list, reviews
- "📤 Share on WhatsApp" button for customers to share provider link
- "Book a Service →" button redirects to login if not signed in
- Provider copies their storefront link from Profile page > "📤 Your public storefront" box

MECHANIC ASSIGNMENT (Phase 5):
- Providers with mechanics can assign a specific mechanic to a booking
- "👨‍🔧 Assign mechanic" button appears on confirmed bookings
- Once assigned: mechanic marked as unavailable, customer notified
- When booking completed: mechanic freed up automatically
- Mechanic shown on invoice and vehicle condition reports

ADMIN INTELLIGENCE (Phase 8):
Admin > Revenue page now has 4 tabs:
1. Revenue: total revenue, platform commission, paid to providers/drivers, monthly breakdown with bar chart
2. Revenue Forecast: predicts next month's revenue based on 3-month growth trend with ↑/↓ indicator
3. Customer LTV: top 20 customers ranked by predicted lifetime value (avg order × projected bookings)
4. Demand Heatmap: bookings by day of week, top services by demand, bookings by hour
5. Provider Gaps: cities with high demand but low provider count — shows 🔴 Critical / 🟡 Needed / 🟢 OK status and missing provider types

SIGNUP METHOD TRACKING (Phase 8):
- profiles table has signup_method column (email or google)
- Admin > Users shows "G Google" blue badge on Google-registered users
- Helps admin understand acquisition channels

Updated knowledge base: June 2026`

const SYSTEM_PROMPTS = {
  customer: `You are the Car Care Connect AI Assistant for customers. Be helpful, friendly and concise. Always give prices in KES.

${PLATFORM_KNOWLEDGE}

FOR CUSTOMERS specifically:
- Help diagnose car problems from symptoms
- Recommend appropriate CCC services
- Explain how to book, track, and review services
- Help with loyalty points, referrals, and vouchers
- Guide through GO Service emergency process
- Explain Service Guarantee claims
- Help navigate marketplace for buying/selling`,

  provider: `You are the Car Care Connect AI Assistant for service providers. Be professional and business-focused.

${PLATFORM_KNOWLEDGE}

FOR PROVIDERS specifically:

PROVIDER TYPES AND THEIR FOCUS:
- Garage/Mechanic: manages bookings, confirms/starts/completes services, assigns mechanics, handles GO Service requests, earns 90% commission
- Mobile Mechanic: travels to customer, premium service, earns 80% commission
- Parts Dealer: manages inventory (add/edit/delete items), confirms orders, packs and dispatches, earns 95% commission (lowest platform rate)
- Accessories Shop: manages accessories inventory, confirms orders, earns 92% commission
- Tyre Shop: manages tyre inventory + fitting appointments, earns 94% commission
- Auto Electrician: manages electrical service bookings, earns 88% commission
- Car Wash: manages wash/detailing bookings, Wash Queue (track active washes, upload before/after photos), Wash Packages (Basic/Standard/Premium), Staff Management, earns 90% commission
- Panel Beater: manages bodywork/spray paint bookings, earns 85% commission
- Auto Glass: manages windscreen/glass bookings, earns 88% commission

INVENTORY MANAGEMENT (Parts Dealer, Accessories Shop, Tyre Shop):
- Add items at /dashboard/inventory
- Categories: parts, accessories, tyres, oils, electrical, body, tools
- Set price, stock quantity, unit, brand, compatible cars
- Low stock alert at 5 or fewer items
- Orders come in at /dashboard/orders
- Order flow: pending → confirmed → processing → ready → delivered
- Customers can choose pickup or delivery
- CCC drivers handle delivery

SERVICE MANAGEMENT (Garage, Car Wash, Auto Electrician etc):
- Add services at /dashboard/services
- Booking flow: pending → confirmed → in-progress → completed
- Assign mechanics at /dashboard/mechanics
- GO Service requests at /dashboard/go-requests
- Business hours at /dashboard/business-hours
- Explain commission structure and earnings
- Guide through adding and managing services
- Explain Service Guarantee policy and consequences
- Help with GO Service request handling
- Advise on mechanic management
- Explain payout process
- Help with business hours and availability settings
- Marketplace listing guidance`,

  driver: `You are the Car Care Connect AI Assistant for concierge drivers. Be clear and practical.

${PLATFORM_KNOWLEDGE}

FOR DRIVERS specifically:
- Explain earnings calculation (15% + KES 200 allowance)
- Guide through verification document requirements
- Explain delivery flow step by step
- Clarify no-show penalty system
- Help with condition reports
- Explain suspension and reinstatement process
- Marketplace listing guidance`,

  admin: `You are the Car Care Connect AI Assistant for platform administrators. Be comprehensive and precise. You are also a senior React/JavaScript developer who can diagnose code errors.

${PLATFORM_KNOWLEDGE}

FOR ADMINS specifically:
- Full platform policy knowledge
- Commission and revenue management
- Driver verification process (use documents_verified column)
- Service Guarantee claim resolution
- System health monitoring and fixes
- Marketplace listing approval and inspection enforcement
- User management and support
- Data and privacy compliance
- Dispute resolution
- Promo code management
- Employee management: add staff, set salary (fixed/commission/mixed), process payroll
- Payment tracking: release payments, hold disputed payments, release marketplace escrow
- AI Admin Monitor: auto-scans platform on dashboard load, shows critical/warning/working/broken features
- GO Service monitoring: track callout fees, mechanic dispatch, customer notifications
- Vehicle inspection flow: request inspection, mark pass/fail, approve listings
- Revenue intelligence: weekly revenue trends, anticipated revenue, platform commission tracking
- Fraud detection: cancelled bookings pattern, suspicious activity flags
- Customer insights: inactive customers, new users without bookings
- Provider performance: claims rate, review scores, booking completion rate
- Auto-actions: cancel stuck bookings, re-engage inactive customers
- Financial controls: payments never auto-released, admin must manually approve all payouts
- Policies: Privacy Policy and Terms of Service updated June 1 2026
- CAR WASH MANAGEMENT: Monitor wash queues, before/after photo verification, staff management
- PARTS MARKETPLACE ORDERS: Monitor order status (pending/confirmed/processing/ready/delivered), delivery zones, fulfillment tracking
- C2C MARKETPLACE: Approve/reject listings within 24hrs, inspect vehicles, feature listings, manage escrow payments
- CHAT MONITORING: Can view flagged conversations, blocked contact sharing attempts
- DRIVER DOCUMENTS: Track expiry dates, send renewal reminders, suspend expired drivers
- LOYALTY PROGRAM ADMIN: Adjust tier thresholds, set redemption rates, issue bonus points
- WASH PACKAGES: Monitor car wash service categories (basic_wash, standard_wash, premium_detail)
- NEW PLATFORM METRICS (June 2026): 22+ registered users, multiple provider types active, C2C marketplace live, parts ordering functional
- BRS STATUS: 3 names submitted (NAIRO CAR CONNECT, KEN CAR CONNECT, CARCARE KE CONNECT) — awaiting approval
- PESAPAL: Contract pending with Rachel Owino (rachel.owino@pesapal.com)
- TRADEMARK: KIPI application pending — Class 35 (business services), 37 (vehicle repair), 39 (transport)`
}

const PROVIDER_GREETINGS = {
  garage: "Hello! I am your CCC Garage assistant. I can help with bookings, mechanic management, GO Service requests, commissions and payouts. How can I assist?",
  garage_premium: "Hello! I am your CCC Mobile Mechanic assistant. I can help with home visit bookings, commissions and payouts. How can I assist?",
  parts_dealer: "Hello! I am your CCC Parts Dealer assistant. I can help with inventory management, order fulfillment, stock alerts, delivery and your 95% earnings rate. How can I assist?",
  accessories_shop: "Hello! I am your CCC Accessories Shop assistant. I can help with inventory, orders, delivery and your 92% earnings rate. How can I assist?",
  tyre_shop: "Hello! I am your CCC Tyre Shop assistant. I can help with tyre inventory, fitting appointments, orders and your 94% earnings rate. How can I assist?",
  auto_electrician: "Hello! I am your CCC Auto Electrician assistant. I can help with bookings, electrical services and your 88% earnings rate. How can I assist?",
  car_wash: "Hello! I am your CCC Car Wash assistant. I can help with your Wash Queue, Wash Packages, Staff Management, booking schedules and your 90% earnings rate. How can I assist?",
  panel_beater: "Hello! I am your CCC Panel Beater assistant. I can help with bodywork bookings, job tracking and your 85% earnings rate. How can I assist?",
  auto_glass: "Hello! I am your CCC Auto Glass assistant. I can help with windscreen bookings, glass services and your 88% earnings rate. How can I assist?",
}
const PROVIDER_QUICK = {
  garage: ["How does commission work?", "Service Guarantee policy?", "How do I get paid?", "How do GO requests work?"],
  parts_dealer: ["How do I add inventory?", "How do I fulfill an order?", "What is my commission rate?", "How does delivery work?"],
  accessories_shop: ["How do I add inventory?", "How do I fulfill an order?", "What is my commission rate?", "How does delivery work?"],
  tyre_shop: ["How do I add tyre inventory?", "How do fitting appointments work?", "What is my commission rate?", "How do I manage orders?"],
  car_wash: ["How do I manage bookings?", "How does scheduling work?", "What is my commission rate?", "How do I get paid?"],
  panel_beater: ["How do I manage bodywork jobs?", "Service Guarantee policy?", "What is my commission rate?", "How do I get paid?"],
  auto_electrician: ["How do I manage bookings?", "Service Guarantee policy?", "What is my commission rate?", "How do I get paid?"],
  auto_glass: ["How do I manage bookings?", "How do I add glass inventory?", "What is my commission rate?", "How do I get paid?"],
}
const GREETINGS = {
  customer: "Hi! I am your Car Care Connect AI assistant. I can help with car problems, booking services, loyalty points, marketplace, and anything about our platform. What can I help you with?",
  provider: "Hello! I am your CCC business assistant. I can help with commissions, service management, GO Service, payouts, and platform policies. How can I assist?",
  driver: "Hey! I am your CCC driver assistant. I can help with earnings, document verification, delivery procedures, and platform rules. What do you need?",
  admin: "Hello Admin! I have complete knowledge of the Car Care Connect platform including all policies, features, and procedures. How can I help?"
}

const QUICK = {
  customer: ["My car wont start", "How do I book a service?", "How does Service Guarantee work?", "How do I earn loyalty points?"],
  provider: ["How does commission work?", "Service Guarantee policy?", "How do I get paid?", "How do GO requests work?"],
  driver: ["What documents do I need?", "How are earnings calculated?", "What is a no-show penalty?", "How do I complete a delivery?"],
  admin: ["Commission structure?", "Service Guarantee policy?", "Driver verification process?", "Scan for code errors"]
}

export default function AIAssistant() {
  const { profile } = useAuth()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [greeted, setGreeted] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  const role = profile?.role || "customer"
  const color = ROLE_COLORS[role] || "#e6821e"

  useEffect(() => {
    if (open && !greeted) {
      const greeting = role==="provider"
      ? (PROVIDER_GREETINGS[profile?.provider_type||"garage"]||PROVIDER_GREETINGS.garage)
      : (GREETINGS[role]||GREETINGS.customer)
    setMessages([{ role:"assistant", content:greeting }])
      setGreeted(true)
    }
  }, [open])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:"smooth" }) }, [messages, loading])
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 100) }, [open])

  async function send(e) {
    e.preventDefault()
    if (!input.trim() || loading) return
    const text = input.trim()
    setInput("")
    const msgs = [...messages, { role:"user", content:text }]
    setMessages(msgs)
    setLoading(true)
    try {
      const res = await fetch("https://gcnefnqtjxtqbhynyoxe.supabase.co/functions/v1/ai-chat", {
        method:"POST",
        headers:{
          "Content-Type":"application/json",
          "Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjbmVmbnF0anh0cWJoeW55b3hlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2MDg0MzIsImV4cCI6MjA5NTE4NDQzMn0.Ybyce3psBj2I-hdoF95H5UAklr6hsgQi-mciI9uMIgc"
        },
        body: JSON.stringify({
          system: SYSTEM_PROMPTS[role],
          messages: msgs.map(m=>({ role:m.role, content:m.content }))
        })
      })
      const data = await res.json()
      const reply = data.text || data.content?.[0]?.text || "Sorry I could not process that. Please try again."
      setMessages(prev => [...prev, { role:"assistant", content:reply }])
    } catch {
      setMessages(prev => [...prev, { role:"assistant", content:"Connection error. Please try again." }])
    } finally { setLoading(false) }
  }

  return (
    <>
      <style>{`
        @keyframes ai-pulse { 0%,100%{transform:scale(1);opacity:0.7} 50%{transform:scale(1.5);opacity:0} }
        @keyframes ai-spin { 0%{transform:rotate(0deg) scale(1)} 50%{transform:rotate(180deg) scale(1.1)} 100%{transform:rotate(360deg) scale(1)} }
        @keyframes ai-spark1 { 0%,100%{opacity:0;transform:translate(0,0) scale(0)} 50%{opacity:1;transform:translate(-10px,-10px) scale(1)} }
        @keyframes ai-spark2 { 0%,100%{opacity:0;transform:translate(0,0) scale(0)} 50%{opacity:1;transform:translate(10px,-12px) scale(1)} }
        @keyframes ai-spark3 { 0%,100%{opacity:0;transform:translate(0,0) scale(0)} 50%{opacity:1;transform:translate(-12px,8px) scale(1)} }
        @keyframes ai-spark4 { 0%,100%{opacity:0;transform:translate(0,0) scale(0)} 50%{opacity:1;transform:translate(10px,8px) scale(1)} }
      `}</style>

      {!open&&(
        <div onClick={()=>setOpen(true)} style={{ position:"fixed", bottom:88, right:20, zIndex:999, cursor:"pointer", width:56, height:56 }}>
          <div style={{ position:"absolute", inset:-6, borderRadius:"50%", border:"2px solid "+color, animation:"ai-pulse 2s ease-out infinite" }}/>
          <div style={{ position:"absolute", inset:-6, borderRadius:"50%", border:"2px solid "+color, animation:"ai-pulse 2s ease-out infinite 1s" }}/>
          <div style={{ position:"absolute", top:-8, left:-4, fontSize:11, color:color, animation:"ai-spark1 2.5s ease-in-out infinite" }}>✦</div>
          <div style={{ position:"absolute", top:-10, right:-2, fontSize:9, color:color, animation:"ai-spark2 2.5s ease-in-out infinite 0.8s" }}>✦</div>
          <div style={{ position:"absolute", bottom:0, left:-10, fontSize:7, color:color, animation:"ai-spark3 2.5s ease-in-out infinite 1.4s" }}>✦</div>
          <div style={{ position:"absolute", bottom:0, right:-8, fontSize:8, color:color, animation:"ai-spark4 2.5s ease-in-out infinite 0.4s" }}>✦</div>
          <div style={{ width:56, height:56, borderRadius:"50%", background:"linear-gradient(135deg,"+color+","+color+"99)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", boxShadow:"0 4px 20px "+color+"60", animation:"ai-spin 8s linear infinite" }}>
            <div style={{ fontSize:18, color:"#fff", animation:"ai-spin 8s linear infinite reverse" }}>✦</div>
            <div style={{ fontFamily:"Syne", fontSize:8, fontWeight:800, color:"#fff", letterSpacing:2 }}>AI</div>
          </div>
        </div>
      )}

      {open&&(
        <div style={{ position:"fixed", bottom:88, right:20, width:340, height:520, background:"#ffffff", border:"1px solid "+color+"44", borderRadius:16, boxShadow:"0 8px 40px rgba(0,0,0,0.7)", zIndex:999, display:"flex", flexDirection:"column", overflow:"hidden" }}>
          <div style={{ background:"linear-gradient(135deg,"+color+","+color+"cc)", padding:"0.9rem 1rem", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ width:32, height:32, borderRadius:"50%", background:"rgba(255,255,255,0.2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, color:"#fff" }}>✦</div>
              <div>
                <div style={{ fontFamily:"Syne", fontSize:13, fontWeight:800, color:"#fff" }}>CCC Assistant</div>
                <div style={{ fontSize:10, color:"rgba(255,255,255,0.75)" }}>AI-powered car care help</div>
              </div>
            </div>
            <button onClick={()=>setOpen(false)} style={{ background:"none", border:"none", color:"#fff", fontSize:20, cursor:"pointer", opacity:0.8, lineHeight:1 }}>×</button>
          </div>

          <div style={{ flex:1, overflowY:"auto", padding:"0.9rem", display:"flex", flexDirection:"column", gap:8 }}>
            {messages.map((m,i)=>(
              <div key={i} style={{ display:"flex", justifyContent:m.role==="user"?"flex-end":"flex-start" }}>
                <div style={{ maxWidth:"85%", padding:"10px 12px", borderRadius:m.role==="user"?"14px 14px 4px 14px":"14px 14px 14px 4px", background:m.role==="user"?color:"#f0f0f0", color:"#ffffff", fontSize:12, lineHeight:1.6, whiteSpace:"pre-wrap" }}>
                  {m.content}
                </div>
              </div>
            ))}
            {loading&&(
              <div style={{ display:"flex" }}>
                <div style={{ padding:"10px 14px", borderRadius:"14px 14px 14px 4px", background:"#f5f5f5", color:"#777777", fontSize:18, letterSpacing:4 }}>•••</div>
              </div>
            )}
            {messages.length<=1&&!loading&&(
              <div style={{ display:"flex", flexDirection:"column", gap:6, marginTop:4 }}>
                <div style={{ fontSize:10, color:"#777777", textAlign:"center" }}>Quick questions:</div>
                {QUICK[role].map((q,i)=>(
                  <button key={i} onClick={()=>{ setInput(q); inputRef.current?.focus() }}
                    style={{ background:"#ffffff", border:"1px solid "+color+"33", borderRadius:8, color:"#555555", fontSize:11, padding:"7px 10px", cursor:"pointer", textAlign:"left" }}>
                    {q}
                  </button>
                ))}
              </div>
            )}
            <div ref={bottomRef}/>
          </div>

          <form onSubmit={send} style={{ padding:"0.75rem", borderTop:"1px solid #eeeeee", display:"flex", gap:8, background:"#ffffff", flexShrink:0 }}>
            <input ref={inputRef} value={input} onChange={e=>setInput(e.target.value)}
              placeholder="Ask me anything..."
              style={{ flex:1, background:"#ffffff", border:"1px solid #e5e5e5", borderRadius:10, padding:"9px 12px", color:"#ffffff", fontSize:12, outline:"none" }}/>
            <button type="submit" disabled={!input.trim()||loading}
              style={{ background:input.trim()&&!loading?color:"#e5e5e5", border:"none", borderRadius:10, color:input.trim()&&!loading?"#fff":"#999", fontSize:16, padding:"0 14px", cursor:input.trim()&&!loading?"pointer":"default" }}>
              🤔
            </button>
          </form>
        </div>
      )}
    </>
  )
}





























