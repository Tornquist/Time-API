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
      it('allows creating entries', async () => {
        let response = await postEntries(token, {
          category_id: work.id,
          type: 'event'
        })

        response.statusCode.should.eq(200)
        response.payload.id.should.be.a('number')
        response.payload.type.should.eq('event')
        response.payload.category_id.should.eq(work.id)

        response.payload.started_at.should.match(TIMESTAMP_REGEX)

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
          action: 'start'
        })
        response.statusCode.should.eq(200)
        response.payload.id.should.be.a('number')
        response.payload.type.should.eq('range')
        response.payload.category_id.should.eq(email.id)

        response.payload.started_at.should.match(TIMESTAMP_REGEX)
        should.not.exist(response.payload.ended_at)
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
          action: 'start'
        })

        response.statusCode.should.eq(200)
        response.payload.id.should.be.a('number')
        response.payload.type.should.eq('range')
        response.payload.category_id.should.eq(program.id)

        response.payload.started_at.should.match(TIMESTAMP_REGEX)
        should.not.exist(response.payload.ended_at)
      })

      it('allows stopping a range when one is active for a category', async () => {
        let response = await postEntries(token, {
          category_id: program.id,
          type: 'range',
          action: 'stop'
        })
        response.statusCode.should.eq(200)
        response.payload.id.should.be.a('number')
        response.payload.type.should.eq('range')
        response.payload.category_id.should.eq(program.id)

        response.payload.started_at.should.match(TIMESTAMP_REGEX)
        response.payload.ended_at.should.match(TIMESTAMP_REGEX)
      })

      it('allows stopping another active range', async () => {
        let response = await postEntries(token, {
          category_id: email.id,
          type: 'range',
          action: 'stop'
        })
        response.statusCode.should.eq(200)
        response.payload.id.should.be.a('number')
        response.payload.type.should.eq('range')
        response.payload.category_id.should.eq(email.id)

        response.payload.started_at.should.match(TIMESTAMP_REGEX)
        response.payload.ended_at.should.match(TIMESTAMP_REGEX)
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
        let response = await updateEntry({
          type: 'range',
          ended_at: newEnd
        })

        response.statusCode.should.eq(200)
        response.payload.type.should.eq('range')
        response.payload.started_at.should.match(TIMESTAMP_REGEX)
        response.payload.ended_at.should.eq(newEnd)
      })

      it('clears ended at when changing type back to event', async () => {
        let response = await updateEntry({
          type: 'event',
        })

        response.statusCode.should.eq(200)
        response.payload.type.should.eq('event')
        response.payload.started_at.should.match(TIMESTAMP_REGEX)
        should.not.exist(response.payload.ended_at)
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