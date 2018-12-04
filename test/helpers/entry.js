const UUIDv4 = require('uuid/v4')
const querystring = require('querystring')

let storedTime = null;

const create = async (type, category, startAt = null, closed = true, Time) => {
  let newEntry = new (storedTime || Time).Entry()

  newEntry.type = type
  newEntry.category = category

  if (startAt === null) {
    newEntry.start()
  } else {
    newEntry.startedAt = startAt
  }

  if (closed) newEntry.stop()

  await newEntry.save()

  return newEntry
}

exports.link = (providedTime) => {
  storedTime = providedTime
}

exports.createEvent = async (category, startAt = null, Time) => {
  return await create('event', category, startAt, false, Time)
}

exports.createRange = async (category, startAt = null, closed = true, Time) => {
  return await create('range', category, startAt, closed, Time)
}

exports.create = async (type, category, startAt, closed = true, Time) => {
  return await create(type, category, startAt, closed, Time)
}
