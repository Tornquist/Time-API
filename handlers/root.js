let myPackage = require('../package.json')
let version = myPackage.version

exports.path = '/'

exports.get = {
  handler: (request, h) => {
    return { status: 'ok', version }
  }
}
