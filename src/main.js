// SUPABASE AUTHENTICATION
let supabaseClient;
let supabaseUrl;
let supabaseKey;

async function initApp() {
    try {
        const response = await fetch('/api/config');
        const config = await response.json();
        supabaseUrl = config.supabaseUrl;
        supabaseKey = config.supabaseKey;

        if (!supabaseUrl || !supabaseKey || supabaseKey.includes('YOUR_SUPABASE')) {
            console.error("Invalid Supabase Configuration.");
            alert("Configuration Error: Please update the .env file with your Supabase keys.");
            return;
        }

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

        // Event listener for Quick Add
        const quickBtn = document.getElementById('btn-quick-add');
        if (quickBtn) {
            quickBtn.removeEventListener('click', handleQuickAdd);
            quickBtn.addEventListener('click', handleQuickAdd);
        }

    } catch (error) {
        console.error("Failed to initialize app:", error);
        alert("Critical Error: Failed to initialize app. Check console for details. " + error.message);
    }
}

function handleLoginSuccess(session) {
    document.querySelector('.page-login').style.display = 'none';
    document.getElementById('nav').style.display = 'block';

    // Only navigate if we are currently on the login page (or root) to avoid resetting navigation
    const dashboard = document.getElementById('page-dashboard');
    if (dashboard && dashboard.style.display !== 'block') {
        navigateTo('page-dashboard');
    }

    console.log("Logged in as:", session.user.email);
}

async function loginWithGoogle() {
    console.log("Login button clicked");
    if (!supabaseClient) {
        console.error("Supabase client not initialized yet.");
        alert("App loading... please wait a moment and try again.");
        return;
    }

    // DEBUG: Alert before attempt
    // alert("Attempting to connect to Google Auth...");

    const { data, error } = await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: window.location.href
        }
    });

    if (error) {
        console.error("Login Error:", error.message);
        alert("Login Error: " + error.message);
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
        window.location.reload();
    }
}

/* =========================================================
   FRIENDS AND SEARCH LOGIC (CONSOLIDATED)
   ========================================================= */

async function searchUsers() {
    if (!supabaseClient) return;
    const queryEl = document.getElementById("searchInput");
    if (!queryEl) return;
    const query = queryEl.value;
    const resultsEl = document.getElementById("searchResults");
    if (resultsEl) resultsEl.innerHTML = "Searching...";

    const { data, error } = await supabaseClient.rpc(
        "search_users_by_username",
        { search_query: query }
    );

    if (error) {
        alert("Search error: " + error.message);
        if (resultsEl) resultsEl.innerHTML = "";
        return;
    }

    if (resultsEl) {
        resultsEl.innerHTML = "";
        data.forEach(user => {
            const li = document.createElement("li");
            li.innerHTML = `
                ${user.username}
                <button onclick="inviteFriend('${user.id}')">Invite</button>
            `;
            resultsEl.appendChild(li);
        });
    }
}

async function inviteFriend(targetId) {
    if (!supabaseClient) return;
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
        alert("You must be logged in to invite friends.");
        return;
    }

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
    if (!supabaseClient) return;
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return;

    const { data, error } = await supabaseClient
        .from("Friends")
        .select("id, user1_id, Profile:Profile!Friends_user1_id_fkey(username)")
        .eq("user2_id", user.id)
        .eq("status", "pending");

    if (error) {
        console.error("Error loading friend requests:", error);
        return;
    }

    const requestsEl = document.getElementById("friendRequests");
    if (requestsEl) {
        requestsEl.innerHTML = "";
        data.forEach(req => {
            const li = document.createElement("li");
            li.innerHTML = `
                ${req.Profile.username}
                <button onclick="acceptRequest('${req.id}')">Accept</button>
                <button onclick="declineRequest('${req.id}')">Decline</button>
            `;
            requestsEl.appendChild(li);
        });
    }
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
window.inviteFriend = inviteFriend;
window.acceptRequest = acceptRequest;
window.declineRequest = declineRequest;
window.loadFriendRequests = loadFriendRequests;
window.handleLogout = handleLogout;


