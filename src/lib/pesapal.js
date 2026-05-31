const PESAPAL_CONSUMER_KEY = "B+doIBx+u3quT04kc/9C1Z0qYN2xxUI8"
const PESAPAL_CONSUMER_SECRET = "xOWzVuH+DKNGQDgHvgOsHgafuY4="
const PESAPAL_BASE_URL = "https://cybqa.pesapal.com/pesapalv3"

export async function getPesapalToken() {
  const res = await fetch(PESAPAL_BASE_URL + "/api/Auth/RequestToken", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify({
      consumer_key: PESAPAL_CONSUMER_KEY,
      consumer_secret: PESAPAL_CONSUMER_SECRET
    })
  })
  const data = await res.json()
  return data.token
}

export async function registerIPN(token) {
  const res = await fetch(PESAPAL_BASE_URL + "/api/URLSetup/RegisterIPN", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "Authorization": "Bearer " + token
    },
    body: JSON.stringify({
      url: "https://carcareconnect2.pages.dev/api/pesapal-ipn",
      ipn_notification_type: "GET"
    })
  })
  const data = await res.json()
  return data.ipn_id
}

export async function submitOrder(token, ipnId, orderData) {
  const { amount, currency, description, bookingId, customerEmail, customerPhone, customerName } = orderData
  const nameParts = (customerName || "Customer").split(" ")
  const res = await fetch(PESAPAL_BASE_URL + "/api/Transactions/SubmitOrderRequest", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "Authorization": "Bearer " + token
    },
    body: JSON.stringify({
      id: bookingId,
      currency: currency || "KES",
      amount: amount,
      description: description || "Car Care Connect payment",
      callback_url: "https://carcareconnect2.pages.dev/payment/callback",
      notification_id: ipnId,
      billing_address: {
        email_address: customerEmail || "",
        phone_number: customerPhone || "",
        first_name: nameParts[0] || "",
        last_name: nameParts[1] || "",
        country_code: "KE"
      }
    })
  })
  const data = await res.json()
  return data
}

export async function getTransactionStatus(token, orderTrackingId) {
  const res = await fetch(PESAPAL_BASE_URL + "/api/Transactions/GetTransactionStatus?orderTrackingId=" + orderTrackingId, {
    headers: {
      "Accept": "application/json",
      "Authorization": "Bearer " + token
    }
  })
  const data = await res.json()
  return data
}
