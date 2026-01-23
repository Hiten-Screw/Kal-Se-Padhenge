// SUPABASE AUTHENTICATION
// 1. Declare 'sb' globally but don't initialize it yet
let sb;

// 2. Create a single promise that handles the entire setup
const initPromise = fetch('/.netlify/functions/config') // Ensure this matches your index.js route
    .then(res => {
        if (!res.ok) throw new Error("Config fetch failed");
        return res.json();
    })
    .then(config => {
        // Use the global 'supabase' object from the CDN
        sb = supabase.createClient(config.supabaseUrl, config.supabaseKey);
        window.sb = sb; // For debugging in console
        console.log("✅ Supabase Client Ready");
    })
    .catch(err => {
        console.error("❌ Critical Initialization Error:", err);
    });

// console.log("DEBUG: Supabase URL:", supabaseUrl);
// console.log("DEBUG: Supabase Key starts with:", supabaseKey ? supabaseKey.substring(0, 10) + "..." : "UNDEFINED");

// window.sb = supabase.createClient(supabaseUrl, supabaseKey);
// 3. Debug to verify it's alive
console.log("✅ Supabase Client Initialized:", window.sb);

let supabaseClient;
let initializationPromise = null;
// 1. Add this variable at the very top of main.js (outside any function)
let isSyncing = false;

async function initApp() {
    // Return cached promise if already initialized or initializing
    if (initializationPromise) {
        return initializationPromise;
    }

    initializationPromise = (async () => {
        try {
            console.log("Starting app initialization...");

            let supabaseUrl, supabaseKey;

            // Try to fetch config from Netlify function (works with netlify dev)
            try {
                const configController = new AbortController();
                const configTimeout = setTimeout(() => configController.abort(), 5000); // 5 second timeout

                const response = await fetch('/.netlify/functions/config', { signal: configController.signal });
                clearTimeout(configTimeout);

                if (response.ok) {
                    const config = await response.json();
                    console.log("✅ Config loaded from Netlify function");
                    supabaseUrl = config.supabaseUrl;
                    supabaseKey = config.supabaseKey;
                } else {
                    throw new Error("Netlify config endpoint not available");
                }
            } catch (netlifyError) {
                console.log("ℹ️  Netlify function not available, trying /api/config...");

                // Try alternative API endpoint
                try {
                    const response = await fetch('/api/config', { signal: AbortSignal.timeout(5000) });
                    if (response.ok) {
                        const config = await response.json();
                        console.log("✅ Config loaded from /api/config");
                        supabaseUrl = config.supabaseUrl;
                        supabaseKey = config.supabaseKey;
                    } else {
                        throw new Error("API config not available");
                    }
                } catch (apiError) {
                    console.log("ℹ️  API config not available, checking for inline config...");
                    // Fallback: Check if config is available in window object
                    if (window.SUPABASE_URL && window.SUPABASE_KEY) {
                        supabaseUrl = window.SUPABASE_URL;
                        supabaseKey = window.SUPABASE_KEY;
                        console.log("✅ Using inline Supabase config from index.html");
                    } else {
                        throw new Error("❌ No Supabase configuration found");
                    }
                }
            }

            console.log("Config received:", { url: supabaseUrl ? supabaseUrl.substring(0, 20) + '...' : 'undefined' });

            if (!supabaseUrl || !supabaseKey || supabaseKey.includes('YOUR_SUPABASE')) {
                console.error("❌ Invalid Supabase Configuration.");
                throw new Error("Invalid or missing Supabase credentials");
            }

            // Initialize Supabase Client
            // Note: 'supabase' global comes from the CDN script in index.html
            supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

            console.log("✅ Supabase Client initialized");
            console.log("Current URL Hash:", window.location.hash);
            console.log("Current URL Search:", window.location.search);

            // 1. Check Initial Session
            const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();

            console.log("Initial Session Check:", session);
            if (sessionError) console.error("Session Error:", sessionError);

            if (session) {
                console.log("✅ Valid session found. Switching to dashboard...");
                handleLoginSuccess(session);
            } else {
                console.log("ℹ️  No active session found.");
                const loginBtn = document.getElementById('btn');
                if (loginBtn) {
                    loginBtn.disabled = false;
                    loginBtn.textContent = 'Login with Google';
                } else {
                    console.warn("⚠️  Login button not found in DOM");
                }
            }

            // 2. Listen for Auth Changes (e.g. after redirect)
            supabaseClient.auth.onAuthStateChange((event, session) => {
                console.log("Auth State Change:", event, session);
                if (event === 'SIGNED_IN' && session) {
                    console.log("✅ SIGNED_IN event received. Switching to dashboard...");
                    handleLoginSuccess(session);
                } else if (event === 'SIGNED_OUT') {
                    console.log("ℹ️  User signed out.");
                    window.location.reload();
                }
            });

            // Event listener for Sync Expense
            // Updated Event listener for Sync Expense
            const syncBtn = document.getElementById('btn-sync-expense');
            if (syncBtn) {
                // 1. Always remove old listeners to prevent double-logging
                syncBtn.removeEventListener('click', performSync);

                // 2. Point to the CORRECT function name
                syncBtn.addEventListener('click', performSync);

                console.log("✅ Sync button listener attached to performSync");
            } else {
                console.error("❌ Could not find button with ID 'btn-sync-expense'");
            }

            console.log("✅ App initialization completed successfully");

        } catch (error) {
            console.error("❌ Failed to initialize app:", error);
            // Show error state on button
            const loginBtn = document.getElementById('btn');
            if (loginBtn) {
                loginBtn.disabled = false;
                loginBtn.textContent = 'Setup Required (Click for Help)';
            }
            // Reset promise on error so we can retry
            initializationPromise = null;
            throw error;
        }
    })();

    return initializationPromise;
}

