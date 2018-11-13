// Start server before all tests

require('dotenv').config()

before(function() {
  this.timeout(5000)
  return require(process.env.PWD+'/server')
})
