require('dotenv').config()
const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')
chai.use(chaiAsPromised)
const should = chai.should()
const uuid = require('uuid/v4')

describe('Users', function() {
  let server;

  before(async () => {
    server = await require(process.env.PWD+'/server')
  })

  describe('Creating a login account', () => {
    let email = `${uuid()}@time.com`;
    let password = 'valid_password'

    it('Rejects if email is missing', async () => {
      let response = await server.inject({
        method: 'POST',
        url: '/users',
        payload: { password },
        headers: {}
      })
      response.statusCode.should.eq(400)
    })

    it('Rejects if password is missing', async () => {
      let response = await server.inject({
        method: 'POST',
        url: '/users',
        payload: { email },
        headers: {}
      })
      response.statusCode.should.eq(400)
    })

    it('Rejects if email is invalid', async () => {
      let response = await server.inject({
        method: 'POST',
        url: '/users',
        payload: { email: 'notAnEmail', password },
        headers: {}
      })
      response.statusCode.should.eq(400)
    })

    it('Rejects if password is invalid', async () => {
      let response = await server.inject({
        method: 'POST',
        url: '/users',
        payload: { email, password: 'not' },
        headers: {}
      })
      response.statusCode.should.eq(400)
    })

    it('Accepts with a valid email and password', async () => {
      let response = await server.inject({
        method: 'POST',
        url: '/users',
        payload: { email, password },
        headers: {}
      })
      response.statusCode.should.eq(200)
      response.payload = JSON.parse(response.payload)
      response.payload.id.should.be.a('number')
    })

    it('Rejects with a duplicate email', async () => {
      let response = await server.inject({
        method: 'POST',
        url: '/users',
        payload: { email, password },
        headers: {}
      })
      response.statusCode.should.eq(409)
    })
  })
})