function handleLoginSuccess(session) {
    document.querySelector('.page-login').style.display = 'none';
    document.getElementById('nav').style.display = 'block';

    // TRIGGER PROFILE CREATION IMMEDIATELY
    // This ensures the user exists in the DB even if they don't visit Settings
    console.log("Logged in as:", session.user.email);

    // Only navigate if we are currently on the login page (or root) to avoid resetting navigation
    const dashboard = document.getElementById('page-dashboard');
    if (dashboard && dashboard.style.display !== 'block') {
        navigateTo('page-dashboard');
    }

    console.log("Logged in as:", session.user.email);

    loadFriendsInSidebar() // Load friends in sidebar
    loadFriendRequests() // Load friend requests on login
}

async function loginWithGoogle() {
    console.log("Login button clicked");
    if (!supabaseClient) {
        console.error("Supabase client not initialized yet.");
        alert("App loading... please wait a moment and try again.");
        return;
    }

    const loginBtn = document.getElementById('btn');
    if (loginBtn) {
        loginBtn.disabled = true;
        loginBtn.textContent = 'Logging in...';
    }

    console.log("Attempting Google login...");
    try {
        const { data, error } = await supabaseClient.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin
            }
        });

        if (error) {
            console.error("Login Error:", error.message);
            if (loginBtn) {
                loginBtn.disabled = false;
                loginBtn.textContent = 'Login with Google';
            }
            alert("Failed to connect to Google: " + error.message);
        } else {
            console.log("Google login initiated successfully");
        }
    } catch (error) {
        console.error("Login Exception:", error);
        if (loginBtn) {
            loginBtn.disabled = false;
            loginBtn.textContent = 'Login with Google';
        }
        alert("An error occurred during login. Please try again.");
    }
}
window.loginWithGoogle = loginWithGoogle;

window.onload = initApp;

