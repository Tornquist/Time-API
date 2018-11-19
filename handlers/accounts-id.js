const joi = require('joi')
const boom = require('boom')
const sdk = require('time-core')()

exports.path = '/accounts/{id}'

const GET_DESCRIPTION = 'Fetch Account'
const GET_RESPONSES = {
  '200': {
    'description': 'Success',
    'schema': joi.object({
      userIDs: joi.array().items(joi.number().integer()).required()
    })
  },
  '404': {
    'description': 'Unable to find requested object'
  },
  '500': {
    'description': 'Server Error'
  }
}

const GET_HANDLER = (request, h) =>
  sdk.Account.fetch(request.params.id)
    .then(account => account.props)
    .catch(err => err === sdk.Error.Data.NOT_FOUND
      ? boom.notFound()
      : boom.badImplementation()
    )

exports.get = {
  description: GET_DESCRIPTION,
  validate: {
    params: { id: joi.number().integer() }
  },
  plugins: { 'hapi-swagger': { responses: GET_RESPONSES } },
  handler: (request, h) => GET_HANDLER
}