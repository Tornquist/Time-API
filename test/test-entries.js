require('dotenv').config()
const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')
chai.use(chaiAsPromised)
const should = chai.should()
const uuid = require('uuid/v4')
const querystring = require('querystring')

// Initialize Time Core to seed DB as-needed
const config = require('./setup/config')
const Time = require('time-core')(config)

const AccountHelper = require('./helpers/account')
const CategoryHelper = require('./helpers/category')
const UserHelper = require('./helpers/user')

describe('Entries', function() {
  let server;

  let user, token, account;
  let work, email, program, codeReview, archive
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

    userAlt = await UserHelper.create()
    tokenAlt = await UserHelper.login(userAlt, server)
    accountAlt = await AccountHelper.create(userAlt.user.id)
    rootAlt = await AccountHelper.getRootCategory(accountAlt)
  })

  describe('Creating', () => {
    it('denies requests to unauthorized categories', async () => {
      let response = await server.inject({
        method: 'POST',
        url: '/entries',
        headers: { 'Authorization': `Bearer ${token}` },
        payload: {
          category_id: rootAlt.id,
          type: 'event'
        }
      })
      response.statusCode.should.eq(401)
    })

    it('denies requests to categories that do not exist', async () => {
      let response = await server.inject({
        method: 'POST',
        url: '/entries',
        headers: { 'Authorization': `Bearer ${token}` },
        payload: {
          category_id: 100000,
          type: 'event'
        }
      })
      response.statusCode.should.eq(400)
    })

    describe('Events', () => {
      it('allows creating entries', async () => {
        let response = await server.inject({
          method: 'POST',
          url: '/entries',
          headers: { 'Authorization': `Bearer ${token}` },
          payload: {
            category_id: work.id,
            type: 'event'
          }
        })

        response.statusCode.should.eq(200)
        let payload = JSON.parse(response.payload)
        payload.id.should.be.a('number')
        payload.type.should.eq('event')
        payload.category_id.should.eq(work.id)

        payload.started_at.should.be.a('number')
        let date = new Date(payload.started_at)

        let timeDelta = (new Date()).getTime() - payload.started_at
        // Within 100ms. Allow for drift between services
        timeDelta.should.be.lessThan(100)
      })

      it('denies creating events with a start action', async () => {
        let response = await server.inject({
          method: 'POST',
          url: '/entries',
          headers: { 'Authorization': `Bearer ${token}` },
          payload: {
            category_id: work.id,
            type: 'event',
            action: 'start'
          }
        })
        response.statusCode.should.eq(400)
      })

      it('denies creating events with a stop action', async () => {
        let response = await server.inject({
          method: 'POST',
          url: '/entries',
          headers: { 'Authorization': `Bearer ${token}` },
          payload: {
            category_id: work.id,
            type: 'event',
            action: 'stop'
          }
        })
        response.statusCode.should.eq(400)
      })
    })

    describe('Ranges', () => {
      it('denies stopping a range when none are active for a category', async () => {
        let response = await server.inject({
          method: 'POST',
          url: '/entries',
          headers: { 'Authorization': `Bearer ${token}` },
          payload: {
            category_id: email.id,
            type: 'range',
            action: 'stop'
          }
        })
        response.statusCode.should.eq(400)
      })

      it('allows starting a range for a category', async () => {
        let response = await server.inject({
          method: 'POST',
          url: '/entries',
          headers: { 'Authorization': `Bearer ${token}` },
          payload: {
            category_id: email.id,
            type: 'range',
            action: 'start'
          }
        })
        response.statusCode.should.eq(200)
        let payload = JSON.parse(response.payload)
        payload.id.should.be.a('number')
        payload.type.should.eq('range')
        payload.category_id.should.eq(email.id)

        payload.started_at.should.be.a('number')
        should.not.exist(payload.ended_at)
      })

      it('denies starting a range when one is active for the category', async () => {
        let response = await server.inject({
          method: 'POST',
          url: '/entries',
          headers: { 'Authorization': `Bearer ${token}` },
          payload: {
            category_id: email.id,
            type: 'range',
            action: 'start'
          }
        })
        response.statusCode.should.eq(400)
      })

      it('allows starting a second range for a different category', async () => {
        let response = await server.inject({
          method: 'POST',
          url: '/entries',
          headers: { 'Authorization': `Bearer ${token}` },
          payload: {
            category_id: program.id,
            type: 'range',
            action: 'start'
          }
        })
        response.statusCode.should.eq(200)
        let payload = JSON.parse(response.payload)
        payload.id.should.be.a('number')
        payload.type.should.eq('range')
        payload.category_id.should.eq(program.id)

        payload.started_at.should.be.a('number')
        should.not.exist(payload.ended_at)
      })

      it('allows stopping a range when one is active for a category', async () => {
        let response = await server.inject({
          method: 'POST',
          url: '/entries',
          headers: { 'Authorization': `Bearer ${token}` },
          payload: {
            category_id: program.id,
            type: 'range',
            action: 'stop'
          }
        })
        response.statusCode.should.eq(200)
        let payload = JSON.parse(response.payload)
        payload.id.should.be.a('number')
        payload.type.should.eq('range')
        payload.category_id.should.eq(program.id)

        // TODO: Update Time-Core to output consistent formats
        //       this returns number when fresh and date on retrieval
        payload.started_at.should.be.a('string')
        payload.ended_at.should.be.a('number')
      })

      it('allows stopping another active range', async () => {
        let response = await server.inject({
          method: 'POST',
          url: '/entries',
          headers: { 'Authorization': `Bearer ${token}` },
          payload: {
            category_id: email.id,
            type: 'range',
            action: 'stop'
          }
        })
        response.statusCode.should.eq(200)
        let payload = JSON.parse(response.payload)
        payload.id.should.be.a('number')
        payload.type.should.eq('range')
        payload.category_id.should.eq(email.id)

        // TODO: Update Time-Core to output consistent formats
        //       this returns number when fresh and date on retrieval
        payload.started_at.should.be.a('string')
        payload.ended_at.should.be.a('number')
      })
    })
  })

  describe('Managing individual entries', () => {
    let entryID, entryAltID;
    before(async () => {
      let response = await server.inject({
        method: 'POST',
        url: '/entries',
        headers: { 'Authorization': `Bearer ${token}` },
        payload: {
          category_id: email.id,
          type: 'range',
          action: 'start'
        }
      })
      entryID = JSON.parse(response.payload).id
      await server.inject({
        method: 'POST',
        url: '/entries',
        headers: { 'Authorization': `Bearer ${token}` },
        payload: {
          category_id: email.id,
          type: 'range',
          action: 'stop'
        }
      })

      let response2 = await server.inject({
        method: 'POST',
        url: '/entries',
        headers: { 'Authorization': `Bearer ${tokenAlt}` },
        payload: {
          category_id: rootAlt.id,
          type: 'event'
        }
      })
      entryAltID = JSON.parse(response2.payload).id
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

        // ISO date. Needs validation
        payload.started_at.should.be.a('string')
        payload.ended_at.should.be.a('string')
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
  })

  after(async () => {
    await AccountHelper.cleanup(account)
    await UserHelper.cleanup(user)

    await AccountHelper.cleanup(accountAlt)
    await UserHelper.cleanup(userAlt)
  })
})
