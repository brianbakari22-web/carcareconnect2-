importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyCWgelL795G6-JQPU0LKz_Bgg3AF2-xGOk",
  authDomain: "car-care-connect-a3bc8.firebaseapp.com",
  projectId: "car-care-connect-a3bc8",
  storageBucket: "car-care-connect-a3bc8.firebasestorage.app",
  messagingSenderId: "62459160532",
  appId: "1:62459160532:web:db2a7d30de20b66c6bd841"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log("Background message:", payload);
  const { title, body } = payload.notification || {};
  self.registration.showNotification(title || "Car Care Connect", {
    body: body || "",
    icon: "/logo.svg",
    badge: "/logo.svg"
  });
});