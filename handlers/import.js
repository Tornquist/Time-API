const joi = require('@hapi/joi')
const boom = require('@hapi/boom')
const Time = require('time-core')()

exports.path = '/import'

const POST_DESCRIPTION = 'Import Categories and Entries'
const POST_RESPONSES = {
  '200': {
    'description': 'Success'
  },
  '500': {
    'description': 'Server Error'
  }
}

const POST_HANDLER = async (request, h) => {
  return { received: "YES" }
}

const POST_PAYLOAD = joi.object().keys({
  groups: joi.array().items(
    joi.object().keys({
      name: joi.string().required(),
      events: joi.array().items(joi.object({
        started_at: joi.string().isoDate().required(),
        started_at_timezone: joi.string().required()
      })),
      ranges: joi.array().items(joi.object({
        started_at: joi.string().isoDate().required(),
        started_at_timezone: joi.string().required(),
        ended_at: joi.string().isoDate().required(),
        ended_at_timezone: joi.string().required()
      })),
      children: joi.array().items(joi.link('#tree'))
    }).id("tree")
  )
})


exports.post = {
  description: POST_DESCRIPTION,
  plugins: { 'hapi-swagger': { responses: POST_RESPONSES } },
  handler: POST_HANDLER,
  validate: { payload: POST_PAYLOAD }
}