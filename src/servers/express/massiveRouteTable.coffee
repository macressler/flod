express = require("express")
CMinion = require("../../minion")
Minion = new CMinion()

app = express()
port = process.env.PORT || 3000
MAXROUTES = process.env.MAXROUTES || 100000

for i in [0..MAXROUTES]
  r = "/#{i}"
  app.get(r, (req, res) -> 
    res.send("Hello World.")
    Minion.logRequest(req.query)
  )


Minion.started()
app.listen(port, () ->
  console.log("Listening on port #{port}")
)