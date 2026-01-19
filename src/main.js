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
}