async function handleQuickAdd() {
    const nameInput = document.getElementById('quick-name');
    const amountInput = document.getElementById('quick-amount');
    const descInput = document.getElementById('quick-desc');

    const friendUsername = nameInput.value.trim();
    const amount = parseFloat(amountInput.value);
    const description = descInput.value.trim();

    if (!friendUsername || !amount || !description) {
        alert("❌ Please fill all fields (Friend Name, Amount, Description)");
        return;
    }

    if (amount <= 0) {
        alert("❌ Amount must be greater than 0");
        return;
    }

    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) {
            alert("❌ You must be logged in.");
            return;
        }

        const userId = session.user.id;

        // Step 1: Get friend's ID by username
        const { data: friendProfiles, error: friendError } = await supabaseClient
            .from('Profile')
            .select('id')
            .eq('username', friendUsername)
            .single();

        if (friendError) {
            alert("❌ Friend not found");
            return;
        }

        const friendId = friendProfiles.id;

        // Step 2: Verify they are accepted friends
        const { data: friendships, error: friendshipError } = await supabaseClient
            .from('Friends')
            .select('status')
            .eq('status', 'accepted')
            .or(`and(user1_id.eq.${userId},user2_id.eq.${friendId}),and(user1_id.eq.${friendId},user2_id.eq.${userId})`)
            .single();

        if (friendshipError || !friendships) {
            alert("❌ You are not friends with " + friendUsername);
            return;
        }

        // Step 3: Create expense record (user is the payer)
        const { data: expense, error: expenseError } = await supabaseClient
            .from('Expenses')
            .insert([
                {
                    payer_id: userId,
                    receiver_id: friendId,
                    amount: amount,
                    description: description,
                    created_at: new Date().toISOString()
                }
            ])
            .select();

        if (expenseError) {
            console.error("Error creating expense:", expenseError);
            alert("❌ Failed to add expense: " + expenseError.message);
            return;
        }

        // Success!
        alert("✅ Expense added successfully!");

        // Clear inputs
        nameInput.value = '';
        amountInput.value = '';
        descInput.value = '';
        document.getElementById('quick-add-section').style.display = 'none';

        // Refresh dashboard
        await fetchDashboardData();

    } catch (error) {
        console.error("Error adding expense:", error);
        alert("❌ Error: " + error.message);
    }
}


// switch between Dashboard, Friends, and Settings
function navigateTo(pageId) {
    const subPages = ['page-dashboard', 'page-friends', 'page-settings'];
    subPages.forEach(id => {
        const element = document.getElementById(id);
        if (element) element.style.display = 'none';
    });
    document.getElementById(pageId).style.display = 'block';

    // Fetch data when navigating to specific pages
    if (pageId === 'page-dashboard') {
        fetchDashboardData();
    } else if (pageId === 'page-friends') {
        fetchFriendsData();
    } else if (pageId === 'page-settings') {
        fetchSettingsData();
    }
}

async function fetchDashboardData() {
    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) {
            console.log("No session found");
            return;
        }
        const userId = session.user.id;

        console.log("Fetching dashboard data for user:", userId);

        // Fetch user's total balance, amount owed, and amount they're owed
        const { data: expenses, error: expensesError } = await supabaseClient
            .from('Expenses')
            .select('payer_id, receiver_id, amount')
            .or(`payer_id.eq.${userId},receiver_id.eq.${userId}`);

        if (expensesError) {
            console.error("Error fetching expenses:", expensesError);
            return;
        }

        // Calculate totals
        let totalOwed = 0;      // Amount user owes to others
        let totalCredited = 0;  // Amount others owe to user
        const friendBalances = {};

        expenses.forEach(expense => {
            if (expense.payer_id === userId) {
                // User is the payer (people owe them)
                totalCredited += parseFloat(expense.amount);
                const friendId = expense.receiver_id;
                friendBalances[friendId] = (friendBalances[friendId] || 0) + parseFloat(expense.amount);
            } else {
                // User is the receiver (owes to others)
                totalOwed += parseFloat(expense.amount);
                const friendId = expense.payer_id;
                friendBalances[friendId] = (friendBalances[friendId] || 0) - parseFloat(expense.amount);
            }
        });

        const netBalance = totalCredited - totalOwed;

        console.log("Dashboard Totals:", { totalCredited, totalOwed, netBalance, friendBalances });

        // Update dashboard elements
        const totalBalanceEl = document.getElementById('dashboard-total-balance');
        if (totalBalanceEl) {
            totalBalanceEl.innerHTML = `₹${Math.abs(netBalance).toFixed(2)}`;
            totalBalanceEl.style.color = netBalance >= 0 ? '#00c853' : '#ff5252';
        }

        const oweEl = document.getElementById('dashboard-owe');
        if (oweEl) {
            oweEl.innerHTML = `₹${totalOwed.toFixed(2)}`;
        }

        const owedEl = document.getElementById('dashboard-owed');
        if (owedEl) {
            owedEl.innerHTML = `₹${totalCredited.toFixed(2)}`;
        }

        // Fetch friend names and update friend balances
        const friendsListEl = document.getElementById('dashboard-friends-list');
        if (friendsListEl) {
            const friendIds = Object.keys(friendBalances);

            if (friendIds.length === 0) {
                friendsListEl.innerHTML = '<div class="activity"><span>No transactions yet</span><span class="green">Start by adding an expense!</span></div>';
            } else {
                // Fetch friend profiles
                const { data: profiles, error: profileError } = await supabaseClient
                    .from('Profile')
                    .select('id, username')
                    .in('id', friendIds);

                if (profileError) {
                    console.error("Error fetching friend profiles:", profileError);
                    return;
                }

                const profileMap = {};
                profiles.forEach(p => profileMap[p.id] = p.username);

                let html = '';
                friendIds.forEach(friendId => {
                    const balance = friendBalances[friendId];
                    const username = profileMap[friendId] || 'Unknown';
                    const isPositive = balance >= 0;
                    const color = isPositive ? 'green' : 'red';
                    const text = isPositive ? `You are owed ₹${balance.toFixed(2)}` : `You owe ₹${Math.abs(balance).toFixed(2)}`;

                    html += `<div class="activity">
                        <span>${username}</span>
                        <span class="${color}">${text}</span>
                    </div>`;
                });
                friendsListEl.innerHTML = html;
            }
        }

    } catch (error) {
        console.error("Error fetching dashboard data:", error);
    }
}

