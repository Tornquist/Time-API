const joi = require('joi')
const boom = require('boom')
const Time = require('time-core')()

const REFRESH_TOKEN_GRANT = 'refresh_token'
const PASSWORD_GRANT = 'password'
const GRANT_TYPES = [REFRESH_TOKEN_GRANT, PASSWORD_GRANT]
const MIME_TYPES = ['application/x-www-form-urlencoded']

const GRANT_TYPE = joi.string().valid(GRANT_TYPES).required()
const EMAIL = joi.string().email().when(
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
  email: EMAIL,
  password: PASSWORD,
  refresh_token: REFRESH_TOKEN
})
.without('username', 'refresh_token')
.without(PASSWORD_GRANT, 'refresh_token')

const refreshToken = (token) =>
  Time.Token.verify(token, Time.Type.Token.REFRESH)
  .then(token => Time.Token.createForUser(token.user_id))

const verifyCredentials = (email, password) =>
  Time.User.findWithEmail(email)
  .then(user =>
    user.verify(password)
    .then(() => Time.TOKEN_EXPIRED.createForUser(user.id))
  )

const authHandler = (request, h) => {
  if (!(MIME_TYPES).includes(request.mime))
    return boom.badRequest(`Unsupported mime type. [${MIME_TYPES}] Supported`)
  if (!(GRANT_TYPES).includes(request.payload.grant_type))
    return boom.notImplemented(`Requested grant_type not implemented.`)

  ;(request.payload.grant_type === PASSWORD_GRANT
    ? verifyCredentials(request.payload.email, request.payload.password)
    : refreshToken(request.payload.refresh_token)
  )
  .catch(err => {
    switch(err) {
      case TimeError.Authentication.TOKEN_EXPIRED:
      case TimeError.Authentication.TOKEN_INVALID:
      case TimeError.Authentication.INVALID_PASSWORD:
        return boom.unauthorized()
        break
      case TimeError.Request.INVALID_TYPE:
      case TimeError.Authentication.UNIQUE_TOKEN_NOT_FOUND:
      case TimeError.Data.NOT_FOUND:
        return boom.badRequest()
      default:
        return boom.badImplementation()
    }
  })
}

let oauthScheme = {}
oauthScheme.name = 'Time OAuth2 Server'
oauthScheme.version = '0.2.0'
oauthScheme.register = (plugin, options/*, next*/) => {
  plugin.auth.scheme('oauth2', (server, options) => ({
      authenticate: async (request, h) => {
        let authHeader = ((request.headers.authorization || '').match(/^bearer (.*)/i) || [false]).pop();

        if (!authHeader) {
          console.log(['info','oauth2'],"No valid authorization header found in request header");
          return boom.unauthorized('No valid Authorization header found', 'OAuth2')
        }

        let token;
        try {
          token = await Time.Token.verify(request.headers.authorization)
        }
        catch (err) {
          return boom.unauthorized()
        }
        h.continue({ credentials: { user_id: token.user_id }})
      }
  }))

  // next()
}

module.exports = {
  connect: async (server) => {
    await server.register([oauthScheme])

    server.auth.strategy('oauth2', 'oauth2')
    server.auth.default('oauth2')

    server.route({
      method: "POST",
      path: "/oauth/token",
      config: {
        auth: false,
        validate: { payload: oauthParams },
        handler: authHandler
      }
    })
  }
}
