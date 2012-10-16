http = require("http")
director = require("director")
CMinion = require("../../minion")
Minion = new CMinion()

download = () ->
  self = this
  
  fs.readFile(filepath, (err, data) ->
    throw err if err
    self.res.writeHead(200, {'Content-Type': 'text/plain'})
    self.res.send(data.toString())
    Minion.logRequest(this.req, true)
  )

router = new director.http.Router({
  "/": {
    get: download
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