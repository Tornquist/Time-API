const UUIDv4 = require('uuid/v4')
const querystring = require('querystring')

let storedTime = null;

exports.link = (providedTime) => {
  storedTime = providedTime
}

exports.create = async (email = null, Time) => {
  let newUser = new (storedTime || Time).User()

  let uuid = UUIDv4()
  email = email || `${uuid.substring(0,8)}@${uuid.substring(24,36)}.com`
  let password = "defaultPassword"

  newUser.email = email
  await newUser.setPassword(password)

  await newUser.save()

  return {
    email: email,
    password: password,
    user: newUser
  }
}

exports.login = async (user, server) => {
  let postData = querystring.stringify({
    grant_type: 'password',
    username: user.email,
    password: user.password
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
  return token
}

exports.cleanup = async (user = {}, Time) => {
  let id = user.id || user.user.id
  // Remove linked accounts
  await (storedTime || Time)._db('account_user').where('user_id', id).del()
  // Remove user
  await (storedTime || Time)._db('user').where('id', id).del()
}
