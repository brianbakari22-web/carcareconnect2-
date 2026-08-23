import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { SplashScreen } from "@capacitor/splash-screen"
import { Capacitor } from "@capacitor/core"
import { App as CapApp } from "@capacitor/app"
import PublicServicePage from "./components/public/PublicServicePage"
import PublicItemPage from "./components/public/PublicItemPage"
import { initPushNotifications } from "./lib/pushNotifications"
import React, { useState, useEffect } from "react"
import { supabase } from "./lib/supabase"
import MechanicLogin from "./components/mechanic/MechanicLogin"
import MechanicDashboard from "./components/mechanic/MechanicDashboard"
import { MechanicAuthProvider } from "./contexts/MechanicAuthContext"

// Global error handler - logs ALL uncaught errors to error_logs table for admin Live Error Tracker
if (typeof window !== "undefined") {
  window.onerror = function(msg, src, line, col, error) {
    try {
      import("./lib/supabase").then(({ supabase }) => {
        supabase.auth.getUser().then(({ data: { user } }) => {
          supabase.from("error_logs").insert({
            user_id: user?.id || null,
            error_message: String(msg).substring(0, 1000),
            error_source: src || "unknown",
            error_line: line || 0,
            error_col: col || 0,
            page_url: window.location.href,
          }).then(() => {}).catch(()=>{})
        }).catch(()=>{
          supabase.from("error_logs").insert({
            user_id: null,
            error_message: String(msg).substring(0, 1000),
            error_source: src || "unknown",
            error_line: line || 0,
            error_col: col || 0,
            page_url: window.location.href,
          }).then(() => {}).catch(()=>{})
        })
      }).catch(()=>{})
    } catch(_) { /* handled */ }
    console.error("UNCAUGHT ERROR:", { msg, src, line, col, stack: error?.stack })
    return false
  }

  window.addEventListener("unhandledrejection", function(event) {
    try {
      import("./lib/supabase").then(({ supabase }) => {
        supabase.auth.getUser().then(({ data: { user } }) => {
          supabase.from("error_logs").insert({
            user_id: user?.id || null,
            error_message: ("Unhandled promise rejection: " + (event.reason?.message || event.reason || "unknown")).substring(0, 1000),
            error_source: "promise",
            error_line: 0,
            error_col: 0,
            page_url: window.location.href,
          }).then(() => {}).catch(()=>{})
        }).catch(()=>{})
      }).catch(()=>{})
    } catch(_) { /* handled */ }
    console.error("UNHANDLED REJECTION:", event.reason)
  })
}

import { Toaster } from "react-hot-toast"
import { AuthProvider, useAuth } from "./contexts/AuthContext"
import { LanguageProvider } from "./contexts/LanguageContext"
import { ThemeProvider } from "./contexts/ThemeContext"

import AuthPage from "./components/auth/AuthPage"
import LandingPage from "./components/landing/LandingPage"
import AppHomePage from "./components/landing/AppHomePage"
import PublicProviderStorefront from "./components/customer/PublicProviderStorefront"

import PrivacyPolicy from "./components/legal/PrivacyPolicy"
import TermsOfService from "./components/legal/TermsOfService"
import AdminAuthPage from "./components/auth/AdminAuthPage"
import ResetPassword from "./components/auth/ResetPassword"
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
import CustomerTripReports from "./components/customer/CustomerTripReports"
import CustomerChat from "./components/customer/CustomerChat"
import CustomerFavorites from "./components/customer/CustomerFavorites"
import CustomerReferral from "./components/customer/CustomerReferral"
import CustomerSupport from "./components/customer/CustomerSupport"
import ProviderSupport from "./components/provider/ProviderSupport"
import ProviderCustomerReviews from "./components/provider/ProviderCustomerReviews"
import DriverSupport from "./components/driver/DriverSupport"
import CustomerClaims from "./components/customer/CustomerClaims"
import CustomerPartsMarketplace from "./components/customer/CustomerPartsMarketplace"
import Marketplace from "./components/marketplace/Marketplace"
import MyListings from "./components/marketplace/MyListings"
import MyOffers from "./components/marketplace/MyOffers"
import EscrowManager from "./components/marketplace/EscrowManager"
import CreateListing from "./components/marketplace/CreateListing"
import CustomerGoService from "./components/customer/CustomerGoService"
import CustomerVehicleReports from "./components/customer/CustomerVehicleReports"
import WashQueue from "./components/provider/WashQueue"
import WashPackages from "./components/provider/WashPackages"
import StaffManagement from "./components/provider/StaffManagement"





