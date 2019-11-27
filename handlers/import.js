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

const validateNames = (node, root = true) => {
  // Only the top level name can be an empty string
  let emptyName = node.name.length === 0
  let validName = !emptyName || emptyName && root

  let validChildren = node.children
    .map((c) => validateNames(c, false))
    .reduce((a, c) => a && c, true)

  return validName && validChildren
}

const countAll = (group) => {
  let childrenCounts = group.children
    .map(countAll)
    .reduce((acc, cur) => {
      return {
        categories: acc.categories + cur.categories,
        events: acc.events + cur.events,
        ranges: acc.ranges + cur.ranges,
      }
    }, { categories: 0, events: 0, ranges: 0 })

  return {
    categories: childrenCounts.categories + 1,
    events: childrenCounts.events + group.events.length,
    ranges: childrenCounts.ranges + group.ranges.length
  }
}

const POST_HANDLER = async (request, h) => {
  let tree = request.payload

  let validNaming = validateNames(tree)
  if (!validNaming) {
    throw boom.badRequest('Only the root name can be empty')
  }

  let createRootCategory = tree.name.length !== 0
  let completeRequest = countAll(tree)
  if (!createRootCategory) { completeRequest.categories-- }

  // Inject ID to track status
  completeRequest.id = 15 // TODO: Real ID
  return completeRequest
}

const POST_PAYLOAD = joi.object().keys({
  name: joi.string().required().allow(''),
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

exports.post = {
  description: POST_DESCRIPTION,
  plugins: { 'hapi-swagger': { responses: POST_RESPONSES } },
  handler: POST_HANDLER,
  validate: { payload: POST_PAYLOAD }
}