async function fetchFriendsData() {
    try {
        // Reload friends list and requests
        await loadFriendsInSidebar();
        await loadFriendRequests();
        console.log("✅ Friends data loaded");
    } catch (error) {
        console.error("❌ Error fetching friends data:", error);
    }
}


async function fetchSettingsData() {
    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) return;

        // Set Email
        const emailEl = document.getElementById('settings-email');
        if (emailEl) {
            emailEl.textContent = `Email: ${session.user.email}`;
        }

        // Fetch user profile directly from Supabase
        const userId = session.user.id;

        const { data: profile, error: profileError } = await supabaseClient
            .from('Profile')
            .select('username')
            .eq('id', userId)
            .single();

        if (profileError) {
            console.error("Error fetching profile:", profileError);
        }

        const usernameEl = document.getElementById('settings-username');
        if (usernameEl) {
            if (profile && profile.username) {
                usernameEl.textContent = `Name: ${profile.username}`;
            } else {
                usernameEl.textContent = `Name: (Not Set)`;
            }
        }

    } catch (error) {
        console.error("Error fetching settings data:", error);
    }
}

//logout
window.handleLogout = async function () {
    const { error } = await supabaseClient.auth.signOut();

    if (error) {
        console.error('Error logging out:', error.message);
    } else {
        window.location.reload();
    }
};

/*SUPABASE SETUP*/

/*
  Supabase client is created in initApp() function above.
  The supabaseClient variable is initialized when the app starts.
*/

/* =========================================================
   FRIENDS AND SEARCH LOGIC (CONSOLIDATED)
   ========================================================= */

