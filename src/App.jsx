import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { useState, useEffect } from "react"
import { Toaster } from "react-hot-toast"
import { AuthProvider, useAuth } from "./contexts/AuthContext"
import { LanguageProvider } from "./contexts/LanguageContext"
import { ThemeProvider } from "./contexts/ThemeContext"
import { supabase } from "./lib/supabase"
import AuthPage from "./components/auth/AuthPage"
import LandingPage from "./components/landing/LandingPage"

import PrivacyPolicy from "./components/legal/PrivacyPolicy"
import TermsOfService from "./components/legal/TermsOfService"
import AdminAuthPage from "./components/auth/AdminAuthPage"
import ResetPassword from "./components/auth/ResetPassword"
import PaymentCallback from "./components/shared/PaymentCallback"
import Layout from "./components/shared/Layout"
import CustomerDashboard from "./components/customer/CustomerDashboard"
import CustomerBookings from "./components/customer/CustomerBookings"
import CustomerServices from "./components/customer/CustomerServices"
import CustomerVehicles from "./components/customer/CustomerVehicles"
import CustomerProfile from "./components/customer/CustomerProfile"
import CustomerPayments from "./components/customer/CustomerPayments"
import CustomerReviews from "./components/customer/CustomerReviews"
import CustomerNotifications from "./components/customer/CustomerNotifications"
import CustomerLoyalty from "./components/customer/CustomerLoyalty"
import CustomerDiscover from "./components/customer/CustomerDiscover"
import CustomerTracking from "./components/customer/CustomerTracking"
import CustomerChat from "./components/customer/CustomerChat"
import CustomerFavorites from "./components/customer/CustomerFavorites"
import CustomerReferral from "./components/customer/CustomerReferral"
import CustomerSupport from "./components/customer/CustomerSupport"
import CustomerClaims from "./components/customer/CustomerClaims"
import CustomerPartsMarketplace from "./components/customer/CustomerPartsMarketplace"
import Marketplace from "./components/marketplace/Marketplace"
import MyListings from "./components/marketplace/MyListings"
import MyOffers from "./components/marketplace/MyOffers"
import EscrowManager from "./components/marketplace/EscrowManager"
import CreateListing from "./components/marketplace/CreateListing"
import CustomerGoService from "./components/customer/CustomerGoService"
import CustomerVehicleReports from "./components/customer/CustomerVehicleReports"
import ProviderChat from "./components/provider/ProviderChat"
import ProviderDashboard from "./components/provider/ProviderDashboard"
import ProviderBookings from "./components/provider/ProviderBookings"
import ProviderServices from "./components/provider/ProviderServices"
import ProviderEarnings from "./components/provider/ProviderEarnings"
import ProviderAnalytics from "./components/provider/ProviderAnalytics"
import ProviderReviews from "./components/provider/ProviderReviews"
import ProviderBusinessHours from "./components/provider/ProviderBusinessHours"
import ProviderPayouts from "./components/provider/ProviderPayouts"
import ProviderNotifications from "./components/provider/ProviderNotifications"
import ProviderAvailability from "./components/provider/ProviderAvailability"
import ProviderProfile from "./components/provider/ProviderProfile"
import ProviderInventory from "./components/provider/ProviderInventory"
import ProviderOrders from "./components/provider/ProviderOrders"
import ProviderMechanics from "./components/provider/ProviderMechanics"
import ProviderGoRequests from "./components/provider/ProviderGoRequests"
import ProviderClaims from "./components/provider/ProviderClaims"
import DriverChat from "./components/driver/DriverChat"
import DriverClaims from "./components/driver/DriverClaims"
import DriverOverview from "./components/driver/DriverOverview"
import DriverAvailableJobs from "./components/driver/DriverAvailableJobs"
import DriverActiveDelivery from "./components/driver/DriverActiveDelivery"
import DriverEarnings from "./components/driver/DriverEarnings"
import DriverReviews from "./components/driver/DriverReviews"
import DriverPayouts from "./components/driver/DriverPayouts"
import DriverVehicle from "./components/driver/DriverVehicle"
import DriverNotifications from "./components/driver/DriverNotifications"
import DriverProfile from "./components/driver/DriverProfile"
import AdminDashboard from "./components/admin/AdminDashboard"
import AdminUsers from "./components/admin/AdminUsers"
import AdminBookings from "./components/admin/AdminBookings"
import AdminServices from "./components/admin/AdminServices"
import AdminRevenue from "./components/admin/AdminRevenue"
import AdminPayouts from "./components/admin/AdminPayouts"
import AdminRefunds from "./components/admin/AdminRefunds"
import AdminPromos from "./components/admin/AdminPromos"
import AdminReviews from "./components/admin/AdminReviews"
import AdminLoyalty from "./components/admin/AdminLoyalty"
import AdminProviders from "./components/admin/AdminProviders"
import AdminDrivers from "./components/admin/AdminDrivers"
import AdminCategories from "./components/admin/AdminCategories"
import Admin2FA from "./components/admin/Admin2FA"
import Admin2FAVerify from "./components/admin/Admin2FAVerify"
import AdminSupport from "./components/admin/AdminSupport"
import AdminNotifications from "./components/admin/AdminNotifications"
import AdminHealth from "./components/admin/AdminHealth"
import AdminMarketplace from "./components/admin/AdminMarketplace"
import AdminMechanics from "./components/admin/AdminMechanics"
import AdminDisputes from "./components/admin/AdminDisputes"
import AdminClaims from "./components/admin/AdminClaims"
import AdminEmployees from "./components/admin/AdminEmployees"
import AdminOrders from "./components/admin/AdminOrders"
import AdminInventory from "./components/admin/AdminInventory"
import AdminPaymentTracking from "./components/admin/AdminPaymentTracking"

