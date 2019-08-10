const UUIDv4 = require('uuid/v4')
const querystring = require('querystring')

let storedTime = null;

const create = async (type, category, startAt = null, timezone = null, closed = true, Time) => {
  let newEntry = new (storedTime || Time).Entry()

  newEntry.type = type
  newEntry.category = category

  if (startAt === null) {
    newEntry.start(timezone)
  } else {
    newEntry.startedAt = startAt
    newEntry.startedAtTimezone = timezone
  }

  if (closed) newEntry.stop(timezone)

  await newEntry.save()

  return newEntry
}

exports.link = (providedTime) => {
  storedTime = providedTime
}

exports.createEvent = async (category, { startAt = null, timezone = null } = {}, Time) => {
  return await create('event', category, startAt, timezone, false, Time)
}

exports.createRange = async (category, { startAt = null, timezone = null, closed = true } = {}, Time) => {
  return await create('range', category, startAt, timezone, closed, Time)
}

exports.create = async (type, category, { startAt = null, timezone = null, closed = true } = {}, Time) => {
  return await create(type, category, startAt, timezone, closed, Time)
}