async function searchUsers() {

    // Read text typed in the input field
    const query = document.getElementById("searchInput").value;

    // Clear old search results before showing new ones
    const resultsEl = document.getElementById("searchResults");
    resultsEl.innerHTML = "";

    if (!query || query.trim() === "") {
        return;
    }

    // Call PostgreSQL function using Supabase RPC
    const { data, error } = await supabaseClient.rpc(
        "search_users_by_username",   // SQL function name
        { search_query: query }       // Function parameter
    );

    if (error) {
        console.error("Search error:", error);
        resultsEl.innerHTML = `<li class="text-danger">Error: ${error.message}</li>`;
        return;
    }

    if (resultsEl) {
        resultsEl.innerHTML = "";
        if (data && data.length > 0) {
            data.forEach(user => {
                const li = document.createElement("li");
                li.className = "list-group-item";
                li.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span>${user.username}</span>
                        <button class="btn btn-sm btn-primary" onclick="inviteFriend('${user.id}')">Invite</button>
                    </div>
                `;
                resultsEl.appendChild(li);
            });
        } else {
            const li = document.createElement("li");
            li.className = "list-group-item text-muted";
            li.innerHTML = "No users found.";
            resultsEl.appendChild(li);
        }
    }
}

async function searchFriendsForExpense(query) {
    if (!supabaseClient) return;

    const dropdown = document.getElementById('quick-friends-dropdown');

    if (!query || query.trim() === "") {
        dropdown.style.display = 'none';
        return;
    }

    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) return;

        const userId = session.user.id;

        // Get all accepted friends
        const { data: friendships, error: friendError } = await supabaseClient
            .from('Friends')
            .select(`
                user1_id, 
                user2_id,
                user1:Profile!Friends_user1_id_fkey(id, username),
                user2:Profile!Friends_user2_id_fkey(id, username)
            `)
            .eq('status', 'accepted')
            .or(`user1_id.eq.${userId},user2_id.eq.${userId}`);

        if (friendError) {
            console.error("Error fetching friends:", friendError);
            return;
        }

        // Extract friend usernames and filter by search query
        const friends = [];
        friendships.forEach(f => {
            const isSender = f.user1_id === userId;
            const friendProfile = isSender ? f.user2 : f.user1;
            if (friendProfile && friendProfile.username) {
                friends.push(friendProfile);
            }
        });

        const filtered = friends.filter(f =>
            f.username.toLowerCase().includes(query.toLowerCase())
        );

        // Display dropdown
        dropdown.innerHTML = '';
        if (filtered.length > 0) {
            dropdown.style.display = 'block';
            filtered.forEach(friend => {
                const li = document.createElement('li');
                li.className = 'list-group-item';
                li.textContent = friend.username;
                li.style.cursor = 'pointer';
                li.onclick = () => {
                    document.getElementById('quick-name').value = friend.username;
                    dropdown.style.display = 'none';
                };
                dropdown.appendChild(li);
            });
        } else {
            dropdown.style.display = 'block';
            const li = document.createElement('li');
            li.className = 'list-group-item text-muted';
            li.textContent = 'No accepted friends match';
            dropdown.appendChild(li);
        }
    } catch (error) {
        console.error("Error searching friends:", error);
    }
}

async function inviteFriend(targetId) {
    if (!supabaseClient) return;
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
        alert("You must be logged in to invite friends.");
        return;
    }

    // Call SQL function to send invite
    const { error } = await supabaseClient.rpc(
        "invite_friend_by_id",
        {
            inviter_id: user.id,
            target_id: targetId
        }
    );

    if (error) {
        alert("Invite error: " + error.message);
    } else {
        alert("Friend request sent!");
    }
}

async function loadFriendRequests() {
    // Safety guard
    if (!supabaseClient) {
        console.warn("DEBUG: supabaseClient not ready yet.");
        return;
    }

    const { data: { user } } = await supabaseClient.auth.getUser();
    const myId = user.id;

    // Simplified join: Let Supabase find the relationship automatically
    const { data, error } = await supabaseClient
        .from('Friends')
        .select(`
            id, 
            status, 
            user1_id, 
            user2_id,
            user1:user1_id(username),
            user2:user2_id(username)
        `)
        .eq('status', 'pending')
        .or(`user1_id.eq.${myId},user2_id.eq.${myId}`);

    if (error) {
        console.error("Join Error:", error);
        return;
    }

    const ul = document.getElementById("friendRequests");
    ul.innerHTML = "";

    data.forEach(req => {
        const li = document.createElement("li");
        const isSender = req.user1_id === myId;

        // Use the joined data safely
        const friendUsername = isSender ? req.user2?.username : req.user1?.username;

        li.innerHTML = `
            ${friendUsername || 'Unknown User'} 
            ${isSender ?
                `<span>(Waiting for them to accept)</span>` :
                `<button onclick="acceptRequest('${req.id}')">Accept</button>`
            }
            <button onclick="declineRequest('${req.id}')">${isSender ? 'Cancel' : 'Decline'}</button>
        `;
        ul.appendChild(li);
    });
}




async function acceptRequest(id) {
    if (!supabaseClient) return;
    const { error } = await supabaseClient.rpc("accept_friendship", { friendship_id: id });
    if (error) alert(error.message);
    else loadFriendRequests();
}

async function declineRequest(id) {
    if (!supabaseClient) return;
    const { error } = await supabaseClient.rpc("decline_friendship", { friendship_id: id });
    if (error) alert(error.message);
    else loadFriendRequests();
}

// Ensure these are globally available for inline HTML onclick handlers
window.searchUsers = searchUsers;
window.searchFriendsForExpense = searchFriendsForExpense;
window.inviteFriend = inviteFriend;
window.acceptRequest = acceptRequest;
window.declineRequest = declineRequest;
window.loadFriendRequests = loadFriendRequests;
window.handleLogout = handleLogout;
window.handleQuickAdd = handleQuickAdd;








// Function to fetch and display friends in the sidebar
async function loadFriendsInSidebar() {
    if (!supabaseClient) return;

    const { data: { session } } = await supabaseClient.auth.getSession();
    const myId = session.user.id;

    // Use the same "Safe Join" syntax that worked for requests
    const { data: friends, error } = await supabaseClient
        .from('Friends')
        .select(`
            id, 
            user1_id, 
            user2_id,
            status,
            user1:Profile!Friends_user1_id_fkey(id, username),
            user2:Profile!Friends_user2_id_fkey(id, username)
        `)
        .eq('status', 'accepted')
        .or(`user1_id.eq.${myId},user2_id.eq.${myId}`);

    if (error) {
        console.error("Friends Load Error:", error);
        return;
    }

    const listEl = document.getElementById('friendsList');
    if (!listEl) return;
    listEl.innerHTML = "";

    friends.forEach(f => {
        // Determine which side is the friend and which is ME
        const isSender = f.user1_id === myId;
        const friendProfile = isSender ? f.user2 : f.user1;

        if (!friendProfile) return; // Skip if join failed

        const li = document.createElement('li');
        li.className = "friend-item";
        li.innerHTML = `<span>${friendProfile.username}</span>`;

        li.onclick = () => {
            document.querySelectorAll('.friend-item').forEach(el => el.classList.remove('active'));
            li.classList.add('active');
            showTransactionHistory(friendProfile.id, friendProfile.username);
        };

        listEl.appendChild(li);
    });
}
// Function to show transactions on the right side
async function showTransactionHistory(friendId, friendUsername) {
    document.getElementById('historyPlaceholder').style.display = 'none';
    document.getElementById('historyContent').style.display = 'block';
    document.getElementById('historyWithTitle').textContent = `History with ${friendUsername}`;

    const { data: { session } } = await supabaseClient.auth.getSession();
    const myId = session.user.id;

    // Query your Expenses table for records between you and this friend
    const { data: expenses, error } = await supabaseClient
        .from('Expenses')
        .select('*')
        .or(`and(payer_id.eq.${myId},receiver_id.eq.${friendId}),and(payer_id.eq.${friendId},receiver_id.eq.${myId})`)
        .order('created_at', { ascending: false });

    const container = document.getElementById('transactionList');
    if (expenses.length === 0) {
        container.innerHTML = "<p>No transactions yet.</p>";
        return;
    }

    container.innerHTML = expenses.map(exp => {
        const iPaid = exp.payer_id === myId;
        const colorClass = iPaid ? 'credit' : 'debit';
        const prefix = iPaid ? "You lent" : "You owe";

        return `
            <div class="transaction-card ${exp.is_settled ? 'settled' : ''}">
                <div class="info">
                    <strong>${exp.description}</strong>
                    <small>${new Date(exp.created_at).toLocaleDateString()}</small>
                </div>
                <div class="amount ${colorClass}">
                    ${prefix} Rs.${exp.amount}
                </div>
            </div>
        `;
    }).join('');
}


async function handleNaturalLanguageExpense(text) {
    // NEW: Wait until the config is fetched and 'sb' is defined
    await initPromise;
    try {
        if (!window.supabase) {
            throw new Error("Supabase is not initialized. Check index.js");
        }
        // 1. Get current user session
        const { data: { user }, error: authError } = await window.sb.auth.getUser();
        if (authError || !user) throw new Error("Please log in first");

        // 2. Call the Netlify Function
        const response = await fetch('/.netlify/functions/expense', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userInput: text,
                sender_id: user.id
            })
        });

        // 3. Safety Check: If Netlify returns an error (like 404 or 500)
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Server Error: ${errorText}`);
        }

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error || "Failed to process expense");
        }

        return result.logged; // Returns the data for your UI to use
    } catch (err) {
        console.error("NLP Error:", err);
        throw err; // Pass the error up to your UI handler
    }
}

