require('dotenv').config()
const { createClient } = require('@supabase/supabase-js')
const express = require('express')
const path = require('path')
const app = express()
const port = 4000




app.use(express.static(path.join(__dirname)))
app.use(express.json())

// Config Endpoint for Frontend
app.get('/api/config', (req, res) => {
  res.json({
    supabaseUrl: supabaseUrl,
    supabaseKey: supabaseKey
  });
});


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


app.get(/(.*)/, (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})

