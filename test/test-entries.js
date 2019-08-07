require('dotenv').config()
const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')
chai.use(chaiAsPromised)
const should = chai.should()
const uuid = require('uuid/v4')
const querystring = require('querystring')
const moment = require('moment')

// Initialize Time Core to seed DB as-needed
const config = require('./setup/config')
const Time = require('time-core')(config)

const AccountHelper = require('./helpers/account')
const CategoryHelper = require('./helpers/category')
const UserHelper = require('./helpers/user')
const EntryHelper = require('./helpers/entry')

const TIMESTAMP_REGEX = /(\d{4})-(\d{2})-(\d{2})T(\d{2})\:(\d{2})\:(\d{2})\.(\d{3})Z/

describe('Entries', function() {
  let server;

  let user, token, account;
  let work, email, program, codeReview, archive;

  let secondAccount, lotsOfStuff;

  let userAlt, tokenAlt, accountAlt, rootAlt;

  before(async function() {
    this.timeout(5000)

    server = await require(process.env.PWD+'/server')

    AccountHelper.link(Time)
    CategoryHelper.link(Time)
    UserHelper.link(Time)
    EntryHelper.link(Time)

    user = await UserHelper.create()
    token = await UserHelper.login(user, server)

    account = await AccountHelper.create(user.user.id)

    work = await CategoryHelper.create("Work", account)
    email = await CategoryHelper.create("Email", account, work)
    program = await CategoryHelper.create("Program", account, work)
    codeReview = await CategoryHelper.create("Code Review", account, work)
    archive = await CategoryHelper.create("Archive", account, work)

    secondAccount = await AccountHelper.create(user.user.id)
    lotsOfStuff = await CategoryHelper.create("Lots of Stuff", secondAccount)

    userAlt = await UserHelper.create()
    tokenAlt = await UserHelper.login(userAlt, server)
    accountAlt = await AccountHelper.create(userAlt.user.id)
    rootAlt = await AccountHelper.getRootCategory(accountAlt)
  })

  let getEntries = async (token, query = {}) => {
    let baseURL = '/entries'
    let extensions = []

    if (query.account_id) {
      if (Array.isArray(query.account_id)) {
        Object.values(query.account_id).forEach(id => {
          extensions.push(`account_id=${id}`)
        })
      } else {
        extensions.push(`account_id=${query.account_id}`)
      }
    }

    if (query.category_id) {
      if (Array.isArray(query.category_id)) {
        Object.values(query.category_id).forEach(id => {
          extensions.push(`category_id=${id}`)
        })
      } else {
        extensions.push(`category_id=${query.category_id}`)
      }
    }

    if (query.type) {
      extensions.push(`type=${query.type}`)
    }

    if (query.after) {
      extensions.push(`after=${querystring.escape(query.after)}`)
    }

    if (query.before) {
      extensions.push(`before=${querystring.escape(query.before)}`)
    }

    if (extensions.length > 0) {
      let queryString = extensions.join("&")
      baseURL = baseURL + '?' + queryString
    }

    let response = await server.inject({
      method: 'GET',
      url: baseURL,
      headers: { 'Authorization': `Bearer ${token}` }
    })
    response.payload = JSON.parse(response.payload)
    return response
  }

  let postEntries = async (token, payload) => {
    let response = await server.inject({
      method: 'POST',
      url: '/entries',
      headers: { 'Authorization': `Bearer ${token}` },
      payload: payload
    })
    response.payload = JSON.parse(response.payload)
    return response
  }

  describe('Fetching entries', () => {
    const timezone = 'America/Chicago'
    before(async () => {
      await EntryHelper.createEvent(work, { startAt: '2018-01-01 01:01:01', timezone })
      await EntryHelper.createEvent(work, { startAt: '2018-01-02 01:01:01', timezone })
      await EntryHelper.createEvent(work, { startAt: '2018-01-03 01:01:01', timezone })
      await EntryHelper.createEvent(email, { startAt: '2018-01-04 01:01:01', timezone })
      await EntryHelper.createRange(email, { startAt: '2018-01-05 01:01:01', timezone })
      await EntryHelper.createRange(codeReview, { startAt: '2018-01-06 01:01:01', timezone })
      await EntryHelper.createRange(codeReview, { startAt: '2018-01-07 01:01:01', timezone })

      await EntryHelper.createEvent(lotsOfStuff, { timezone })
      await EntryHelper.createRange(lotsOfStuff, { timezone })
      await EntryHelper.createRange(lotsOfStuff, { timezone })

      await EntryHelper.createEvent(rootAlt, { timezone })
      await EntryHelper.createRange(rootAlt, { timezone })
    })

    it('returns entries in owned accounts by default with the correct format', async () => {
      let response = await getEntries(token)
      response.payload.length.should.eq(10)

      response.payload.forEach(entry => {
        entry.id.should.be.a('number')
        entry.type.should.be.a('string')
        entry.category_id.should.be.a('number')
        entry.started_at.should.match(TIMESTAMP_REGEX)
        entry.started_at_timezone.should.eq(timezone)

        if (entry.type === 'event') {
          should.not.exist(entry.ended_at)
          should.not.exist(entry.ended_at_timezone)
        } else {
          entry.ended_at.should.match(TIMESTAMP_REGEX)
          entry.ended_at_timezone.should.eq(timezone)
        }
      })
    })

    it('allows filtering to a specific account', async () => {
      let response = await getEntries(token, {
        account_id: account.id
      })
      response.payload.length.should.eq(7)
    })

    it('allows filtering to a specific category', async () => {
      let response = await getEntries(token, {
        category_id: work.id
      })
      response.payload.length.should.eq(3)
    })

    it('allows filtering to specific categories', async () => {
      let response = await getEntries(token, {
        category_id: [work.id, email.id]
      })
      response.payload.length.should.eq(5)
    })

    it('allows filtering to specific categories in multiple accounts', async () => {
      let response = await getEntries(token, {
        category_id: [work.id, email.id, lotsOfStuff.id]
      })
      response.payload.length.should.eq(8)
    })

    it('allows filtering to specific categories and accounts', async () => {
      let response = await getEntries(token, {
        account_id: secondAccount.id,
        category_id: [work.id, email.id, lotsOfStuff.id]
      })

      // work and email will not match. Only secondAccount and lotsOfStuff pass
      response.payload.length.should.eq(3)
    })

    it('allows filtering by type', async () => {
      let response = await getEntries(token, {
        type: 'event'
      })

      response.payload.length.should.eq(5)
    })

    it('allows filtering by type and account', async () => {
      let response = await getEntries(token, {
        account_id: account.id,
        type: 'range'
      })

      response.payload.length.should.eq(3)
    })

    it('returns nothing when searching for unowned data', async () => {
      let response = await getEntries(token, {
        account_id: accountAlt.id
      })

      response.payload.length.should.eq(0)
    })

    it('allows filtering by greater than', async () => {
      let response = await getEntries(token, {
        account_id: account.id,
        after: '2018-01-03 12:01:01'
      })

      response.payload.length.should.eq(4)
    })

    it('allows filtering by less than', async () => {
      let response = await getEntries(token, {
        account_id: account.id,
        before: '2018-01-03 12:01:01'
      })

      response.payload.length.should.eq(3)
    })

    it('allows filtering by greater than and less than', async () => {
      let response = await getEntries(token, {
        account_id: account.id,
        after: '2018-01-03 12:01:01',
        before: '2018-01-05 12:01:01'
      })

      response.payload.length.should.eq(2)
    })
  })

  describe('Creating', () => {
    it('denies requests to unauthorized categories', async () => {
      let response = await postEntries(token, {
        category_id: rootAlt.id,
        type: 'event'
      })
      response.statusCode.should.eq(401)
    })

    it('denies requests to categories that do not exist', async () => {
      let response = await postEntries(token, {
        category_id: 100000,
        type: 'event'
      })
      response.statusCode.should.eq(400)
    })

    describe('Events', () => {
      it('allows creating entries without timezone information', async () => {
        let response = await postEntries(token, {
          category_id: work.id,
          type: 'event'
        })

        response.statusCode.should.eq(200)
        response.payload.id.should.be.a('number')
        response.payload.type.should.eq('event')
        response.payload.category_id.should.eq(work.id)

        response.payload.started_at.should.match(TIMESTAMP_REGEX)
        should.not.exist(response.payload.started_at_timezone)

        let timeDelta = moment().diff(moment(response.payload.started_at))
        // Within 100ms. Allow for drift between services
        timeDelta.should.be.lessThan(100)
      })

      it('allows creating entries with timezone information', async () => {
        let response = await postEntries(token, {
          category_id: work.id,
          type: 'event',
          timezone: 'America/Indiana/Indianapolis'
        })

        response.statusCode.should.eq(200)
        response.payload.id.should.be.a('number')
        response.payload.type.should.eq('event')
        response.payload.category_id.should.eq(work.id)

        response.payload.started_at.should.match(TIMESTAMP_REGEX)
        response.payload.started_at_timezone.should.eq('America/Indiana/Indianapolis')

        let timeDelta = moment().diff(moment(response.payload.started_at))
        // Within 100ms. Allow for drift between services
        timeDelta.should.be.lessThan(100)
      })

      it('denies creating events with a start action', async () => {
        let response = await postEntries(token, {
          category_id: work.id,
          type: 'event',
          action: 'start'
        })
        response.statusCode.should.eq(400)
      })

      it('denies creating events with a stop action', async () => {
        let response = await postEntries(token, {
          category_id: work.id,
          type: 'event',
          action: 'stop'
        })
        response.statusCode.should.eq(400)
      })
    })

    describe('Ranges', () => {
      it('denies stopping a range when none are active for a category', async () => {
        let response = await postEntries(token, {
          category_id: email.id,
          type: 'range',
          action: 'stop'
        })
        response.statusCode.should.eq(400)
      })

      it('allows starting a range for a category', async () => {
        let response = await postEntries(token, {
          category_id: email.id,
          type: 'range',
          action: 'start',
          timezone: 'America/New_York'
        })
        response.statusCode.should.eq(200)
        response.payload.id.should.be.a('number')
        response.payload.type.should.eq('range')
        response.payload.category_id.should.eq(email.id)

        response.payload.started_at.should.match(TIMESTAMP_REGEX)
        response.payload.started_at_timezone.should.eq('America/New_York')
        should.not.exist(response.payload.ended_at)
        should.not.exist(response.payload.ended_at_timezone)
      })

      it('denies starting a range when one is active for the category', async () => {
        let response = await postEntries(token, {
          category_id: email.id,
          type: 'range',
          action: 'start'
        })
        response.statusCode.should.eq(400)
      })

      it('allows starting a second range for a different category', async () => {
        let response = await postEntries(token, {
          category_id: program.id,
          type: 'range',
          action: 'start',
          /*timezone*/
        })

        response.statusCode.should.eq(200)
        response.payload.id.should.be.a('number')
        response.payload.type.should.eq('range')
        response.payload.category_id.should.eq(program.id)

        response.payload.started_at.should.match(TIMESTAMP_REGEX)
        should.not.exist(response.payload.started_at_timezone)
        should.not.exist(response.payload.ended_at)
        should.not.exist(response.payload.ended_at_timezone)
      })

      it('allows stopping a range when one is active for a category', async () => {
        let response = await postEntries(token, {
          category_id: program.id,
          type: 'range',
          action: 'stop',
          timezone: 'America/Los_Angeles'
        })
        response.statusCode.should.eq(200)
        response.payload.id.should.be.a('number')
        response.payload.type.should.eq('range')
        response.payload.category_id.should.eq(program.id)

        response.payload.started_at.should.match(TIMESTAMP_REGEX)
        should.not.exist(response.payload.started_at_timezone) // Not set first time
        response.payload.ended_at.should.match(TIMESTAMP_REGEX)
        response.payload.ended_at_timezone.should.eq('America/Los_Angeles')
      })

      it('allows stopping another active range', async () => {
        let response = await postEntries(token, {
          category_id: email.id,
          type: 'range',
          action: 'stop',
          timezone: 'America/Chicago'
        })
        response.statusCode.should.eq(200)
        response.payload.id.should.be.a('number')
        response.payload.type.should.eq('range')
        response.payload.category_id.should.eq(email.id)

        response.payload.started_at.should.match(TIMESTAMP_REGEX)
        response.payload.started_at_timezone.should.eq('America/New_York')
        response.payload.ended_at.should.match(TIMESTAMP_REGEX)
        response.payload.ended_at_timezone.should.eq('America/Chicago')
      })
    })
  })

  describe('Managing individual entries', () => {
    let entryID, entryAltID;
    before(async () => {
      let response = await postEntries(token, {
        category_id: email.id,
        type: 'range',
        action: 'start'
      })
      entryID = response.payload.id
      await postEntries(token, {
        category_id: email.id,
        type: 'range',
        action: 'stop'
      })

      let response2 = await postEntries(tokenAlt, {
        category_id: rootAlt.id,
        type: 'event'
      })
      entryAltID = response2.payload.id
    })

    describe('Fetching', () => {
      it('allows owned entries to be fetched', async () => {
        let response = await server.inject({
          method: 'GET',
          url: `/entries/${entryID}`,
          headers: { 'Authorization': `Bearer ${token}` }
        })
        response.statusCode.should.eq(200)
        let payload = JSON.parse(response.payload)
        payload.id.should.eq(entryID)
        payload.type.should.eq('range')
        payload.category_id.should.eq(email.id)

        payload.started_at.should.match(TIMESTAMP_REGEX)
        payload.ended_at.should.match(TIMESTAMP_REGEX)
      })

      it('denies access to entries for other accounts', async () => {
        let response = await server.inject({
          method: 'GET',
          url: `/entries/${entryAltID}`,
          headers: { 'Authorization': `Bearer ${token}` }
        })
        response.statusCode.should.eq(401)
      })

      it('rejects entries that do not exist', async () => {
        let response = await server.inject({
          method: 'GET',
          url: `/entries/${100000}`,
          headers: { 'Authorization': `Bearer ${token}` }
        })
        response.statusCode.should.eq(400)
      })
    })

    describe('Updating', () => {
      let entryID;
      before(async () => {
        let response = await postEntries(token, {
          category_id: email.id,
          type: 'event'
        })
        entryID = response.payload.id
      })

      let updateEntry = async (payload = {}) => {
        let response = await server.inject({
          method: 'PUT',
          url: `/entries/${entryID}`,
          headers: { 'Authorization': `Bearer ${token}` },
          payload: payload
        })
        response.payload = JSON.parse(response.payload)
        return response
      }

      it('rejects changing nothing', async () => {
        let response = await updateEntry()
        response.statusCode.should.eq(400)
      })

      it('allows moving an entry to a new category', async () => {
        let response = await updateEntry({
          category_id: program.id
        })

        response.statusCode.should.eq(200)

        response.payload.id.should.eq(entryID)
        response.payload.type.should.eq('event')
        response.payload.category_id.should.eq(program.id)

        response.payload.started_at.should.match(TIMESTAMP_REGEX)
        should.not.exist(response.payload.ended_at)
      })

      it('allows changing timezone', async () => {
        let response = await updateEntry({
          started_at_timezone: 'America/Chicago'
        })

        response.statusCode.should.eq(200)

        response.payload.id.should.eq(entryID)
        response.payload.type.should.eq('event')
        response.payload.category_id.should.eq(program.id)

        response.payload.started_at.should.match(TIMESTAMP_REGEX)
        response.payload.started_at_timezone.should.eq('America/Chicago')
        should.not.exist(response.payload.ended_at)
        should.not.exist(response.payload.ended_at_timezone)
      })

      it('rejects changing ended timezone for events', async () => {
        let response = await updateEntry({
          ended_at_timezone: 'America/Chicago'
        })
        response.statusCode.should.eq(400)
      })

      it('allows moving to a category in a different owned account', async () => {
        let response = await updateEntry({
          category_id: lotsOfStuff.id
        })

        response.statusCode.should.eq(200)

        response.payload.id.should.eq(entryID)
        response.payload.type.should.eq('event')
        response.payload.category_id.should.eq(lotsOfStuff.id)

        response.payload.started_at.should.match(TIMESTAMP_REGEX)
        should.not.exist(response.payload.ended_at)
      })

      it('rejects moving to a category in an unowned account', async () => {
        let response = await updateEntry({
          category_id: rootAlt.id
        })
        response.statusCode.should.eq(401)
      })

      it('rejects moving to an invalid category', async () => {
        let response = await updateEntry({
          category_id: 1000000
        })
        response.statusCode.should.eq(400)
      })

      it('allows changing type', async () => {
        let response = await updateEntry({
          type: 'range'
        })

        response.statusCode.should.eq(200)

        response.payload.id.should.eq(entryID)
        response.payload.type.should.eq('range')
        response.payload.category_id.should.eq(lotsOfStuff.id)

        response.payload.started_at.should.match(TIMESTAMP_REGEX)
        should.not.exist(response.payload.ended_at)
      })

      it('allows events changed to ranges to be stopped using actions', async () => {
        let a = await postEntries(token, {
          category_id: lotsOfStuff.id,
          type: 'range',
          action: 'stop'
        })

        let response = await server.inject({
          method: 'GET',
          url: `/entries/${entryID}`,
          headers: { 'Authorization': `Bearer ${token}` }
        })
        let payload = JSON.parse(response.payload)
        payload.started_at.should.match(TIMESTAMP_REGEX)
        payload.ended_at.should.match(TIMESTAMP_REGEX)
      })

      it('allows changing start time', async () => {
        let newStart = '2018-01-02T12:13:14.123Z'
        let response = await updateEntry({
          started_at: newStart
        })

        response.statusCode.should.eq(200)
        response.payload.started_at.should.eq(newStart)
        response.payload.ended_at.should.match(TIMESTAMP_REGEX)
      })

      it('allows changing end time', async () => {
        let newEnd = '2018-02-03T13:14:15.234Z'
        let response = await updateEntry({
          ended_at: newEnd
        })

        response.statusCode.should.eq(200)
        response.payload.started_at.should.match(TIMESTAMP_REGEX)
        response.payload.ended_at.should.eq(newEnd)
      })

      it('allows changing end timezone', async () => {
        let newEndTimezone = 'America/New_York'
        let response = await updateEntry({
          ended_at_timezone: newEndTimezone
        })

        response.statusCode.should.eq(200)
        response.payload.ended_at_timezone.should.eq(newEndTimezone)
      })

      it('rejects changing ended at when the type is event', async () => {
        let response = await updateEntry({
          type: 'event',
          ended_at: '2018-03-04T12:12:12.021Z'
        })
        response.statusCode.should.eq(400)
      })

      it('rejects changing ended at when type was event already', async () => {
        let firstAction = await updateEntry({
          type: 'event'
        })
        firstAction.statusCode.should.eq(200)

        let response = await updateEntry({
          ended_at: '2018-03-04T12:12:12.021Z'
        })
        response.statusCode.should.eq(400)
      })

      it('allows changing type and ended at togther when type is range', async () => {
        let newEnd = '2018-02-03T03:03:04.234Z'
        let newEndTimezone = 'America/Indiana/Indianapolis'
        let response = await updateEntry({
          type: 'range',
          ended_at: newEnd,
          ended_at_timezone: newEndTimezone
        })

        response.statusCode.should.eq(200)
        response.payload.type.should.eq('range')
        response.payload.started_at.should.match(TIMESTAMP_REGEX)
        response.payload.started_at_timezone.should.eq('America/Chicago')
        response.payload.ended_at.should.eq(newEnd)
        response.payload.ended_at_timezone.should.eq(newEndTimezone)
      })

      it('clears ended at data when changing type back to event', async () => {
        let response = await updateEntry({
          type: 'event',
        })

        response.statusCode.should.eq(200)
        response.payload.type.should.eq('event')
        response.payload.started_at.should.match(TIMESTAMP_REGEX)
        should.not.exist(response.payload.ended_at)
        should.not.exist(response.payload.ended_at_timezone)
      })
    })

    describe('Deleting', () => {
      it('allows owned entries to be deleted', async () => {
        let response = await server.inject({
          method: 'DELETE',
          url: `/entries/${entryID}`,
          headers: { 'Authorization': `Bearer ${token}` }
        })
        response.statusCode.should.eq(200)
      })

      it('rejects deleting entries for other accounts', async () => {
        let response = await server.inject({
          method: 'DELETE',
          url: `/entries/${entryAltID}`,
          headers: { 'Authorization': `Bearer ${token}` }
        })
        response.statusCode.should.eq(401)
      })
    })
  })

  after(async () => {
    await AccountHelper.cleanup(account)
    await AccountHelper.cleanup(secondAccount)
    await UserHelper.cleanup(user)

    await AccountHelper.cleanup(accountAlt)
    await UserHelper.cleanup(userAlt)
  })
})
