export function loadFlutterwaveScript() {
  return new Promise((resolve) => {
    if (window.FlutterwaveCheckout) { resolve(); return }
    const script = document.createElement("script")
    script.src = "https://checkout.flutterwave.com/v3.js"
    script.onload = () => resolve()
    document.head.appendChild(script)
  })
}

export async function initFlutterwavePayment({ amount, currency = "KES", customer, bookingId, onSuccess, onClose }) {
  await loadFlutterwaveScript()
  window.FlutterwaveCheckout({
    public_key: "FLWPUBK_TEST-7cc800b81b21b4d7075e716052932f32-X",
    tx_ref: `CCC-${bookingId}-${Date.now()}`,
    amount: amount,
    currency: currency,
    payment_options: "card, mobilemoney",
    customer: {
      email: customer.email,
      phone_number: customer.phone || "0700000000",
      name: customer.name,
    },
    customizations: {
      title: "Car Care Connect",
      description: "Service booking payment",
    },
    callback: function(response) {
      console.log("Payment response:", response)
      if (response.status === "successful" || response.status === "completed") {
        onSuccess(response)
      }
    },
    onclose: function() {
      if (onClose) onClose()
    }
  })
}

export const FLW_CONFIGURED = true
