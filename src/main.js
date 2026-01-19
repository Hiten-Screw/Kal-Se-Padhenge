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

            console.log("Creating Supabase client...");
            supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);
            console.log("Supabase client initialized successfully");

            // Check Session with timeout
            console.log("Checking existing session...");
            const sessionPromise = supabaseClient.auth.getSession();
            const sessionController = new AbortController();
            const sessionTimeout = setTimeout(() => sessionController.abort(), 5000); // 5 second timeout
            
            let session = null;
            try {
                const { data } = await Promise.race([
                    sessionPromise,
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Session check timeout')), 5000)
                    )
                ]);
                session = data?.session || null;
                clearTimeout(sessionTimeout);
            } catch (sessionError) {
                console.warn("Session check timed out or failed:", sessionError.message);
                clearTimeout(sessionTimeout);
                // Continue even if session check fails
            }

            if (session) {
                document.querySelector('.page-login').style.display = 'none';
                document.getElementById('nav').style.display = 'block';
                navigateTo('page-dashboard');
                console.log("Logged in as:", session.user.email);
            } else {
                // Enable the login button
                const loginBtn = document.getElementById('btn');
                if (loginBtn) {
                    loginBtn.disabled = false;
                    loginBtn.textContent = 'Continue with google';
                    console.log("Login button enabled");
                }
            }

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

async function loginWithGoogle() {
    // Wait for initialization to complete
    if (!supabaseClient) {
        console.log("Waiting for app initialization...");
        try {
            await initApp();
        } catch (error) {
            console.error("Initialization failed:", error);
            alert("App failed to initialize. Please refresh the page.");
            return;
        }
    }

    if (!supabaseClient) {
        alert("App failed to initialize. Please refresh the page.");
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

        // Fetch Username from Profile table
        console.log("Fetching profile for user:", session.user.id);
        const { data: profile, error } = await supabaseClient
            .from('Profile')
            .select('*')
            .eq('id', session.user.id)
            .single();

        console.log("Profile Data:", profile);

        let displayProfile = profile;

        if (!profile && !error) {
            // Case: No error (or specific PGRST116), but no data returned logic might vary. 
            // Supabase .single() returns error code PGRST116 if no rows found.
        }

        // If error is "No rows found" (PGRST116) or data is null, try to create one
        if ((error && error.code === 'PGRST116') || (!profile && !error)) {
            console.log("No profile found. Creating one...");
            const username = session.user.email.split('@')[0];

            const { data: newProfile, error: createError } = await supabaseClient
                .from('Profile')
                .insert([
                    { id: session.user.id, email: session.user.email, username: username }
                ])
                .select()
                .single();

            if (createError) {
                console.error("Error creating auto-profile:", createError);
            } else {
                console.log("Auto-profile created:", newProfile);
                displayProfile = newProfile;
            }
        } else if (error) {
            console.error("Error fetching profile:", error);
        }

        const usernameEl = document.getElementById('settings-username');
        if (usernameEl) {
            if (displayProfile && displayProfile.username) {
                usernameEl.textContent = `Name: ${displayProfile.username}`;
            } else {
                usernameEl.textContent = `Name: (Not Set)`;
            }
        }

    } catch (error) {
        console.error("Error fetching settings data:", error);
    }
}

//logout
window.handleLogout = async function() {
  const { error } = await supabaseClient.auth.signOut();
  
  if (error) {
    console.error('Error logging out:', error.message);
  } else {
    window.location.reload(); 
  }
}

/* =========================================================
   SUPABASE SETUP
   ========================================================= */

/*
  Supabase client is created in initApp() function above.
  The supabaseClient variable is initialized when the app starts.
*/


/* =========================================================
   SEARCH USERS
   ========================================================= */

/*
  Runs when the "Search" button is clicked.
  - Reads username from input
  - Calls SQL search function
  - Shows results on screen
*/
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

    // If something goes wrong, show error and stop
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


/* =========================================================
   INVITE FRIEND
   ========================================================= */

/*
  Sends a friend request when "Invite" is clicked
*/
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


/* =========================================================
   LOAD FRIEND REQUESTS
   ========================================================= */

/*
  Fetches all pending friend requests
  for the logged-in user
*/
async function loadFriendRequests() {

    // Get current user
    const user = await supabaseClient.auth.getUser();

    // Query Friends table for pending requests
    const { data } = await supabaseClient
        .from("Friends")
        .select(
            "id, user1_id, Profile:Profile!Friends_user1_id_fkey(username)"
        )
        .eq("user2_id", user.data.user.id) // requests sent to me
        .eq("status", "pending");          // only pending ones

    // Clear old list
    document.getElementById("friendRequests").innerHTML = "";

    // Show each request on the page
    data.forEach(req => {

        // Create list item
        const li = document.createElement("li");

        // Add username and action buttons
        li.innerHTML = `
            ${req.Profile.username}
            <button onclick="acceptRequest('${req.id}')">
                Accept
            </button>
            <button onclick="declineRequest('${req.id}')">
                Decline
            </button>
        `;

        // Add to requests list
        document.getElementById("friendRequests").appendChild(li);
    });
}


/* =========================================================
   ACCEPT FRIEND REQUEST
   ========================================================= */

/*
  Accepts a pending friend request
*/
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


/* =========================================================
   DECLINE FRIEND REQUEST
   ========================================================= */

/*
  Declines or cancels a friend request
*/
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


/* =========================================================
   INITIAL LOAD
   ========================================================= */

/*
  Automatically load friend requests
  when the page opens
*/
loadFriendRequests();


window.handleLogout = async function () {
    const { error } = await supabaseClient.auth.signOut();

    if (error) {
        console.error('Error logging out:', error.message);
    } else {
        window.location.reload();
    }
}

