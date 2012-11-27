module.exports = """
Usage:
  flodd <action> [options]
  flodd clean [options]
  flodd run <filename> [options]

Options:
  -h, --help                     show this help message
  -v, --verbose                  verbose mode
  --version                      show version
  --noBackups                    disable storing data in ./logs folder
  --metricInterval=INTERVAL      interval to poll server metrics in seconds [default: 5000]
  --logPath=LOGPATH              place to store backup files [default: ./logs/]
  --logPrefix=LOGPREFIX          prefix for backup files [default: bench]
"""