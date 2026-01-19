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

        // Check Session
        const { data: { session } } = await supabaseClient.auth.getSession();

        if (session) {
            document.querySelector('.page-login').style.display = 'none';
            document.getElementById('nav').style.display = 'block';
            navigateTo('page-dashboard');
            console.log("Logged in as:", session.user.email);
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

    } catch (error) {
        console.error("Failed to initialize app:", error);
    }
}

async function loginWithGoogle() {
    if (!supabaseClient) {
        alert("App not initialized.");
        return;
    }
    const { data, error } = await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: window.location.href
        }
    });

    if (error) {
        console.error("Login Error:", error.message);
        alert("Failed to connect to Google.");
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
window.handleLogout = async function () {
    const { error } = await supabaseClient.auth.signOut();

    if (error) {
        console.error('Error logging out:', error.message);
    } else {
        window.location.reload();
    }
}

