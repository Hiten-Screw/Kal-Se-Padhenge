// Import express framework to create server and APIs
import express from "express";

// Import dotenv to read values from .env file
import dotenv from "dotenv";

// Import Supabase client to talk to PostgreSQL
import { createClient } from "@supabase/supabase-js";

// Load environment variables from .env file
dotenv.config();

// Create an express application
const app = express();

// This allows server to read JSON data sent from frontend
app.use(express.json());

// Create Supabase client using project URL and secret key
// SERVICE ROLE KEY is used because function is SECURITY DEFINER
 // Secret key (backend only)
const supabase = createClient(
    process.env.SUPABASE_URL,               // Supabase project URL
    process.env.SUPABASE_SERVICE_KEY   // Service role key (backend only)
);
// API endpoint to create an expense
// Frontend will call this using POST request
app.post("/expense/create", async (req, res) => {
  try {
    // Get values sent from frontend (request body)
    const {
      sender_id,            // UUID of logged-in user
      target_username,      // Username of friend
      final_amount,         // Expense amount
      expense_description,  // Description of expense
      target_group_id       // Group ID (can be null)
    } = req.body;

    // Call PostgreSQL function using Supabase RPC
    const { error } = await supabase.rpc(
      "create_expense_automated", // SQL function name
      {
        sender_id,            // Passed to SQL function
        target_username,
        final_amount,
        expense_description,
        target_group_id
      }
    );

    // If PostgreSQL throws an error, send error to frontend
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    // If everything works, send success response
    res.status(200).json({
      success: true,
      message: "Expense added successfully"
    });

  } catch (err) {
    // Handles unexpected server errors
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

// Start the server on port 4000
app.listen(4000, () => {
  console.log("Server running on port 4000");
});
