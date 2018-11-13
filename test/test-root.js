require('dotenv').config()
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
const should = chai.should();

describe('Root', function() {
  let server;

  before(async () => {
    server = await require(process.env.PWD+'/server')
  })

  it ('Returns the expected status', async () => {
     let response = await server.inject({
      method: 'GET',
      url: '/'
    })

    response.statusCode.should.eq(200)
    let payload = JSON.parse(response.payload)
    payload.status.should.eq('ok')
    payload.version.should.eq(require(process.env.PWD+'/package.json').version)
  })
})
