// SUPABASE AUTHENTICATION
let supabaseClient;
let supabaseUrl;
let supabaseKey;
let initializationPromise = null;

async function initApp() {
    // Return cached promise if already initialized or initializing
    if (initializationPromise) {
        return initializationPromise;
    }

    initializationPromise = (async () => {
        try {
            console.log("Starting app initialization...");

            // Fetch config with timeout
            const configController = new AbortController();
            const configTimeout = setTimeout(() => configController.abort(), 10000); // 10 second timeout

            const response = await fetch('/api/config', { signal: configController.signal });
            clearTimeout(configTimeout);

            if (!response.ok) {
                throw new Error(`Failed to fetch config: ${response.statusText}`);
            }

            const config = await response.json();
            console.log("Config received:", { url: config.supabaseUrl ? config.supabaseUrl.substring(0, 20) + '...' : 'undefined' });

            supabaseUrl = config.supabaseUrl;
            supabaseKey = config.supabaseKey;


            if (!supabaseUrl || !supabaseKey || supabaseKey.includes('YOUR_SUPABASE')) {
                console.error("Invalid Supabase Configuration.");
                throw new Error("Invalid Supabase credentials in .env");
            }

            // Initialize Supabase Client
            // Note: 'supabase' global comes from the CDN script in index.html
            supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

            console.log("Supabase Client initialized");
            console.log("Current URL Hash:", window.location.hash);

            // 1. Check Initial Session
            const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();

            console.log("Initial Session Check:", session);
            if (sessionError) console.error("Session Error:", sessionError);

            if (session) {
                console.log("Valid session found. Switching to dashboard...");
                handleLoginSuccess(session);
            } else {
                console.log("No active session found.");
                const loginBtn = document.getElementById('btn');
                if (loginBtn) {
                    loginBtn.disabled = false;
                    loginBtn.textContent = 'Login with Google';
                }
            }

            // 2. Listen for Auth Changes (e.g. after redirect)
            supabaseClient.auth.onAuthStateChange((event, session) => {
                console.log("Auth State Change:", event, session);
                if (event === 'SIGNED_IN' && session) {
                    console.log("SIGNED_IN event received. Switching to dashboard...");
                    handleLoginSuccess(session);
                } else if (event === 'SIGNED_OUT') {
                    console.log("User signed out.");
                    window.location.reload();
                }
            });

            // Event listener for Sync Expense
            const syncBtn = document.getElementById('btn-sync-expense');
            if (syncBtn) {
                syncBtn.removeEventListener('click', handleSyncExpense);
                syncBtn.addEventListener('click', handleSyncExpense);
            }

            console.log("App initialization completed successfully");

        } catch (error) {
            console.error("Failed to initialize app:", error);
            // Show error state on button
            const loginBtn = document.getElementById('btn');
            if (loginBtn) {
                loginBtn.disabled = false;
                loginBtn.textContent = 'Retry (Click to Retry)';
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

    console.log("Attempting Google login...");
    try {
        const { data, error } = await supabaseClient.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.href
            }
        });

        if (error) {
            console.error("Login Error:", error.message);
            alert("Failed to connect to Google: " + error.message);
        } else {
            console.log("Google login initiated successfully");
        }
    } catch (error) {
        console.error("Login Exception:", error);
        alert("An error occurred during login. Please try again.");
    }
}
window.loginWithGoogle = loginWithGoogle;

window.onload = initApp;

async function handleQuickAdd() {
    const nameInput = document.getElementById('quick-name');
    const amountInput = document.getElementById('quick-amount');
    const descInput = document.getElementById('quick-desc');

    const name = nameInput.value;
    const amount = amountInput.value;
    const desc = descInput.value;

    if (!name || !amount || !desc) {
        alert("Please fill all fields (Name, Amount, Description)");
        return;
    }

    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) {
            alert("You must be logged in.");
            return;
        }

        const response = await fetch('/api/expense', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: session.user.id,
                targetUsername: name,
                amount: amount,
                description: desc
            })
        });

        const result = await response.json();

        if (response.ok) {
            alert(result.message);
            // Clear inputs
            nameInput.value = '';
            amountInput.value = '';
            descInput.value = '';
            // Refresh dashboard
            fetchDashboardData();
        } else {
            alert("Error: " + result.error);
        }

    } catch (error) {
        console.error("Error adding expense:", error);
        alert("Failed to add expense.");
    }
}


