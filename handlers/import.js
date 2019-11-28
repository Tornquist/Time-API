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

const performRequestedActions = async (userID, requestID, tree) => {
  try {
    let account = new Time.Account()
    account.register(userID) // TODO: Allow delayed registration on success only
    await account.save()

    console.log("Created account", account.id)
    
    let sequentiallyCreateCategories = async (parent, tree) => {
      if (tree.name.length === 0) {
        console.log("Empty root, attaching children to root")
        for (let i = 0; i < tree.children.length; i++) {
          let child = tree.children[i]
          await sequentiallyCreateCategories(undefined, child)
        }
        return
      }
      
      let category = new Time.Category({
        name: tree.name,
        accountID: account.id,
        parentID: parent
      })
      await category.save()
      console.log("Created category", tree.name, "with id", category.id)
      tree.category_id = category.id

      for (let i = 0; i < tree.children.length; i++) {
        let child = tree.children[i]
        await sequentiallyCreateCategories(category.id, child)
      }
    }
    await sequentiallyCreateCategories(undefined, tree)

    let allEvents = []
    let unwrapEvents = (tree) => {
      if (tree.category_id !== undefined) {
        let expand = (e) => Object.assign({}, e, { category_id: tree.category_id })
        allEvents.push(...(tree.events.map(expand)))
        allEvents.push(...(tree.ranges.map(expand)))
      }
      tree.children.forEach(unwrapEvents)
    }
    unwrapEvents(tree)
    
    for (let i = 0; i < allEvents.length; i++) {
      if (i % 10 === 0) {
        console.log(`${i}/${allEvents.length}`)
      }

      let data = allEvents[i]
      let isEvent = data.ended_at === undefined

      let entry = new Time.Entry()
      entry.category = data.category_id
      entry.type = isEvent ? Time.Type.Entry.EVENT : Time.Type.Entry.RANGE
      entry.startedAt = data.started_at
      entry.startedAtTimezone = data.started_at_timezone
      if (!isEvent) {
        entry.endedAt = data.ended_at
        entry.endedAtTimezone = data.ended_at_timezone
      }
      await entry.save()
    }

  } catch (err) {
    // Mark request as failed
    console.log("Failure in importing data", err)
  }
}

const POST_HANDLER = async (request, h) => {
  let tree = request.payload

  let validNaming = validateNames(tree)
  if (!validNaming) {
    throw boom.badRequest('Only the root name can be empty')
  }

  let createRootCategory = tree.name.length !== 0
  let responseData = countAll(tree)
  if (!createRootCategory) { responseData.categories-- }

  // Register request to track status
  let registeredRequest = { id: 15 } // TODO: Real ID
  responseData.id = registeredRequest.id

  let userID = request.auth.credentials.user_id
  performRequestedActions(userID, registeredRequest.id, tree) // Unbound

  return responseData
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