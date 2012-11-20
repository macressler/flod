module.exports = """
Usage: 
  flod [<action>] [options]

Options:
  -h, --help                     show this help message and quit
  -v, --verbose                  verbose mode
  --version                      show version
  -n REQUESTS                    total number of requests to send [default: 1000]
  -c CONCURRENTS                 number of concurrent requests allowed [default: 100]
  --host=HOST                    host to make requests to (may incl :port)[default: http://localhost:3000]
  --admin=ADMINHOST              host to use for admin requests (if different from --host)[default: http://localhost:8000]
  --serverFile=SERVERFILE        force server to use a specific test file (must exist on host)
  --reset                        request a webserver reset
"""