const ADMIN_SECRET = "ccc-admin-x7k9m2p4q8"

function Loader({ text }) {
  return (
    <div style={{ minHeight:"100vh", background:"#0a0a0a", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ color:"#e6821e", fontFamily:"Syne,sans-serif", fontSize:16 }}>{text}</div>
    </div>
  )
}

function NotFound() {
  return (
    <div style={{ minHeight:"100vh", background:"#0a0a0a", display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:12, fontFamily:"'DM Sans',sans-serif" }}>
      <div style={{ fontSize:64, color:"#f0ede6" }}>404</div>
      <div style={{ fontFamily:"Syne", fontSize:20, fontWeight:800, color:"#f0ede6" }}>Page not found</div>
      <div style={{ fontSize:13, color:"#555" }}>The page you are looking for does not exist.</div>
      <a href="/auth" style={{ color:"#e6821e", fontSize:13, marginTop:8 }}>Go home</a>
    </div>
  )
}

function ProtectedRoute({ children }) {
  const { user, loading, profile } = useAuth()
  if (loading || (user && !profile)) return <Loader text="Loading..." />
  if (!user) return <Navigate to="/auth" replace />
  return children
}

function AdminProtectedRoute({ children }) {
  const { user, profile, loading } = useAuth()
  if (loading || (user && !profile)) return <Loader text="Loading..." />
  if (!user) return <Navigate to={`/${ADMIN_SECRET}`} replace />
  if (profile && profile.role !== "admin") return <Navigate to="/auth" replace />
  return children
}

function Admin2FAGate({ children }) {
  const { user } = useAuth()
  const [verified, setVerified] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    async function check() {
      if (!user) { setChecking(false); return }
      try {
        const { data } = await supabase.from("admin_2fa")
          .select("is_enabled")
          .eq("user_id", user.id)
          .maybeSingle()
        if (!data?.is_enabled) setVerified(true)
      } catch {
        setVerified(true)
      }
      setChecking(false)
    }
    check()
  }, [user])

  if (checking) return <Loader text="Checking security..." />
  if (!verified) return <Admin2FAVerify onVerified={() => setVerified(true)} />
  return children
}

