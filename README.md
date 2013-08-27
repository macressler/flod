<a href="https://github.com/spumko"><img src="https://raw.github.com/spumko/spumko/master/images/from.png" align="right" /></a>
![flod Logo](https://raw.github.com/spumko/flod/master/images/flod.png)

A systematic toolchain for benchmarking and comparing Node.js web server frameworks. **flod** enables developers to compare the performance of different versions of their frameworks and to other frameworks.

[![Build Status](https://secure.travis-ci.org/spumko/flod.png)](http://travis-ci.org/spumko/flod)


# Table of Contents

- [**Installation**](#installation)
- [**Quick Start**](#quick-start)
- [**Usage**](#usage)
    - [Local Testing](#local-bench)
    - [Remote Testing](#remote-testing)
    - [Daemon](#daemon)
- [Probe](#probe)


## Installation

Install using npm:

    npm install -g flod

OR by cloning this repository:

    git clone https://github.com/spumko/flod.git


## Quick Start

If installed globally with `-g`, the fastest way to try out flod is to run a local benchmark (this currently requires the user to clone the repository to access the files). Here are instructions on how to run a local benchmark on hapi version 1.0.0:

    cd examples/hapi@1.0.0
    npm install
    flod index.js

The above command will run the hapi version 1.0.0 example server and benchmark 100 `GET /` requests per second for a total of 1000 requests.


To see all of the available options and settings, run:

    flod -h


## Usage

Flod is designed to benchmark web servers. Flod will flood the webserver with a optionally specified number of concurrent requests and measure the latencies of each request until the specific total number of requests has been made.

Benchmarking JavaScript web servers is where flod really shines. With the use of the `flod.Probe`, flod is able to track useful metrics like memory usage and cpu load during the course of the benchmark. 

**Tip**: If given a large enough range of concurrency levels, Flod can pinpoint the number of requests per second (RPS) your server can handle. Any RPS levels that are rejected by the server will be noted with an 'n/a' under latency. Make use of the `-t` timeout flag in order to fully understand the behavior of your server under various levels of concurrency.

### Local Testing

To run a local JavaScript server benchmark, flod has the following basic syntax:

    flod [options] <filename>

where `filename` is a JavaScript file that starts a web server.


### Remote Testing

To perform a benchmark on a remote host, flod has the following basic syntax:

    flod [options] <URL>

where `URL` is a fully formed URL (with protocol http/https, hostname, path (and perhaps a port if not 80)).

If the remote host is running `flod.Probe`, additional statistics will be printed.

### Useful Flags and Options

- `-n MAX_REQS` - the maximum number of requests to perform at each concurrency level. Defaults to `1000`. Must be an integer.
- `-c c1..c2` - the concurrency levels in range notation. Flod will bench `c1` requests per second and increment by `-i` until `c2` requests per second. Defaults to `100..100`. Must be integers.
- `-i INCREMENT` - the increment amount used for concurrency level range. Defaults to `100`. Must be an integer.
- `-t TIMEOUT` - the time in milliseconds to wait for a request to complete before considering it lost. Defaults to `1500`. Must be an integer.
- `-m METHOD` - the HTTP method to use for the flood of requests. Defaults to `GET`. Must be a valid HTTP method string.
- `-u URI` - the HTTP path to use for the flood of requests. Defaults to `/`. Must be a URIEncoded string.
- `-o FILENAME` - the filename to output all the benchmark data (written as JSON). Default disabled. 
- `--force` - forces flod to overwrite `-o FILENAME` if it already exists

### Examples

- `flod -c 100..700 -n 10000 index.js` - will benchmark index.js in batches of 100, 200, 300, 400, 500, 600, and 700 `GET /` requests per second. Each batch will run for 10000 requests.
- `flod -p upload.json -m POST -c 100..200 -n 1000 index.js` - will benchmark index.js in batches of 100 and 200 requests per second. Each time it will POST to `/` with the contents of upload.json with the correct headers and mimetypes.



## Daemon Mode

To perform a benchmark of a JavaScript server on a different, remote computer, flod can daemonize a server file with the flag `--daemon`. This allows flod to perform a remote test as shown in [Remote Testing](#remote-testing).

    flod --daemon some_file.js


## Probe

To provide additional metrics during a JavaScript server benchmark, use the flod Probe.

From within the JS server file, include the following snippet:

```javascript
var Flod = require('flod');
var probe = new Flod.Probe(server, {server: SERVER, version: VERSION});
```

where `SERVER` could be `hapi` and `VERSION` could be `1.0.0` - change these to fit your needs.

### Probe API

#### `Probe(server, options)`

```
// Interface Example
var Flod = require('flod');
var server = new Hapi.Server(+process.env.port || 3000);
var probe = new Flod.Probe(server, {server: 'hapi', version: '1.8.0'});
```

- `server` - (required) variable pointing to your webserver. Acceptable webservers currently include Hapi, Express, and Restify. See the examples for more information regarding usage.
- `options` - (required) the Probe options
    - `server` - (required) the name of the webserver (`hapi`, `express`, `restify`). Must be a string.
    - `version` - (required) the version of the webserver being employed. Must be a Semantic Versioning string.
    - `manualStart` - if set to true, flod will wait for a `probe.ready()` function call before starting the benchmark. Defaults to null.

#### `Probe.ready(data)`

```
// Interface Example
var probe = new Flod.Probe(server, {server: 'hapi', version: '1.8.0'});
process.setTimeout(function(){
    probe.ready();
});
```

The ready function is used in conjunction with the `options.manualStart` flag. By default, flod will start benchmarking as soon as the server has started listening on a port. By utilizing manual start mode, you can have your server boot up and do some prefetching or preprocessing before the benchmark is executed.