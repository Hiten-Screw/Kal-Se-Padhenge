require('dotenv').config()
const { createClient } = require('@supabase/supabase-js')
const express = require('express')
const path = require('path')
const app = express()
const port = 4000

// Supabase Configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

console.log("DEBUG: Supabase URL:", supabaseUrl);
console.log("DEBUG: Supabase Key starts with:", supabaseKey ? supabaseKey.substring(0, 10) + "..." : "UNDEFINED");

const supabase = createClient(supabaseUrl, supabaseKey);

// Serve static files from the root directory
app.use(express.static(path.join(__dirname)))
app.use(express.json())

// Config Endpoint for Frontend
app.get('/api/config', (req, res) => {
  res.json({
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseKey: process.env.SUPABASE_KEY // IMPORTANT: User should ensure this is the ANON key if exposing to frontend
  });
});

// Middleware to extract user ID from query (simple auth for demo)
// Ideally, verify the JWT token from headers
const getUserId = (req) => {
  return req.query.userId;
}

// API Endpoints
app.get('/api/dashboard', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'User ID required' });

  try {
    // 1. Get Net Credit (RPC)
    const { data: netCredit, error: netError } = await supabase
      .rpc('get_user_net_balance', { user_uuid: userId });

    if (netError) throw netError;

    // 2. Get Friends and their balances
    // Query Friends table to get friend IDs
    const { data: friendsParams, error: friendsError } = await supabase
      .from('Friends')
      .select('id, user1_id, user2_id, status')
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
      .eq('status', 'accepted'); // Assuming we only show accepted friends

    if (friendsError) throw friendsError;

    const friendsList = [];
    for (const f of friendsParams) {
      const friendId = f.user1_id === userId ? f.user2_id : f.user1_id;

      // Get Friend Profile
      const { data: profile } = await supabase
        .from('Profile')
        .select('username')
        .eq('id', friendId)
        .single();

      // Get Balance with this friend (RPC)
      const { data: balance } = await supabase
        .rpc('get_friend_balance', { my_id: userId, friend_id: friendId });

      if (profile) {
        friendsList.push({
          name: profile.username,
          amount: balance, // Positive means they owe me (Credit), Negative means I owe them (Debit)
          type: balance >= 0 ? 'Credit' : 'Debit'
        });
      }
    }

    res.json({
      netCredit: netCredit || 0,
      friends: friendsList
    });

  } catch (err) {
    console.error("Error fetching dashboard data:", err);
    res.status(500).json({ error: err.message });
  }
})

app.get('/api/friends', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'User ID required' });

  try {
    // Get Groups
    const { data: groups, error } = await supabase
      .from('Group_Members')
      .select('group_id, Groups(name)')
      .eq('user_id', userId)
      .eq('status', 'joined');

    if (error) throw error;

    // This is a simplified view, actual member count needs more queries or a view
    const groupList = groups.map(g => ({
      name: g.Groups.name,
      members: 'Unknown' // To perform count, we need another query
    }));

    res.json(groupList);
  } catch (err) {
    console.error("Error fetching friends/groups data:", err);
    res.status(500).json({ error: err.message });
  }
})

app.post('/api/expense', async (req, res) => {
  const { userId, query, amount: bodyAmount, description: bodyDesc, targetUsername: bodyTarget } = req.body;

  if (!userId) return res.status(400).json({ error: 'Missing userId' });

  console.log(`Processing expense. User: ${userId}`);

  try {
    let amount, description, targetUsername;

    if (bodyAmount && bodyDesc && bodyTarget) {
      // Structured Input
      amount = parseFloat(bodyAmount);
      description = bodyDesc;
      targetUsername = bodyTarget;
    } else if (query) {
      // Regex Parser: "I paid 500 for lunch with Abhi"
      const regex = /paid\s+(\d+)\s+for\s+(.+?)\s+with\s+(.+)/i;
      const match = query.match(regex);

      if (!match) {
        return res.status(400).json({
          error: 'Could not parse query. Try format: "paid [amount] for [description] with [name]"'
        });
      }

      amount = parseFloat(match[1]);
      description = match[2].trim();
      targetUsername = match[3].trim();
    } else {
      return res.status(400).json({ error: 'Missing expense details (query or structured fields)' });
    }

    // Call RPC function
    const { error } = await supabase.rpc('create_expense_automated', {
      sender_id: userId,
      target_username: targetUsername,
      final_amount: amount,
      expense_description: description,
      target_group_id: null // Optional, default null
    });

    if (error) throw error;

    res.json({ success: true, message: `Expense recorded: You paid ${amount} for ${description} with ${targetUsername}` });

  } catch (err) {
    console.error("Error creating expense:", err);
    res.status(500).json({ error: err.message });
  }
})

app.get('/api/profile', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'User ID required' });

  try {
    // Try to get profile
    let { data: profile, error } = await supabase
      .from('Profile')
      .select('*')
      .eq('id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    // If not found, create it
    if (!profile) {
      console.log(`Profile missing for ${userId}. Creating...`);
      const userEmail = req.query.email;
      if (!userEmail) {
        return res.status(400).json({ error: 'Profile not found and email not provided for creation' });
      }

      const username = userEmail.split('@')[0];
      const { data: newProfile, error: createError } = await supabase
        .from('Profile')
        .insert([{ id: userId, email: userEmail, username: username }])
        .select()
        .single();

      if (createError) throw createError;
      profile = newProfile;
    }

    res.json(profile);

  } catch (err) {
    console.error("Error fetching/creating profile:", err);
    res.status(500).json({ error: err.message });
  }
})

// Fallback to index.html for SPA handling if needed (optional for now since we just serve root)
app.get(/(.*)/, (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})

