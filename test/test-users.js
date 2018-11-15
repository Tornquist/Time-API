require('dotenv').config()
const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')
chai.use(chaiAsPromised)
const should = chai.should()
const uuid = require('uuid/v4')
const querystring = require('querystring')

describe('Users', function() {
  let server;
  let createdUser = null;

  let email = `${uuid()}@time.com`;
  let password = 'valid_password'

  before(async () => {
    server = await require(process.env.PWD+'/server')
  })

  describe('Creating a login account', () => {
    it('rejects if email is missing', async () => {
      let response = await server.inject({
        method: 'POST',
        url: '/users',
        payload: { password },
        headers: {}
      })
      response.statusCode.should.eq(400)
    })

    it('rejects if password is missing', async () => {
      let response = await server.inject({
        method: 'POST',
        url: '/users',
        payload: { email },
        headers: {}
      })
      response.statusCode.should.eq(400)
    })

    it('rejects if email is invalid', async () => {
      let response = await server.inject({
        method: 'POST',
        url: '/users',
        payload: { email: 'notAnEmail', password },
        headers: {}
      })
      response.statusCode.should.eq(400)
    })

    it('rejects if password is invalid', async () => {
      let response = await server.inject({
        method: 'POST',
        url: '/users',
        payload: { email, password: 'not' },
        headers: {}
      })
      response.statusCode.should.eq(400)
    })

    it('accepts with a valid email and password', async () => {
      let response = await server.inject({
        method: 'POST',
        url: '/users',
        payload: { email, password },
        headers: {}
      })
      response.statusCode.should.eq(200)
      response.payload = JSON.parse(response.payload)
      response.payload.id.should.be.a('number')
      response.payload.email.should.eq(email)

      createdUser = response.payload
    })

    it('rejects with a duplicate email', async () => {
      let response = await server.inject({
        method: 'POST',
        url: '/users',
        payload: { email, password },
        headers: {}
      })
      response.statusCode.should.eq(409)
    })
  })

  describe('Updating a login account', () => {
    let altEmail = `${uuid()}@time.com`;
    let safeEmail = `${uuid()}@time.com`;
    let newPassword = 'new_password'
    let token;
    let secondCreatedUser;

    before(async () => {
      should.exist(createdUser, 'Tests dependent on successful user creation')

      // Get authentication headers for the original user
      let postData = querystring.stringify({
        grant_type: 'password',
        username: email,
        password: password
      })
      let tokenResponse = await server.inject({
        method: 'POST',
        url: '/oauth/token',
        payload: postData,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': postData.length
        }
      })
      tokenResponse.payload = JSON.parse(tokenResponse.payload)
      token = tokenResponse.payload.token

      // Create a second user
      let userResponse = await server.inject({
        method: 'POST',
        url: '/users',
        payload: { email: altEmail, password },
        headers: {}
      })
      secondCreatedUser = JSON.parse(userResponse.payload)
    })

    it('is rejected without an authentication header', async () => {
      let response = await server.inject({
        method: 'PUT',
        url: `/users/${createdUser.id}`,
        payload: { password },
        headers: {}
      })
      response.statusCode.should.eq(401)
      response.payload = JSON.parse(response.payload)
      response.payload.message.should.eq('No valid Authorization header found')
    })

    it('rejects accessing an account beloging to another user', async () => {
      let response = await server.inject({
        method: 'PUT',
        url: `/users/${secondCreatedUser.id}`,
        payload: { email },
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      response.statusCode.should.eq(401)
      response.payload = JSON.parse(response.payload)
      response.payload.message.should.eq('Unauthorized')
    })

    it('allows updating of email', async () => {
      let response = await server.inject({
        method: 'PUT',
        url: `/users/${createdUser.id}`,
        payload: { email: safeEmail },
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      response.statusCode.should.eq(200)
      response.payload = JSON.parse(response.payload)
      response.payload.email.should.eq(safeEmail)
    })

    it('rejects emails in use', async () => {
      let response = await server.inject({
        method: 'PUT',
        url: `/users/${createdUser.id}`,
        payload: { email: altEmail },
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      response.statusCode.should.eq(409)
    })

    it('rejects updating password without the correct old password', async () => {
      let response = await server.inject({
        method: 'PUT',
        url: `/users/${createdUser.id}`,
        payload: {
          old_password: 'not_correct',
          new_password: newPassword
        },
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      response.statusCode.should.eq(400)
      response.payload = JSON.parse(response.payload)
      response.payload.message.should.eq('Bad Request')
    })

    it('rejects updating password with an invalid new password', async () => {
      let response = await server.inject({
        method: 'PUT',
        url: `/users/${createdUser.id}`,
        payload: {
          old_password: password,
          new_password: 'a',
        },
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      response.statusCode.should.eq(400)
      response.payload = JSON.parse(response.payload)
      response.payload.message.should.eq('Bad Request')
    })

    it('allows updating of password with the old password and a valid new one', async () => {
      let response = await server.inject({
        method: 'PUT',
        url: `/users/${createdUser.id}`,
        payload: {
          old_password: password,
          new_password: newPassword
        },
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      response.statusCode.should.eq(200)
      response.payload = JSON.parse(response.payload)
      response.payload.email.should.eq(safeEmail)
    })
  })
})
