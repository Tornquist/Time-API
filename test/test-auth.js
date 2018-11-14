require('dotenv').config()
const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')
chai.use(chaiAsPromised)
const should = chai.should()
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

  let oauthRequest = async (query, queryOverride = {}, headerOverride = {}) => {
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

  let authRequest = async (queryOverride = {}, headerOverride = {}) => {
    return await oauthRequest({
      grant_type: 'password',
      username: user.email,
      password: user.password
    },
      queryOverride,
      headerOverride
    )
  }

  let refreshRequest = async (token, queryOverride = {}, headerOverride = {}) => {
    return await oauthRequest({
      grant_type: 'refresh_token',
      refresh_token: token
    },
      queryOverride,
      headerOverride
    )
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

      it('is rejected if the content-type is missing', async () => {
        let response = await authRequest({}, { 'Content-Type': null })

        response.statusCode.should.eq(400)
        response.payload.message.should.eq('Invalid request payload JSON format')
      })

      it('is rejected if the content-type is not form urlencoded', async () => {
        let response = await server.inject({
          method: 'POST',
          url: '/oauth/token',
          payload: {
            grant_type: 'password',
            username: user.email,
            password: user.password
          },
          headers: {
            'Content-Type': 'application/json'
          }
        })
        response.payload = JSON.parse(response.payload)

        response.statusCode.should.eq(400)
        response.payload.message.should.eq(
          'Unsupported mime type. [application/x-www-form-urlencoded] Supported'
        )
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

  describe('Refreshing an activation token', () => {
    describe('Rejections', () => {
      let validToken;
      before(function() {
        this.timeout(5000)
        return authRequest()
        .then(_response => {
          validToken = _response
        })
      })

      it('is rejected if the token is invalid', async () => {
        let response = await refreshRequest('madeUpToken')
        response.statusCode.should.eq(400)
        response.payload.message.should.eq('Bad Request')
      })

      it('is rejected if the token has expired', async () => {
        // Get token ID
        let result = await Time._db.max('id')
          .from('token')
          .where('user_id', validToken.payload.user_id)
        let tokenID = Object.values(result[0])[0]

        // Expire refresh
        await Time._db('token')
          .update(
            'refresh_expires_at',
            Time._db.raw('CURRENT_TIMESTAMP - INTERVAL 1 HOUR')
          )

        // Use expired token
        let response = await refreshRequest(validToken.payload.refresh)

        response.statusCode.should.eq(401)
        response.payload.message.should.eq('Unauthorized')
      })
    })

    describe('Success', () => {
      let validToken;
      before(function() {
        this.timeout(5000)
        return authRequest()
        .then(_response => {
          validToken = _response
        })
      })

      it('returns a valid authentication token and refresh token', async () => {
        let response = await refreshRequest(validToken.payload.refresh)

        response.statusCode.should.eq(200)

        response.payload.user_id.should.be.a('number')
        response.payload.creation.should.be.a('number')
        response.payload.expiration.should.be.a('number')
        response.payload.token.should.be.a('string')
        response.payload.refresh.should.be.a('string')

        response.payload.token.should.not.eq(validToken.payload.token)
        response.payload.refresh.should.not.eq(validToken.payload.refresh)
      })

      it('allows a refresh token to be used more than once', async () => {
        let response = await refreshRequest(validToken.payload.refresh)

        response.statusCode.should.eq(200)

        response.payload.user_id.should.be.a('number')
        response.payload.creation.should.be.a('number')
        response.payload.expiration.should.be.a('number')
        response.payload.token.should.be.a('string')
        response.payload.refresh.should.be.a('string')

        response.payload.token.should.not.eq(validToken.payload.token)
        response.payload.refresh.should.not.eq(validToken.payload.refresh)
      })
    })
  })

  describe('Using activation tokens with secure endpoints', () => {
    let validToken;
    before(function() {
      this.timeout(5000)
      return authRequest()
      .then(_response => {
        validToken = _response
      })
    })

    let genericRequest = async (headers = {}) => {
      let response = await server.inject({
        method: 'GET',
        url: '/account/9',
        headers: headers
      })

      return response
    }

    it('Rejects access when no authentication header is present', async () => {
      let response = await genericRequest()

      response.statusCode.should.eq(401)
    })

    it('Rejects access when an invalid header is present', async () => {
      let response = await genericRequest({
        'Authorization': 'Does not match regex at all'
      })

      response.statusCode.should.eq(401)
    })

    it('Rejects access when an invalid token', async () => {
      let response = await genericRequest({
        'Authorization': 'Bearer madeUpToken'
      })

      response.statusCode.should.eq(401)
    })

    it('Accepts with a valid authentication header', async () => {
      let response = await genericRequest({
        'Authorization': `Bearer ${validToken.payload.token}`
      })

      response.statusCode.should.not.eq(401)
    })
  })

  after(async () => {
    await UserHelper.cleanup(user)
  })
})