function DashboardRouter() {
  const { profile, loading } = useAuth()
  if (loading || !profile) return <Loader text="Loading your dashboard..." />
  const role = profile.role
  if (role === "admin") return <Navigate to={`/${ADMIN_SECRET}`} replace />
  if (!["customer","provider","driver"].includes(role)) return <Loader text="Loading your dashboard..." />

  return (
    <Layout>
      <Routes>
        {role === "customer" && <>
          <Route index element={<CustomerDashboard />} />
          <Route path="bookings" element={<CustomerBookings />} />
          <Route path="services" element={<CustomerServices />} />
          <Route path="vehicles" element={<CustomerVehicles />} />
          <Route path="discover" element={<CustomerDiscover />} />
          <Route path="tracking" element={<CustomerTracking />} />
          <Route path="loyalty" element={<CustomerLoyalty />} />
          <Route path="payments" element={<CustomerPayments />} />
          <Route path="reviews" element={<CustomerReviews />} />
          <Route path="notifications" element={<CustomerNotifications />} />
          <Route path="chat" element={<CustomerChat />} />
          <Route path="favorites" element={<CustomerFavorites />} />
          <Route path="referral" element={<CustomerReferral />} />
          <Route path="support" element={<CustomerSupport />} />
          <Route path="emergency" element={<CustomerGoService />} />
          <Route path="vehicle-reports" element={<CustomerVehicleReports />} />
          <Route path="claims" element={<CustomerClaims />} />
          <Route path="parts" element={<CustomerPartsMarketplace />} />
          <Route path="marketplace" element={<Marketplace />} />
          <Route path="marketplace/new" element={<CreateListing />} />
          <Route path="marketplace/my-listings" element={<MyListings />} />
          <Route path="marketplace/my-offers" element={<MyOffers />} />
          <Route path="marketplace/transactions" element={<EscrowManager />} />
          <Route path="profile" element={<CustomerProfile />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </>}
        {role === "provider" && <>
          <Route index element={<ProviderDashboard />} />
          <Route path="bookings" element={<ProviderBookings />} />
          <Route path="services" element={<ProviderServices />} />
          <Route path="earnings" element={<ProviderEarnings />} />
          <Route path="analytics" element={<ProviderAnalytics />} />
          <Route path="reviews" element={<ProviderReviews />} />
          <Route path="hours" element={<ProviderBusinessHours />} />
          <Route path="availability" element={<ProviderAvailability />} />
          <Route path="payouts" element={<ProviderPayouts />} />
          <Route path="notifications" element={<ProviderNotifications />} />
          <Route path="chat" element={<ProviderChat />} />
          <Route path="mechanics" element={<ProviderMechanics />} />
          <Route path="go-requests" element={<ProviderGoRequests />} />
          <Route path="claims" element={<ProviderClaims />} />
          <Route path="marketplace" element={<Marketplace />} />
          <Route path="marketplace/new" element={<CreateListing />} />
          <Route path="marketplace/my-listings" element={<MyListings />} />
          <Route path="marketplace/my-offers" element={<MyOffers />} />
          <Route path="marketplace/transactions" element={<EscrowManager />} />
          <Route path="profile" element={<ProviderProfile />} />
          <Route path="inventory" element={<ProviderInventory />} />
          <Route path="orders" element={<ProviderOrders />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </>}
        {role === "driver" && <>
          <Route index element={<DriverOverview />} />
          <Route path="jobs" element={<DriverAvailableJobs />} />
          <Route path="active" element={<DriverActiveDelivery />} />
          <Route path="history" element={<DriverEarnings />} />
          <Route path="reviews" element={<DriverReviews />} />
          <Route path="earnings" element={<DriverEarnings />} />
          <Route path="payouts" element={<DriverPayouts />} />
          <Route path="vehicle" element={<DriverVehicle />} />
          <Route path="notifications" element={<DriverNotifications />} />
          <Route path="chat" element={<DriverChat />} />
              <Route path="claims" element={<DriverClaims />} />
          <Route path="profile" element={<DriverProfile />} />
          <Route path="marketplace" element={<Marketplace />} />
          <Route path="marketplace/new" element={<CreateListing />} />
          <Route path="marketplace/my-listings" element={<MyListings />} />
          <Route path="marketplace/my-offers" element={<MyOffers />} />
          <Route path="marketplace/transactions" element={<EscrowManager />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </>}
      </Routes>
    </Layout>
  )
}

function AdminDashboardRouter() {
  return (
    <Layout>
      <Admin2FAGate>
        <Routes>
          <Route index element={<AdminDashboard />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="bookings" element={<AdminBookings />} />
          <Route path="services" element={<AdminServices />} />
          <Route path="revenue" element={<AdminRevenue />} />
          <Route path="payouts" element={<AdminPayouts />} />
          <Route path="refunds" element={<AdminRefunds />} />
          <Route path="promos" element={<AdminPromos />} />
          <Route path="reviews" element={<AdminReviews />} />
          <Route path="loyalty" element={<AdminLoyalty />} />
          <Route path="categories" element={<AdminCategories />} />
          <Route path="security" element={<Admin2FA />} />
          <Route path="support" element={<AdminSupport />} />
              <Route path="notifications" element={<AdminNotifications />} />
              <Route path="health" element={<AdminHealth />} />
              <Route path="marketplace" element={<AdminMarketplace />} />
          <Route path="employees" element={<AdminEmployees />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="inventory" element={<AdminInventory />} />
          <Route path="payment-tracking" element={<AdminPaymentTracking />} />
          <Route path="providers" element={<AdminProviders />} />
          <Route path="drivers" element={<AdminDrivers />} />
          <Route path="mechanics" element={<AdminMechanics />} />
          <Route path="disputes" element={<AdminDisputes />} />
              <Route path="claims" element={<AdminClaims />} />
          <Route path="*" element={<Navigate to="/admin-dashboard" replace />} />
        </Routes>
      </Admin2FAGate>
    </Layout>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <BrowserRouter>
            <Toaster position="top-right" toastOptions={{ style:{ background:"#1a1a1a", color:"#f0ede6", border:"1px solid #2a2a2a", borderRadius:8, fontSize:13 } }} />
            <Routes>
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/payment/callback" element={<PaymentCallback />} />
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route path="/terms" element={<TermsOfService />} />
              <Route path={`/${ADMIN_SECRET}`} element={<AdminAuthPage />} />
              <Route path="/admin-dashboard/*" element={<AdminProtectedRoute><AdminDashboardRouter /></AdminProtectedRoute>} />
              <Route path="/dashboard/*" element={<ProtectedRoute><DashboardRouter /></ProtectedRoute>} />
              <Route path="/not-found" element={<NotFound />} />
              <Route path="/" element={<LandingPage />} />
              <Route path="*" element={<Navigate to="/auth" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  )
}





