document.getElementById('submit-expense').addEventListener('click', () => {
    const inputField = document.getElementById('ai-input');
    const userText = inputField.value;

    if (userText) {
        // This is where you "READ" the value, making the function active!
        handleNaturalLanguageExpense(userText);
        inputField.value = ""; // Clear the box after sending
    }
});

document.getElementById('ai-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        handleNaturalLanguageExpense(e.target.value);
        e.target.value = "";
    }
});

// 1. Get references to your footer elements
const geminiInput = document.getElementById('gemini-query');

// 2. Function to handle the click/sync action
async function performAILog() {
    const text = geminiInput.value.trim();

    if (!text) {
        alert("Please enter an expense description first!");
        return;
    }

    // UI Feedback: Change button text while processing
    const originalText = syncBtn.innerText;
    syncBtn.innerText = "Syncing...";
    syncBtn.disabled = true;

    try {
        // This calls the function you previously defined
        await handleNaturalLanguageExpense(text);

        // Clear input on success
        geminiInput.value = "";
    } catch (err) {
        console.error("Sync failed:", err);
    } finally {
        // Reset button state
        syncBtn.innerText = originalText;
        syncBtn.disabled = false;
    }
}

const voiceBtn = document.getElementById('btn-voice-input').addEventListener('click', startVoiceLogic);

