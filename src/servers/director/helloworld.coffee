http = require("http")
director = require("director")
CMinion = require("../../minion")
Minion = new CMinion()

helloWorld = () ->
  this.res.writeHead(200, {'Content-Type': 'text/plain'})
  this.res.end("Hello World.")
  Minion.logRequest(this.req, true)

router = new director.http.Router({
  "/": {
    get: helloWorld
  }
})

server = http.createServer((req, res) ->
  router.dispatch(req, res, (err) ->
    if err
      res.writeHead(404)
      res.end()
  )
)

Minion.started()
port = process.env.PORT || 3000
server.listen(port)