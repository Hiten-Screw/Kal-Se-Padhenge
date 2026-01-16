localStorage.setItem("isLoggedIn", "true");
// Step 1: Select logout button
const logoutBtn = document.getElementById("logoutBtn");

// Step 2: Attach click event
logoutBtn.addEventListener("click", function () {

    // Step 3: Remove login data
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("user");   // optional
    localStorage.removeItem("token");  // optional

    // Step 4: Redirect to login page
    window.location.href = "login.html";
});
if (!localStorage.getItem("isLoggedIn")) {
    window.location.href = "login.html";
}
