restify = require("restify")
fs = require("fs")
CMinion = require("../../minion")
Minion = new CMinion()

filepath = "/usr/share/dict/words"
server = restify.createServer()
server.use(restify.queryParser())

server.get("/", (req, res) ->
  fs.readFile(filepath, (err, data) ->
    throw err if err
    res.send(data.toString())
    Minion.logRequest(req.query)
  )
)

port = process.env.PORT || 3000
Minion.started()
server.listen(port, () ->
  console.log("Listening on port #{port}")
)