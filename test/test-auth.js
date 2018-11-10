require('dotenv').config()
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
const should = chai.should();
const querystring = require('querystring')

// Initialize Time Core to seed DB as-needed
const config = require('./setup/config')
const Time = require('time-core')(config)
const UserHelper = require('./helpers/user')

describe('Auth', function() {
  let server;
  let user;
  before(async () => {
    server = await require(process.env.PWD+'/server')

    UserHelper.link(Time)
    user = await UserHelper.create()
  })

  describe('Logging in', () => {
    it('works', async () => {
      let postData = querystring.stringify({
        grant_type: 'password',
        email: user.email,
        password: user.password
      })

      let response = await server.inject({
        method: 'POST',
        url: '/oauth/token',
        payload: postData,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': postData.length
        }
      })

      response.statusCode.should.eq(200)

      payload = JSON.parse(response.payload)

      payload.user_id.should.be.a('number')
      payload.creation.should.be.a('number')
      payload.expiration.should.be.a('number')
      payload.token.should.be.a('string')
      payload.refresh.should.be.a('string')
    })
  })

  after(async () => {
    await UserHelper.cleanup(user)
  })
})
