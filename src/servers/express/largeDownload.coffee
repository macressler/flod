express = require("express")
fs = require("fs")
filepath = "/usr/share/dict/words"
CMinion = require("../../minion")
Minion = new CMinion()

app = express()
app.get("/", (req, res) ->
  fs.readFile(filepath, (err, data) ->
    throw err if err
    res.send(data.toString())
    Minion.logRequest(req.query)
  )
)

port = process.env.PORT || 3000
Minion.started()
app.listen(port, () ->
  console.log("Listening on port #{port}")
)