if (voiceBtn) {
    // 1. Remove old listener to be safe (prevent double-firing)
    voiceBtn.removeEventListener('click', startVoiceLogic);

    // 2. Attach the listener
    voiceBtn.addEventListener('click', startVoiceLogic);

    console.log("✅ Voice button listener attached");
} else {
    console.error("❌ Could not find button with ID 'btn-voice-input'");
}

// 3. Trigger on Button Click
syncBtn.addEventListener('click', performAILog);

// 4. Trigger on 'Enter' key for better UX
geminiInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        performAILog();
    }
});






async function performSync() {
    // 2. Immediate Guard: If already syncing, exit the function
    if (isSyncing) return;

    const geminiInput = document.getElementById('gemini-query');
    const syncBtn = document.getElementById('btn-sync-expense'); // Ensure this ID matches your HTML
    const text = geminiInput.value.trim();

    if (!text) {
        alert("Please enter some text for Gemini!");
        return;
    }

    try {
        // 3. Set the Loading State
        isSyncing = true;
        if (syncBtn) {
            syncBtn.disabled = true;
            syncBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Syncing...';
        }

        const data = await handleNaturalLanguageExpense(text);

        // Success Logic
        alert(`Success! Logged ₹${data.final_amount} for ${data.target_username}`);
        geminiInput.value = "";

    } catch (err) {
        console.error("Sync Error:", err);
        alert("Sync failed: " + err.message);
    } finally {
        // 4. Reset the State: This runs whether the try SUCCEEDS or FAILS
        isSyncing = false;
        if (syncBtn) {
            syncBtn.disabled = false;
            syncBtn.innerHTML = 'Sync'; // Restore your original text
        }
    }
}

// --- 4. VOICE RECOGNITION (MIC BUTTON) ---
function startVoiceLogic() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        alert("Your browser does not support voice input. Please use Chrome or Edge.");
        return;
    }

    // MATCHING YOUR HTML
    const voiceBtn = document.getElementById('btn-voice-input');
    const geminiInput = document.getElementById('gemini-query');
    const micIcon = voiceBtn.querySelector('i'); // Target the <i> tag specifically

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-IN'; // Optimized for your location
    recognition.interimResults = false;

    recognition.onstart = () => {
        // Change button color to red and swap icon to show it's active
        voiceBtn.classList.replace('btn-outline-info', 'btn-danger');
        if (micIcon) micIcon.classList.replace('bi-mic-fill', 'bi-mic-mute-fill');
        geminiInput.placeholder = "Listening...";
    };

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        geminiInput.value = transcript;
    };

    recognition.onend = () => {
        // Restore original state
        voiceBtn.classList.replace('btn-danger', 'btn-outline-info');
        if (micIcon) micIcon.classList.replace('bi-mic-mute-fill', 'bi-mic-fill');
        geminiInput.placeholder = "Tell Gemini: I paid 500 for lunch with Abhi";
    };

    recognition.onerror = (event) => {
        console.error("Speech Recognition Error:", event.error);
        voiceBtn.classList.replace('btn-danger', 'btn-outline-info');
    };

    recognition.start();
}

// --- 5. EVENT LISTENERS ---
syncBtn.addEventListener('click', performSync);

geminiInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') performSync();
});

voiceBtn.addEventListener('click', startVoiceLogic);