import ProviderChat from "./components/provider/ProviderChat"
import ProviderDashboard from "./components/provider/ProviderDashboard"
import ProviderBookings from "./components/provider/ProviderBookings"
import ProviderServices from "./components/provider/ProviderServices"
import ProviderBundles from "./components/provider/ProviderBundles"
import ProviderEarnings from "./components/provider/ProviderEarnings"
import ProviderAnalytics from "./components/provider/ProviderAnalytics"
import ProviderQRCode from "./components/provider/ProviderQRCode"
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
import DriverDeliveries from "./components/driver/DriverDeliveries"
import DriverEarnings from "./components/driver/DriverEarnings"
import DriverReviews from "./components/driver/DriverReviews"
import DriverPayouts from "./components/driver/DriverPayouts"
import DriverVehicle from "./components/driver/DriverVehicle"
import DriverPerformance from "./components/driver/DriverPerformance"
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
import AdminLiveMap from "./components/admin/AdminLiveMap"
import AdminTripReports from "./components/admin/AdminTripReports"
import AdminCategories from "./components/admin/AdminCategories"
import Admin2FA from "./components/admin/Admin2FA"
import Admin2FAVerify from "./components/admin/Admin2FAVerify"
import AdminSupport from "./components/admin/AdminSupport"
import AdminNotifications from "./components/admin/AdminNotifications"
import AdminHealth from "./components/admin/AdminHealth"
import AdminMarketplace from "./components/admin/AdminMarketplace"
import AdminPenalties from "./components/admin/AdminPenalties"
import AdminMechanics from "./components/admin/AdminMechanics"
import AdminDisputes from "./components/admin/AdminDisputes"
import AdminClaims from "./components/admin/AdminClaims"
import AdminEmployees from "./components/admin/AdminEmployees"
import AdminOrders from "./components/admin/AdminOrders"
import AdminInventory from "./components/admin/AdminInventory"
import AdminSystemDiagnostics from "./components/admin/AdminSystemDiagnostics"
import AdminCommissions from "./components/admin/AdminCommissions"
import AdminSettings from "./components/admin/AdminSettings"
import AdminQRCode from "./components/admin/AdminQRCode"
import AdminContentHub from "./components/admin/AdminContentHub"
import AdminNewCars from "./components/admin/AdminNewCars"
import NewCarMarketplace from "./components/customer/NewCarMarketplace"
import MyNewCarListings from "./components/customer/MyNewCarListings"
import AdminDriverVetting from "./components/admin/AdminDriverVetting"
import DriverApplication from "./components/driver/DriverApplication"
import AdminPaymentTracking from "./components/admin/AdminPaymentTracking"
import AdminFailedJobs from "./components/admin/AdminFailedJobs"
import AdminDeletionRequests from "./components/admin/AdminDeletionRequests"

const ADMIN_SECRET = import.meta.env.VITE_ADMIN_SECRET || "ccc-admin-x7k9m2p4q8"

function Loader({ text }) {
  return (
    <div style={{ minHeight:"100vh", background:"#ffffff", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ color:"#e6821e", fontFamily:"Syne,sans-serif", fontSize:16 }}>{text}</div>
    </div>
  )
}

