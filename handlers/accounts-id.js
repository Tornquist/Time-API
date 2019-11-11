const joi = require('@hapi/joi')
const boom = require('@hapi/boom')
const Time = require('time-core')()

exports.path = '/accounts/{id}'

const GET_DESCRIPTION = 'Fetch Account'
const GET_RESPONSES = {
  '200': {
    'description': 'Success',
    'schema': joi.object({
      id: joi.number().integer(),
      user_ids: joi.array().items(joi.number().integer()).required()
    })
  },
  '404': {
    'description': 'Unable to find requested object'
  },
  '500': {
    'description': 'Server Error'
  }
}

const GET_HANDLER = async (request, h) => {
  let account;
  try {
    account = await Time.Account.fetch(request.params.id)
  } catch (err) {
    throw err === Time.Error.Data.NOT_FOUND
      ? boom.notFound()
      : boom.badImplementation()
  }

  let userID = request.auth.credentials.user_id
  let authorized = account.userIDs.includes(userID)
  if (!authorized)
    throw boom.unauthorized()

  return {
    id: account.id,
    user_ids: account.userIDs
  }
}

exports.get = {
  description: GET_DESCRIPTION,
  validate: {
    params: joi.object({ id: joi.number().integer() })
  },
  plugins: { 'hapi-swagger': { responses: GET_RESPONSES } },
  handler: GET_HANDLER
}
