const joi = require('joi')
const boom = require('boom')
const Time = require('time-core')()

const ENDPOINT_DESCRIPTION = 'Oauth 2.0 Token Grant'
const ENDPOINT_NOTES = `
Time tokens are issued following Oauth 2.0 Resource Owner Password Credential
grants, and are issued directly to Time client applications.

Supported grant types, and required keys:

| Grant Type    | username | password | refresh_token |
|:--------------|:--------:|:--------:|:-------------:|
| password      |    X     |    X     |               |
| refresh_token |          |          |       X       |

| Token      | Time to Live |
|:-----------|:-------------|
| Activation | 4 hours      |
| Refresh    | 2 weeks      |
`

const ENDPOINT_RESPONSES = {
  '200': {
    'description': 'Success',
    'schema': joi.object({
      user_id: joi.number().integer().required(),
      creation: joi.date().timestamp().required(),
      expiration: joi.date().timestamp().required(),
      token: joi.string().required(),
      refresh: joi.string().required()
    })
  },
  '400': {
    'description': 'Invalid Type (internal), Token Not Found, Unique Token Not Found'
  },
  '401': {
    'description': 'Token Expired, Token Invalid, Invalid Password'
  },
  '500': {
    'description': 'Server Error'
  }
}

const REFRESH_TOKEN_GRANT = 'refresh_token'
const PASSWORD_GRANT = 'password'
const GRANT_TYPES = [REFRESH_TOKEN_GRANT, PASSWORD_GRANT]
const MIME_TYPES = ['application/x-www-form-urlencoded']

const GRANT_TYPE = joi.string().valid(GRANT_TYPES).required()
const USERNAME = joi.string().email().when(
  'grant_type',
  { is: PASSWORD_GRANT, then: joi.required() })
const PASSWORD = joi.string().when(
  'grant_type',
  { is: PASSWORD_GRANT, then: joi.required() })
const REFRESH_TOKEN = joi.string().when(
  'grant_type',
  { is: REFRESH_TOKEN_GRANT, then: joi.required() })

const oauthParams = joi.object().keys({
  grant_type: GRANT_TYPE,
  username: USERNAME,
  password: PASSWORD,
  refresh_token: REFRESH_TOKEN
})
.without('username', 'refresh_token')
.without(PASSWORD_GRANT, 'refresh_token')

const refreshToken = (token) =>
  Time.Token.verify(token, Time.Type.Token.REFRESH)
  .then(token => Time.Token.createForUser(token.props.user_id))

const verifyCredentials = (email, password) =>
  Time.User.findWithEmail(email)
  .then(user =>
    user.verify(password)
    .then(() => Time.Token.createForUser(user.id))
  )

const authHandler = (request, h) => {
  if (!(MIME_TYPES).includes(request.mime))
    return boom.badRequest(`Unsupported mime type. [${MIME_TYPES}] Supported`)

  // No need to validate grant types.
  // Joi does that for the request payload

  return (request.payload.grant_type === PASSWORD_GRANT
    ? verifyCredentials(request.payload.username, request.payload.password)
    : refreshToken(request.payload.refresh_token)
  )
  .catch(err => {
    switch(err) {
      case Time.Error.Authentication.TOKEN_EXPIRED:
        // Should only throw TOKEN_EXPIRED from refresh request
        if (request.payload.grant_type === REFRESH_TOKEN_GRANT) {
          return boom.unauthorized("Refresh expired")
        } else {
          return boom.unauthorized()
        }
      case Time.Error.Authentication.TOKEN_INVALID:
      case Time.Error.Authentication.INVALID_PASSWORD:
        return boom.unauthorized()
      case Time.Error.Request.INVALID_TYPE:
      case Time.Error.Authentication.UNIQUE_TOKEN_NOT_FOUND:
      case Time.Error.Data.NOT_FOUND:
        return boom.badRequest()
      default:
        return boom.badImplementation()
    }
  })
}

let oauthScheme = (server, options) => ({
  authenticate: async (request, h) => {
    let authHeader = ((request.headers.authorization || '').match(/^bearer (.*)/i) || [false]).pop();

    if (!authHeader) {
      return boom.unauthorized('No valid Authorization header found', 'OAuth2')
    }

    let token;
    try {
      token = await Time.Token.verify(authHeader)
      return h.authenticated({ credentials: { user_id: token.props.user_id }})
    }
    catch (err) {
      switch (err) {
        case Time.Error.Authentication.TOKEN_EXPIRED:
          return boom.unauthorized("Token expired")
        case Time.Error.Authentication.UNIQUE_TOKEN_NOT_FOUND:
        case Time.Error.Authentication.TOKEN_INVALID:
          break
        default:
          console.log('Unknown error in authentication', err)
          break
      }
      return boom.unauthorized()
    }
  }
})

module.exports = {
  connect: async (server) => {
    server.auth.scheme('oauth2', oauthScheme)
    server.auth.strategy('oauth2', 'oauth2')
    server.auth.default('oauth2')

    server.route({
      method: "POST",
      path: "/oauth/token",
      config: {
        auth: false,
        description: ENDPOINT_DESCRIPTION,
        notes: ENDPOINT_NOTES,
        plugins: {
          'hapi-swagger': {
            responses: ENDPOINT_RESPONSES
          }
        },
        tags: ['api'],
        validate: { payload: oauthParams },
        handler: authHandler
      }
    })
  }
}
