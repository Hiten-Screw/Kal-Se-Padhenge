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
    }
}

async function fetchDashboardData() {
    try {
        const response = await fetch('/api/dashboard');
        const data = await response.json();

        // Update DOM (Simple implementation based on existing HTML structure)
        // Finding the RIGHT section container.
        // The HTML structure for dashboard is a bit loose, so we'll try to find specific elements or rebuild parts.
        // Ideally we should add IDs to the HTML elements to make this robust.
        // For now, let's log it to ensure it works and try to update if possible.
        console.log("Dashboard Data:", data);

        // Example: Update "Satyam:Rs.+500(Credit)" sections dynamically
        // Since the current HTML is static text, let's assume we replace the content of the "right" aligned div
        // This is a bit brittle without checking the DOM structure again, but let's try to target the paragraphs.

        const rightDiv = document.querySelector('#page-dashboard div[align="right"]');
        if (rightDiv) {
            rightDiv.innerHTML = data.friends.map(f => `<p>${f.name}:Rs.${f.amount > 0 ? '+' : ''}${f.amount}(${f.type})</p>`).join('');
        }

    } catch (error) {
        console.error("Error fetching dashboard data:", error);
    }
}

async function fetchFriendsData() {
    try {
        const response = await fetch('/api/friends');
        const data = await response.json();
        console.log("Friends Data:", data);

        const ul = document.querySelector('#page-friends ul');
        if (ul) {
            ul.innerHTML = data.map(group => `<li>${group.name} (${group.members} members)</li>`).join('');
        }

    } catch (error) {
        console.error("Error fetching friends data:", error);
    }
}
