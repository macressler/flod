_ = require("underscore")
async = require("async")
fs = require("fs")
http = require("http")
qs = require("querystring")
request = require("request")
url = require("url")
Statistics = require("./statistics")

class Requester extends Statistics
  constructor: (options) ->
    @options = _.extend({}, @_options, @docopt2obj(options))
    
    http.Agent.defaultMaxSockets = @options.concurrents
    http.globalAgent.maxSockets = @options.concurrents
    
    @latency = new Array(@options.requests)
    @requestCounter = 0
    @responseCounter = 0
  
  _options: {
    requests: 1000,
    concurrents: 50,
    ssl: false,
    debug: false
  }
  
  _tests: ["helloworld", "largeDownload", "largePOST", "massiveRouteTable"]
  
  docopt2obj: (opts) ->
    obj = {
      requests: +opts["-n"],
      concurrents: +opts["-c"],
      host: opts["--host"],
      admin: opts["--admin"],
      server: opts["--server"],
      test: opts["--test"],
      verbose: opts["--verbose"],
      debug: opts["--debug"]
    }
  
  helloworld: (i, callback) =>
    self = this
    i = self.requestCounter
    self.requestCounter++
    start_time = Date.now()
    opts = {
      method: "GET",
      uri: self.options.host+"/?id=" + self.options.id
    }
    request(opts, (err, response, body) ->
      end_time = Date.now()
      self.latency[i] = end_time - start_time
      self.responseCounter++
      
      callback(err)
    )
  
  largeDownload: (i, callback) =>
    @helloworld(i, callback)
  
  largePOST: (i, callback) =>
    self = this
    i = self.requestCounter
    self.requestCounter++
    contents = fs.readFileSync("/usr/share/dict/words")
    start_time = Date.now()
    opts = {
      method: "POST",
      uri: self.options.host+"/?id=" + self.options.id
      body: contents
    }
    request(opts, (err, response, body) ->
      end_time = Date.now()
      self.latency[i] = end_time - start_time
      self.responseCounter++
      
      callback(err)
    )
  
  massiveRouteTable: (i, callback) =>
    @helloworld(i, callback)
  
  bench: (index, concurrents, max, callback) ->
    self = this
    
    return callback("invalid concurrents value") if not concurrents or isNaN(concurrents)
    return callback("invalid max value") if not max or isNaN(max)
    return callback(null) if index > (max - concurrents)
    return callback("invalid test supplied #{self.options.test}") if self._tests.indexOf(self.options.test) < 0
    
    async.forEach([1..concurrents], self[self.options.test], (err) ->
      return callback(err) if err
      
      self.bench(index + concurrents, concurrents, max, callback)
    )
    # callback(null)
    # self.makeRequest(1, callback)
  
  initBench: (callback) ->
    # return callback(null) if not @options.server or not @options.test
    self = this
    url = [@options.admin, "bench", "init"].join("/")
    params = {
      server: @options.server,
      test: @options.test
    }
    url += "?" + qs.stringify(params)
    opts = {
      method: "GET",
      uri: url
    }
    
    console.log(opts) if @options.debug
    
    request(opts, (err, response, body) ->
      throw err if err
      try
        data = JSON.parse(body)
      catch e
        throw e
      
      console.log(opts.uri, "data", data) if self.options.debug
      
      callback(null)
    )
  
  startBench: (callback) ->
    self = this
    url = [@options.admin, "bench", "start"].join("/")
    # url += "?n=#{@options.requests}&c=#{@options.concurrents}"
    params = {
      n: @options.requests,
      c: @options.concurrents
    }
    url += "?" + qs.stringify(params)
    opts = {
      method: "GET",
      uri: url
    }
    
    console.log(opts) if @options.debug
    
    request(opts, (err, response, body) ->
      throw err if err
      try
        data = JSON.parse(body)
      catch e
        throw e
      
      console.log(opts.uri, "data", data) if self.options.debug
      
      callback(null, data.id, data)
    )
  
  finishBench: (id, callback) ->
    url = [@options.admin, "bench", "finish"].join("/")
    url += "?id=#{id}"
    opts = {
      method: "GET",
      uri: url
    }
    request(opts, (err, response, body) ->
      throw err if err
      
      try
        data = JSON.parse(body)
      catch e
        console.log(body)
        throw e
      
      callback(err, data)
    )
  
  resetBench: (callback = null) ->
    url = [@options.admin, "bench", "reset"].join("/")
    url += "?code=walmartlabs"
    opts = {
      method: "GET",
      uri: url
    }
    request(opts, (err, response, body) ->
      throw err if err
      
      try
        data = JSON.parse(body)
      catch e
        console.log(body)
        throw e
      
      callback(err, data) if callback and typeof callback == 'function'
    )
  
  printLatency: () ->
    min = @min(@latency)
    max = @max(@latency)
    lmean = @mean(@latency)
    lmedian = @median(@latency)
    lstddev = @stdDev(@latency)
    
    console.log("Latencies:")
    console.log("\tmin =", min)
    console.log("\tmax =", max)
    console.log("\tmean =", lmean)
    console.log("\tmedian =", lmedian)
    console.log("\tstd dev =", lstddev)
  
  start: () ->
    self = this
    console.log("start()") if self.options.debug
    
    @initBench((err) ->
      throw err if err
      
      self.startBench((err, id) ->
        throw err if err
        
        self.options.id = id
        console.log("startBench returned with id = #{id}") if self.options.debug
        console.log("benching", self.options.host+"/?id=" + self.options.id) if self.options.debug
        console.log("n=#{self.options.requests}, c=#{self.options.concurrents}")
        
        self.bench(0, self.options.concurrents, self.options.requests, (err) ->
          throw err if err
          
          self.finishBench(id, (err, response) =>
            throw err if err
            
            console.log("finished bench")
            console.log(response)
            # print statistics?
            console.log("completed #{self.requestCounter} out of #{self.options.requests}")
            self.printLatency()
            
            # backup to file
          )
        )
      )
    )

module.exports = Requester