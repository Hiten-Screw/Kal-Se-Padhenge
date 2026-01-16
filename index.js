const express = require('express')
const app = express()
const port = 4000

app.get('/intellidivde', (req, res) => {
  res.send('<h2>WELCOME TO INTELLIDIVIDE<h2>')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
