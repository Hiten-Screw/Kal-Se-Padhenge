const http = require("http");          // Import Node.js HTTP module
const crypto = require("crypto");      // Import crypto module for hashing
require("dotenv").config();            // Load environment variables from .env

// Create HTTP server
const server = http.createServer((req, res) => {

  // Handle order creation request
  if (req.method === "POST" && req.url === "/create-order") {

    const order_id = "order_" + Date.now();   // Generate unique order ID

    res.writeHead(200, {                     // Send success status
      "Content-Type": "text/html"            // Response is HTML
    });

    res.end(`                               // Send checkout HTML page
      <!DOCTYPE html>
      <html>
      <head>
        <title>Mock Checkout</title>
      </head>
      <body style="font-family:Arial;text-align:center">

        <h2>MockPay Checkout</h2>

        <form action="/verify" method="POST">   <!-- Send data to /verify -->
          <input type="hidden" name="order_id" value="${order_id}"> <!-- Store order ID -->

          <input type="text" placeholder="Card Number" required><br><br> <!-- Fake card input -->
          <input type="text" placeholder="Expiry" required><br><br>      <!-- Fake expiry -->
          <input type="password" placeholder="CVV" required><br><br>     <!-- Fake CVV -->

          <button type="submit">Pay ₹500</button> <!-- Submit payment -->
        </form>

      </body>
      </html>
    `);
  }

  // Handle payment verification
  else if (req.method === "POST" && req.url === "/verify") {

    let body = "";                            // Variable to collect form data

    req.on("data", chunk => body += chunk);   // Collect incoming data chunks

    req.on("end", () => {                     // Run after data is received

      const params = new URLSearchParams(body); // Parse form data
      const order_id = params.get("order_id");  // Extract order ID

      const payment_id = "pay_" + Date.now();   // Generate fake payment ID

      const signature = crypto                // Create payment signature
        .createHmac("sha256",                 // Use SHA256 hashing
          process.env.PAYMENT_KEY_SECRET)     // Use secret key from .env
        .update(order_id + "|" + payment_id)  // Combine order & payment IDs
        .digest("hex");                       // Convert hash to hex string

      res.writeHead(200, {                    // Send success response
        "Content-Type": "text/html"
      });

      res.end(`                               // Send payment success page
        <h2>Payment Successful ✅</h2>
        <p><b>Order ID:</b> ${order_id}</p>
        <p><b>Payment ID:</b> ${payment_id}</p>
        <p><b>Signature:</b> ${signature}</p>
      `);
    });
  }

  // Handle invalid routes
  else {
    res.writeHead(404);                       // Send 404 status
    res.end("Not Found");                     // Show error message
  }
});

// Start server on port 3000
server.listen(3000, () => {
  console.log("✅ Mock payment backend running successfully!");
  console.log("🌐 Server URL: http://localhost:3000");
  console.log("📝 Ready to accept requests on /create-order and /verify");
});
