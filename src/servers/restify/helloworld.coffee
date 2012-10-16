restify = require("restify")
CMinion = require("../../minion")
Minion = new CMinion()

server = restify.createServer()
server.use(restify.queryParser())

server.get("/", (req, res) ->
  res.send("Hello World.")
  Minion.logRequest(req.query)
)

port = process.env.PORT || 3000
Minion.started()
server.listen(port, () ->
  console.log("Listening on port #{port}")
)