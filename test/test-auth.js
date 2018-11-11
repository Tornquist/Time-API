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

  let authRequest = async (queryOverride = {}, headerOverride = {}) => {
    let query = {
      grant_type: 'password',
      username: user.email,
      password: user.password
    }

    Object.keys(queryOverride).forEach(key =>
      queryOverride[key] != null
        ? query[key] = queryOverride[key]
        : delete query[key]
    )

    let postData = querystring.stringify(query)

    let headers = {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': postData.length
    }

    Object.keys(headerOverride).forEach(key =>
      headerOverride[key] != null
        ? headers[key] = headerOverride[key]
        : delete headers[key]
    )

    let response = await server.inject({
      method: 'POST',
      url: '/oauth/token',
      payload: postData,
      headers: headers
    })

    response.payload = JSON.parse(response.payload)
    return response
  }

  describe('Non refresh or password grants', () => {
    it('is rejected', async () => {
      let response = await authRequest({ grant_type: 'facebook' }, {})

      response.statusCode.should.eq(400)
      response.payload.message.should.eq('Invalid request payload input')
    })
  })

  describe('Requesting an authentication token', () => {

    describe('Rejections', () => {
      it('is rejected if grant_type is missing', async () => {
        let response = await authRequest({ grant_type: null }, {})

        response.statusCode.should.eq(400)
        response.payload.message.should.eq('Invalid request payload input')
      })

      it('is rejected if password is missing', async () => {
        let response = await authRequest({ password: null }, {})

        response.statusCode.should.eq(400)
        response.payload.message.should.eq('Invalid request payload input')
      })

      it('is rejected if username is missing', async () => {
        let response = await authRequest({ username: null }, {})

        response.statusCode.should.eq(400)
        response.payload.message.should.eq('Invalid request payload input')
      })

      it('is rejected if the content-type is not form urlencoded', async () => {
        let response = await authRequest({}, { 'Content-Type': null })

        response.statusCode.should.eq(400)
        response.payload.message.should.eq('Invalid request payload JSON format')
      })

      it('is rejected if the password is incorrect', async () => {
        let response = await authRequest({ password: 'Super wrong pass'}, {})

        response.statusCode.should.eq(401)
        response.payload.message.should.eq('Unauthorized')
      })
    })

    describe('Success', async () => {
      it('returns a valid authentication token and refresh token', async () => {
        let response = await authRequest({}, {})

        response.statusCode.should.eq(200)

        response.payload.user_id.should.be.a('number')
        response.payload.creation.should.be.a('number')
        response.payload.expiration.should.be.a('number')
        response.payload.token.should.be.a('string')
        response.payload.refresh.should.be.a('string')
      })
    })
  })

  describe('Refreshing an activation token', async () => {
    it('is rejected if the token has expired')

    it('is rejected if the token is invalid')
  })

  after(async () => {
    await UserHelper.cleanup(user)
  })
})
