const joi = require('joi')
const boom = require('boom')
const sdk = require('time-core')()

exports.path = '/account/{id}'

exports.get = {
  description: `Fetch Account`,
  validate: {
    params: {
      id: joi.number().integer()
    }
  },
  plugins: {
    'hapi-swagger': {
      responses: {
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
    }
  },
  handler: (request, h) =>
    sdk.Account.fetch(request.params.id)
      .then(account => account.props)
      .catch(err => err === sdk.Error.Data.NOT_FOUND
        ? boom.notFound()
        : boom.badImplementation()
      )
}