async function handleSyncExpense() {
    const queryInput = document.getElementById('gemini-query');
    const query = queryInput.value;
    if (!query) {
        alert("Please enter a command like: 'I paid 500 for lunch with Name'");
        return;
    }

    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) {
            alert("You must be logged in.");
            return;
        }

        const response = await fetch('/api/expense', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: session.user.id,
                query: query
            })
        });

        const result = await response.json();

        if (response.ok) {
            alert(result.message);
            queryInput.value = ''; // Clear input
            // Refresh dashboard if visible
            if (document.getElementById('page-dashboard').style.display === 'block') {
                fetchDashboardData();
            }
        } else {
            alert("Error: " + result.error);
        }

    } catch (error) {
        console.error("Error syncing expense:", error);
        alert("Failed to sync expense.");
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
        if (!session) return;
        const userId = session.user.id;

        const response = await fetch(`/api/dashboard?userId=${userId}`);
        const data = await response.json();

        console.log("Dashboard Data:", data);

        // Update Net Balance
        const netBalanceEl = document.getElementById('dashboard-net-balance');
        if (netBalanceEl) {
            const netCredit = parseFloat(data.netCredit);
            const type = netCredit >= 0 ? 'Credit' : 'Debit';
            const colorClass = netCredit >= 0 ? 'credit' : 'debit';
            // Format: NET CREDIT: Rs. +1000 (Credit)
            netBalanceEl.innerHTML = `NET CREDIT: <span class="${colorClass}">Rs.${netCredit > 0 ? '+' : ''}${netCredit} (${type})</span>`;
        }

        // Update Friends List
        const friendsListEl = document.getElementById('dashboard-friends-list');
        if (friendsListEl && data.friends) {
            if (data.friends.length === 0) {
                friendsListEl.innerHTML = '<p>No active balances with friends.</p>';
            } else {
                friendsListEl.innerHTML = data.friends.map(f => {
                    const amount = parseFloat(f.amount);
                    const colorClass = amount >= 0 ? 'credit' : 'debit';
                    return `<p>${f.name}: <span class="${colorClass}">Rs.${amount > 0 ? '+' : ''}${amount} (${f.type})</span></p>`;
                }).join('');
            }
        }

    } catch (error) {
        console.error("Error fetching dashboard data:", error);
    }
}

async function fetchFriendsData() {
    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) return;
        const userId = session.user.id;

        const response = await fetch(`/api/friends?userId=${userId}`);
        const data = await response.json();
        console.log("Friends Data:", data);

        const ul = document.querySelector('#page-friends ul');
        if (ul && Array.isArray(data)) {
            ul.innerHTML = data.map(group => `<li>${group.name}</li>`).join('');
        }

    } catch (error) {
        console.error("Error fetching friends data:", error);
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

        // Fetch Username via Backend API (to handle auto-creation securely)
        console.log("Fetching profile via backend API...");
        const userId = session.user.id;
        const email = session.user.email;

        // Call backend API
        const response = await fetch(`/api/profile?userId=${userId}&email=${email}`);
        const profile = await response.json();

        console.log("Profile Data (Backend):", profile);

        if (profile.error) {
            console.error("Error fetching profile from backend:", profile.error);
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
    }
};

/*SUPABASE SETUP*/

/*
  Supabase client is created in initApp() function above.
  The supabaseClient variable is initialized when the app starts.
*/


//    SEARCH USERS
async function searchUsers() {

    // Read text typed in the input field
    const query = document.getElementById("searchInput").value;

    // Clear old search results before showing new ones
    document.getElementById("searchResults").innerHTML = "";

    // Call PostgreSQL function using Supabase RPC
    const { data, error } = await supabaseClient.rpc(
        "search_users_by_username",   // SQL function name
        { search_query: query }       // Function parameter
    );
    if (error) {
        alert(error.message);
        return;
    }

    // Loop through all users returned from database
    data.forEach(user => {

        // Create a new <li> element
        const li = document.createElement("li");

        // Add username and Invite button inside <li>
        li.innerHTML = `
            ${user.username}
            <button onclick="inviteFriend('${user.id}')">
                Invite
            </button>
        `;

        // Add <li> to the search results list
        document.getElementById("searchResults").appendChild(li);
    });
}


//INVITE FRIEND
async function inviteFriend(targetId) {

    // Get the currently logged-in user
    const user = await supabaseClient.auth.getUser();

    // Call SQL function to send invite
    const { error } = await supabaseClient.rpc(
        "invite_friend_by_id",
        {
            inviter_id: user.data.user.id, // sender
            target_id: targetId             // receiver
        }
    );

    // Show success or error message
    if (error) {
        alert(error.message);
    } else {
        alert("Friend request sent!");
    }
}


//LOAD FRIEND REQUESTS
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


//ACCEPT FRIEND REQUEST

async function acceptRequest(id) {

    const { error } = await supabaseClient.rpc(
        "accept_friendship",
        { friendship_id: id }
    );

    // Show error or refresh list
    if (error) {
        alert(error.message);
    } else {
        loadFriendRequests();
    }
}


//DECLINE FRIEND REQUEST
async function declineRequest(id) {

    const { error } = await supabaseClient.rpc(
        "decline_friendship",
        { friendship_id: id }
    );

    // Show error or refresh list
    if (error) {
        alert(error.message);
    } else {
        loadFriendRequests();
    }
}

//INITIAL LOAD
loadFriendRequests();










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
