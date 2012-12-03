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
  --metricInterval=INTERVAL      interval to poll server metrics in seconds
  --output=OUTPATH               place to store output files [default: ./logs/]
  --logPrefix=LOGPREFIX          prefix for backup files [default: bench]
"""