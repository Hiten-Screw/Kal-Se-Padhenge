// SUPABASE AUTHENTICATION

const supabaseUrl = 'https://qnyhmfndmtwkoofvufaa.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFueWhtZm5kbXR3a29vZnZ1ZmFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1NTc4MTEsImV4cCI6MjA4NDEzMzgxMX0.1I2CadOZN7gC-QdKgm2BXVEH9RPcI4reB9o99RPnTmY';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);


async function loginWithGoogle() {
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


window.onload = async () => {
    const { data: { session } } = await supabaseClient.auth.getSession();

    if (session) {
        document.querySelector('.page-login').style.display = 'none';

        document.getElementById('nav').style.display = 'block';
        navigateTo('page-dashboard');
        
        console.log("Logged in as:", session.user.email);
    }
    
};


//switch between Dashboard, Friends, and Settings
function navigateTo(pageId) {
    const subPages = ['page-dashboard', 'page-friends', 'page-settings'];
    subPages.forEach(id => {
        const element = document.getElementById(id);
        if (element) element.style.display = 'none';
    });
    document.getElementById(pageId).style.display = 'block';
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
  Create a Supabase client so JavaScript can communicate
  with Supabase (authentication + database).
*/
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);


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
    const { data, error } = await supabase.rpc(
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
    const user = await supabase.auth.getUser();

    // Call SQL function to send invite
    const { error } = await supabase.rpc(
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
    const user = await supabase.auth.getUser();

    // Query Friends table for pending requests
    const { data } = await supabase
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

    const { error } = await supabase.rpc(
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

    const { error } = await supabase.rpc(
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