function NotFound() {
  return (
    <div style={{ minHeight:"100vh", background:"#ffffff", display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:12, fontFamily:"'DM Sans',sans-serif" }}>
      <div style={{ fontSize:64, color:"#000000" }}>404</div>
      <div style={{ fontFamily:"Syne", fontSize:20, fontWeight:800, color:"#000000" }}>Page not found</div>
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
  if (profile && profile?.role !== "admin") return <Navigate to="/auth" replace />
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
  const role = profile?.role
  if (role === "admin") return <Navigate to="/admin-dashboard" replace />
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
          <Route path="tracking" element={<CustomerTracking />} />
<Route path="trip-reports" element={<CustomerTripReports />} />
          <Route path="my-car-listings" element={<MyNewCarListings />} />
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
          <Route path="parts" element={<Navigate to="/dashboard/marketplace?tab=parts_shop" replace />} />
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
          <Route path="bundles" element={<ProviderBundles />} />
          <Route path="earnings" element={<ProviderEarnings />} />
          <Route path="analytics" element={<ProviderAnalytics />} />
              <Route path="qrcode" element={<ProviderQRCode />} />
              <Route path="new-cars" element={<NewCarMarketplace />} />
          <Route path="reviews" element={<ProviderReviews />} />
          <Route path="hours" element={<ProviderBusinessHours />} />
          <Route path="availability" element={<ProviderAvailability />} />
          <Route path="payouts" element={<ProviderPayouts />} />
          <Route path="business-hours" element={<ProviderBusinessHours />} />
          <Route path="notifications" element={<ProviderNotifications />} />
          <Route path="chat" element={<ProviderChat />} />
          <Route path="mechanics" element={<ProviderMechanics />} />
          <Route path="go-requests" element={<ProviderGoRequests />} />
          <Route path="claims" element={<ProviderClaims />} />
          <Route path="support" element={<ProviderSupport />} />
          <Route path="customer-reviews" element={<ProviderCustomerReviews />} />
          <Route path="marketplace" element={<Marketplace />} />
          <Route path="marketplace/new" element={<CreateListing />} />
          <Route path="marketplace/my-listings" element={<MyListings />} />
          <Route path="marketplace/my-offers" element={<MyOffers />} />
          <Route path="marketplace/transactions" element={<EscrowManager />} />
          <Route path="profile" element={<ProviderProfile />} />
          <Route path="wash-queue" element={<WashQueue />} />
          <Route path="wash-packages" element={<WashPackages />} />
          <Route path="staff" element={<StaffManagement />} />
          <Route path="inventory" element={<ProviderInventory />} />
          <Route path="orders" element={<ProviderOrders />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </>}
        {role === "driver" && <>
          <Route index element={<DriverOverview />} />
          <Route path="jobs" element={<DriverAvailableJobs />} />
          <Route path="active" element={<DriverActiveDelivery />} />
              <Route path="deliveries" element={<DriverDeliveries />} />
          <Route path="history" element={<DriverEarnings />} />
          <Route path="reviews" element={<DriverReviews />} />
          <Route path="earnings" element={<DriverEarnings />} />
          <Route path="payouts" element={<DriverPayouts />} />
          <Route path="vehicle" element={<DriverVehicle />} />
          <Route path="performance" element={<DriverPerformance />} />
          <Route path="application" element={<DriverApplication />} />
          <Route path="performance" element={<DriverPerformance />} />
          <Route path="notifications" element={<DriverNotifications />} />
          <Route path="chat" element={<DriverChat />} />
          <Route path="support" element={<DriverSupport />} />
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
          <Route path="diagnostics" element={<AdminSystemDiagnostics />} />
          <Route path="commissions" element={<AdminCommissions />} />
          <Route path="settings" element={<AdminSettings />} />
              <Route path="qrcode" element={<AdminQRCode />} />
              <Route path="content-hub" element={<AdminContentHub />} />
              <Route path="new-cars" element={<AdminNewCars />} />
          <Route path="driver-vetting" element={<AdminDriverVetting />} />
          <Route path="payment-tracking" element={<AdminPaymentTracking />} />
              <Route path="failed-jobs" element={<AdminFailedJobs />} />
              <Route path="deletion-requests" element={<AdminDeletionRequests />} />
          <Route path="providers" element={<AdminProviders />} />
          <Route path="drivers" element={<AdminDrivers />} />
          <Route path="drivers" element={<AdminDrivers />} />
<Route path="live-map" element={<AdminLiveMap />} />
<Route path="trip-reports" element={<AdminTripReports />} />
          <Route path="mechanics" element={<AdminMechanics />} />
          <Route path="disputes" element={<AdminDisputes />} />
          <Route path="penalties" element={<AdminPenalties />} />
              <Route path="claims" element={<AdminClaims />} />
          <Route path="*" element={<Navigate to="/admin-dashboard" replace />} />
        </Routes>
      </Admin2FAGate>
    </Layout>
  )
}


// Check for new app version every 5 minutes
if (typeof window !== "undefined") {
  let lastVersion = null;
  async function checkForUpdate() {
    try {
      const res = await fetch("/index.html?cachebust=" + Date.now(), { cache:"no-store" });
      const html = await res.text();
      const match = html.match(/index-([^"]+).js/);
      const version = match ? match[1] : null;
      if (lastVersion && version && lastVersion !== version) {
        // New version detected - show toast
        if (window.__ccc_update_toast_shown) return;
        window.__ccc_update_toast_shown = true;
        const toast = document.createElement("div");
        toast.innerHTML = `<div style="position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#1a1a1a;color:#fff;padding:12px 20px;border-radius:12px;z-index:99999;display:flex;align-items:center;gap:12px;box-shadow:0 4px 20px rgba(0,0,0,0.3);font-family:DM Sans,sans-serif;font-size:13px;white-space:nowrap">
          <span>🆕 New version available</span>
          <button onclick="window.location.reload()" style="background:#e6821e;border:none;border-radius:8px;color:#fff;padding:6px 14px;cursor:pointer;font-weight:700;font-size:12px">Update</button>
        </div>`;
        document.body.appendChild(toast);
      }
      lastVersion = version;
    } catch(e) {}
  }
  checkForUpdate();
  setInterval(checkForUpdate, 5 * 60 * 1000);
}

export default function App() {
  const [forceUpdate, setForceUpdate] = useState(false)
  const [updateMessage, setUpdateMessage] = useState("")
  useEffect(() => {
    async function checkVersion() {
      if (!Capacitor.isNativePlatform()) return
      try {
        const { data: minV } = await supabase.from("app_settings").select("value").eq("key","min_app_version").maybeSingle()
        const { data: msgV } = await supabase.from("app_settings").select("value").eq("key","force_update_message").maybeSingle()
        const info = await CapApp.getInfo()
        const currentCode = parseInt(info.build||"0")
        const minCode = parseInt(minV?.value||"0")
        if (currentCode < minCode) {
          setUpdateMessage(msgV?.value||"Please update Car Care Connect to continue.")
          setForceUpdate(true)
        }
      } catch(e) { console.log("Version check:", e.message) }
    }
    checkVersion()
  }, [])
  useEffect(() => {
    // Hide native splash when React app is ready
    setTimeout(async () => {
      try {
        await SplashScreen.hide({ fadeOutDuration: 800 })
      } catch(e) { console.log("Splash already hidden") }
    }, 1800)
  }, [])
  React.useEffect(() => {
    (async () => {
      try {
        const { Capacitor } = await import("@capacitor/core")
        if (!Capacitor.isNativePlatform()) return
        const { App: CapApp } = await import("@capacitor/app")
        const { Browser } = await import("@capacitor/browser")
        CapApp.addListener("appUrlOpen", async ({ url }) => {
          if (url.includes("auth-callback")) {
            await Browser.close()
            const hash = url.split("#")[1]
            if (hash) {
              const params = new URLSearchParams(hash)
              const access_token = params.get("access_token")
              const refresh_token = params.get("refresh_token")
              if (access_token && refresh_token) {
                await supabase.auth.setSession({ access_token, refresh_token })
                window.location.href = "/dashboard"
              }
            }
          }
        })
      } catch (e) {
        console.error("Deep link setup error:", e)
      }
    })()
  }, [])
  if (forceUpdate) return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", padding:"2rem", background:"#f8f8f8", fontFamily:"DM Sans,sans-serif" }}>
      <div style={{ background:"#fff", borderRadius:16, padding:"2rem", maxWidth:360, width:"100%", textAlign:"center", boxShadow:"0 4px 24px rgba(0,0,0,0.08)" }}>
        <div style={{ fontSize:48, marginBottom:16 }}>🚗</div>
        <div style={{ fontFamily:"Syne", fontSize:22, fontWeight:800, marginBottom:8 }}>Update Required</div>
        <div style={{ fontSize:14, color:"#666", lineHeight:1.6, marginBottom:24 }}>{updateMessage}</div>
        <a href="https://play.google.com/store/apps/details?id=care.carcareconnect.app"
          style={{ display:"block", background:"#e6821e", borderRadius:10, color:"#fff", fontFamily:"Syne,sans-serif", fontSize:15, fontWeight:700, padding:"14px", textDecoration:"none" }}>
          Update Now 🚀
        </a>
      </div>
    </div>
  )

  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <MechanicAuthProvider>
      <BrowserRouter>
            <Toaster position="top-right" toastOptions={{ style:{ background:"#ffffff", color:"#000000", border:"1px solid #eeeeee", borderRadius:8, fontSize:13 } }} />
            <Routes>
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/mechanic-login" element={<MechanicLogin/>}/>
              <Route path="/mechanic-dashboard" element={<MechanicDashboard/>}/>
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route path="/terms" element={<TermsOfService />} />
              <Route path={`/${ADMIN_SECRET}`} element={<AdminAuthPage />} />
              <Route path="/admin-dashboard/*" element={<AdminProtectedRoute><AdminDashboardRouter /></AdminProtectedRoute>} />
              <Route path="/dashboard/*" element={<ProtectedRoute><DashboardRouter /></ProtectedRoute>} />
              <Route path="/not-found" element={<NotFound />} />
              <Route path="/provider/:id" element={<PublicProviderStorefront />} />
              <Route path="/service/:id" element={<PublicServicePage />} />
              <Route path="/parts/:id" element={<PublicItemPage />} />
              <Route path="/" element={
                (() => {
                  // Show AppHomePage on native Android app (Capacitor)
                  const isNative = typeof window !== "undefined" &&
                    (window.Capacitor?.isNativePlatform?.() ||
                    window.matchMedia("(display-mode: standalone)").matches)
                  return isNative ? <AppHomePage /> : <LandingPage />
                })()
              } />
              <Route path="*" element={<Navigate to="/auth" replace />} />
            </Routes>
          </BrowserRouter>
      </MechanicAuthProvider>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  )
}



































