const express = require('express')
const path = require('path')
const app = express()
const port = 4000

// Serve static files from the root directory
app.use(express.static(path.join(__dirname)))

// Mock Data
const dashboardData = {
  netCredit: 1000,
  friends: [
    { name: "Satyam", amount: 500, type: "Credit" },
    { name: "Abhi", amount: -300, type: "Debit" },
    { name: "Neha", amount: 1200, type: "Credit" },
    { name: "Pooja", amount: -400, type: "Debit" }
  ]
};

const friendsData = [
  { name: "xyz", members: 2 },
  { name: "abc", members: 6 }
];

// API Endpoints
app.get('/api/dashboard', (req, res) => {
  res.json(dashboardData);
})

app.get('/api/friends', (req, res) => {
  res.json(friendsData);
})

// Fallback to index.html for SPA handling if needed (optional for now since we just serve root)
app.get(/(.*)/, (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})

