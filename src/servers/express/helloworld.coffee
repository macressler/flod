express = require("express")
CMinion = require("../../minion")
Minion = new CMinion()

app = express()
app.get("/", (req, res) ->
  res.send("Hello World.")
  Minion.logRequest(req.query)
)

port = process.env.PORT || 3000
Minion.started()
app.listen(port, () ->
  console.log("Listening on port #{port}")
)