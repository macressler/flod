restify = require("restify")
CMinion = require("../../minion")
Minion = new CMinion()

server = restify.createServer()
server.use(restify.bodyParser())
server.use(restify.queryParser())

server.post("/", (req, res) ->
  res.send(req.headers["content-length"])
  Minion.logRequest(req.query)
)

port = process.env.PORT || 3000
Minion.started()
server.listen(port, () ->
  console.log("Listening on port #{port}")
)