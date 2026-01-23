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

// Transaction Pagination State
let currentTxnPage = 0;
const TXN_LIMIT = 10;
let currentTxnFriendId = null;
let currentTxnFriendUsername = null; // Added this missing one too just in case

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

            const voiceBtn = document.getElementById('btn-voice-input');

            if (voiceBtn) {
                // 2. Remove old listener to be safe (prevent double-firing)
                voiceBtn.removeEventListener('click', startVoiceLogic);

                // 3. Attach the listener
                voiceBtn.addEventListener('click', startVoiceLogic);

                console.log("✅ Voice button listener attached");
            } else {
                console.error("❌ Could not find button with ID 'btn-voice-input'");
            }

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
    const appHeader = document.getElementById('app-header');
    if (appHeader) appHeader.style.display = 'block';

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

    // FORCE DASHBOARD UPDATE
    fetchDashboardData();
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

// Duplicate handleQuickAdd removed.
// The correct implementation is at the bottom of the file directly using ID from search.


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
        // ALSO needed for Recent Activity: description, created_at
        const { data: expenses, error: expensesError } = await supabaseClient
            .from('Expenses')
            .select('*') // Use * to avoid 400 error if a column (like settled_amount) is missing
            .or(`payer_id.eq.${userId},receiver_id.eq.${userId}`);

        if (expensesError) {
            console.error("Error fetching expenses:", expensesError);
            return;
        }

        console.log("DEBUG: Raw Expenses fetched:", expenses);

        // Calculate totals
        let totalOwed = 0;      // Amount user owes to others
        let totalCredited = 0;  // Amount others owe to user

        expenses.forEach(expense => {
            const amount = parseFloat(expense.amount);
            const settled = parseFloat(expense.settled_amount || 0);
            const remaining = amount - settled;

            // console.log(`DEBUG: Txn ${expense.id} | Amount: ${amount} | Settled: ${settled} | Remaining: ${remaining} | iPaid: ${expense.payer_id === userId}`);

            // Skip if fully settled (though query filters usually handle is_settled, safe to check remaining)
            if (expense.is_settled || remaining <= 0) return;

            if (expense.payer_id === userId) {
                // User is the payer (people owe them)
                totalCredited += remaining;
            } else {
                // User is the receiver (owes to others)
                totalOwed += remaining;
            }
        });

        // Net Balance is strictly what you are owed minus what you owe.
        const netBalance = totalCredited - totalOwed;

        console.log("DEBUG: Calculated Totals:", { totalCredited, totalOwed, netBalance });

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

        // --- RECENT ACTIVITY (Top 3) ---
        // Warning: Showing FRIEND balances is gone. We show TRANSACTIONS now.
        const recentListEl = document.getElementById('dashboard-friends-list');
        if (recentListEl) {
            // Sort by Date Descending
            expenses.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

            // Slice Top 3
            const recentTxns = expenses.slice(0, 3);

            if (recentTxns.length === 0) {
                recentListEl.innerHTML = '<div class="activity"><span>No transactions yet</span><span class="green">Start by adding an expense!</span></div>';
            } else {
                // We need names. Collect IDs.
                const userIds = new Set();
                recentTxns.forEach(e => {
                    userIds.add(e.payer_id);
                    userIds.add(e.receiver_id);
                });

                const { data: profiles } = await supabaseClient
                    .from('Profile')
                    .select('id, username')
                    .in('id', Array.from(userIds));

                const profileMap = {};
                profiles?.forEach(p => profileMap[p.id] = p.username);

                let html = '';
                recentTxns.forEach(exp => {
                    const iPaid = exp.payer_id === userId;
                    const amount = parseFloat(exp.amount).toFixed(2);
                    const isSettled = exp.is_settled;
                    const dateStr = new Date(exp.created_at).toLocaleDateString().slice(0, 5); // Short date format

                    // UX Text
                    // If I paid: "You paid [Name]" -> Green
                    // If I owe: "[Name] paid you" -> Red
                    const otherId = iPaid ? exp.receiver_id : exp.payer_id;
                    const otherName = profileMap[otherId] || 'Unknown';
                    const color = iPaid ? 'green' : 'red';
                    const prefix = iPaid ? '+' : '-';
                    const descText = iPaid ? `You paid ${otherName}` : `${otherName} paid you`;

                    html += `
                        <div class="activity" style="opacity: ${isSettled ? 0.6 : 1}">
                            <div class="d-flex flex-column">
                                <span>${exp.description}</span>
                                <small class="text-muted" style="font-size:0.75rem">${descText} • ${dateStr}</small>
                            </div>
                            <span class="${color}" style="font-weight:600">${prefix} ₹${amount}</span>
                        </div>
                    `;
                });
                recentListEl.innerHTML = html;
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
window.showTransactionHistory = showTransactionHistory;








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
// Pagination State
// Pagination State moved to top

// Function to show transactions on the right side
async function showTransactionHistory(friendId, friendUsername, loadMore = false) {
    const container = document.getElementById('transactionList');
    const historyPlaceholder = document.getElementById('historyPlaceholder');
    const historyContent = document.getElementById('historyContent');
    const historyTitle = document.getElementById('historyWithTitle');

    // If switching friends or first load (not clicking "Load More")
    if (!loadMore) {
        currentTxnPage = 0;
        currentTxnFriendId = friendId;
        currentTxnFriendUsername = friendUsername; // Ensure this is tracked
        container.innerHTML = ""; // Clear previous list
        historyPlaceholder.style.display = 'none';
        historyContent.style.display = 'block';
        historyTitle.innerHTML = `
            <div class="d-flex justify-content-between align-items-center w-100">
                <span>History with ${friendUsername}</span>
                <button class="btn btn-outline-success btn-sm" onclick="settleUp('${friendId}', '${friendUsername}')">
                    <i class="bi bi-check-circle"></i> Settle Up
                </button>
            </div>
        `;
    } else {
        // Prepare for next page
        currentTxnPage++;
        // Remove existing "Load More" button if it exists
        const oldBtn = document.getElementById('btn-load-more-txns');
        if (oldBtn) oldBtn.remove();
    }

    const { data: { session } } = await supabaseClient.auth.getSession();
    const myId = session.user.id;

    // Calculate Range
    const from = currentTxnPage * TXN_LIMIT;
    const to = from + TXN_LIMIT - 1;

    // Query your Expenses table for records between you and this friend
    const { data: expenses, error } = await supabaseClient
        .from('Expenses')
        .select('*')
        .or(`and(payer_id.eq.${myId},receiver_id.eq.${friendId}),and(payer_id.eq.${friendId},receiver_id.eq.${myId})`)
        .order('created_at', { ascending: false })
        .range(from, to);

    if (error) {
        console.error("Error fetching transactions:", error);
        container.innerHTML += `<p class="text-danger">Error loading history.</p>`;
        return;
    }

    if (expenses.length === 0 && !loadMore) {
        container.innerHTML = "<p>No transactions yet.</p>";
        return;
    }

    if (expenses.length === 0 && loadMore) {
        // No more transactions to load
        // You could show a message "No more transactions" or just do nothing
        return;
    }

    // Append new transactions
    const newHtml = expenses.map(exp => {
        const iPaid = exp.payer_id === myId;
        const colorClass = iPaid ? 'credit' : 'debit';
        const prefix = iPaid ? "You lent" : "You owe";

        let settledInfo = "";
        let actionBtn = "";

        if (exp.is_settled) {
            settledInfo = `<div class="text-muted small"><i class="bi bi-check-all"></i> Settled</div>`;
        } else if (exp.settled_amount > 0) {
            settledInfo = `<div class="text-info small">Partial: ${exp.settled_amount} paid</div>`;
        }

        if (!exp.is_settled && iPaid) {
            actionBtn = `
                <button class="btn btn-sm btn-outline-primary ms-2" onclick="settleTransaction('${exp.id}')">
                    Settle
                </button>
            `;
        }

        return `
            <div class="transaction-card ${exp.is_settled ? 'settled' : ''}">
                <div class="info">
                    <strong>${exp.description}</strong>
                    <small>${new Date(exp.created_at).toLocaleDateString()}</small>
                    ${settledInfo}
                </div>
                <div class="d-flex align-items-center">
                    <div class="amount ${colorClass}">
                        ${prefix} Rs.${exp.amount}
                    </div>
                    ${actionBtn}
                </div>
            </div>
        `;
    }).join('');

    container.insertAdjacentHTML('beforeend', newHtml);

    // If we got a full page, likely there are more transactions. Show "Load More" button.
    if (expenses.length === TXN_LIMIT) {
        const btnHtml = `
            <div class="text-center mt-3">
                <button id="btn-load-more-txns" class="btn btn-outline-secondary btn-sm" 
                    onclick="showTransactionHistory('${friendId}', '${friendUsername}', true)">
                    Load More
                </button>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', btnHtml);
    }
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



// 3. Trigger on Button Click
// 3. Trigger on Button Click - handled at bottom
// syncBtn.addEventListener('click', performSync);

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

        // Refresh dashboard to show new totals immediately
        fetchDashboardData();

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

async function settleUp(friendId, friendName) {
    if (!confirm(`Are you sure you want to settle all expenses with ${friendName}?`)) {
        return;
    }

    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        const myId = session.user.id;

        const { error } = await supabaseClient.rpc('settle_all_between_friends', {
            user_a: myId,
            user_b: friendId
        });

        if (error) {
            console.error("Settlement Error:", error);
            alert("Failed to settle up: " + error.message);
            return;
        }

        alert(`All cleaned up with ${friendName}!`);

        // Refresh everything
        showTransactionHistory(friendId, friendName); // Reload history (should show settled or empty)
        fetchDashboardData(); // Update balances

    } catch (err) {
        console.error("Error settling up:", err);
        alert("An error occurred.");
    }
}

async function settleTransaction(txnId) {
    if (!confirm("Mark this transaction as fully settled?")) return;

    try {
        const { error } = await supabaseClient.rpc('settle_transaction', { txn_id: txnId });

        if (error) {
            alert("Error: " + error.message);
        } else {
            // Refresh
            // We need to know which friend page we are on to reload properly
            // stored in global: currentTxnFriendId, currentTxnFriendUsername
            if (currentTxnFriendId && currentTxnFriendUsername) {
                showTransactionHistory(currentTxnFriendId, currentTxnFriendUsername);
                fetchDashboardData();
            }
        }
    } catch (err) {
        console.error("Settle txn error:", err);
    }
}
window.settleTransaction = settleTransaction;

window.settleUp = settleUp;

// --- 4. VOICE RECOGNITION (MIC BUTTON) ---
function startVoiceLogic() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        alert("Your browser does not support voice input. Please use Chrome or Edge.");
        return;
    }

    const recognition = new SpeechRecognition();
    const voiceBtn = document.getElementById('btn-voice-input');
    const geminiInput = document.getElementById('gemini-query');
    const micIcon = voiceBtn.querySelector('i');

    recognition.lang = 'en-IN'; // Optimized for Indian English accents
    recognition.interimResults = false;

    recognition.onstart = () => {
        // Change button to red and swap icon to show it is listening
        voiceBtn.classList.replace('btn-outline-info', 'btn-danger');
        if (micIcon) micIcon.classList.replace('bi-mic-fill', 'bi-mic-mute-fill');
        geminiInput.placeholder = "Listening...";
    };

    recognition.onresult = (event) => {
        // This line types the speech directly into your text box
        const transcript = event.results[0][0].transcript;
        geminiInput.value = transcript;
    };

    recognition.onend = () => {
        // Reset the button and placeholder when finished
        voiceBtn.classList.replace('btn-danger', 'btn-outline-info');
        if (micIcon) micIcon.classList.replace('bi-mic-mute-fill', 'bi-mic-fill');
        geminiInput.placeholder = "Rahul owe 1000 for Dinner";
    };

    recognition.onerror = (event) => {
        console.error("Speech Error:", event.error);
        voiceBtn.classList.replace('btn-danger', 'btn-outline-info');
    };

    recognition.start();
}

// --- 5. EVENT LISTENERS ---
syncBtn.addEventListener('click', performSync);

geminiInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') performSync();
});




// --- 6. Quick Add Expense Logic ---
let quickAddSelectedFriendId = null;

window.searchFriendsForExpense = async function (query) {
    const list = document.getElementById('quick-friends-dropdown');
    if (!query) {
        list.style.display = 'none';
        return;
    }

    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return;

    // Use the RPC 'search_users_by_username'
    const { data: users, error: searchError } = await supabaseClient.rpc(
        "search_users_by_username",
        { search_query: query }
    );

    if (searchError) {
        console.error(searchError);
        return;
    }

    list.innerHTML = '';
    if (users && users.length > 0) {
        list.style.display = 'block';
        users.forEach(u => {
            const li = document.createElement('li');
            li.className = 'list-group-item list-group-item-action';
            li.style.cursor = 'pointer';
            li.textContent = u.username;
            li.onclick = () => {
                document.getElementById('quick-name').value = u.username;
                quickAddSelectedFriendId = u.id;
                list.style.display = 'none';
            };
            list.appendChild(li);
        });
    } else {
        list.style.display = 'none';
    }
}

window.handleQuickAdd = async function () {
    const name = document.getElementById('quick-name').value;
    const amount = parseFloat(document.getElementById('quick-amount').value);
    const desc = document.getElementById('quick-desc').value;

    if (!name || !quickAddSelectedFriendId) {
        alert("Please select a friend from the list.");
        return;
    }
    if (!amount || amount <= 0) {
        alert("Please enter a valid amount.");
        return;
    }
    if (!desc) {
        alert("Please enter a description.");
        return;
    }

    // Add Expense Logic
    try {
        const { data: { session } } = await supabaseClient.auth.getSession();

        // Use create_expense_automated
        const { error } = await supabaseClient.rpc('create_expense_automated', {
            p_description: desc,
            p_amount: amount,
            p_payer_id: session.user.id, // I paid
            p_receiver_id: quickAddSelectedFriendId
        });

        if (error) throw error;

        alert("Expense added successfully!");

        // Clear inputs
        document.getElementById('quick-name').value = '';
        document.getElementById('quick-amount').value = '';
        document.getElementById('quick-desc').value = '';
        quickAddSelectedFriendId = null; // Reset

        // Refresh Dashboard
        fetchDashboardData();

    } catch (err) {
        console.error("Quick Add Error:", err);
        alert("Failed to add expense: " + err.message);
    }
}
