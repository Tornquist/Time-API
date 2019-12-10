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

// Test Data
const importData = require('./data/import.json')
const sleep = (ms) => (new Promise(resolve => setTimeout(resolve, ms)))

describe('Import', function() {
  let server;

  let user, token;

  before(async function() {
    this.timeout(5000)

    server = await require(process.env.PWD+'/server')

    AccountHelper.link(Time)
    CategoryHelper.link(Time)
    UserHelper.link(Time)
    EntryHelper.link(Time)

    user = await UserHelper.create()
    token = await UserHelper.login(user, server)
  })

  describe('Importing data', () => {
    
    let importID = null;

    it('allows a large batch of data to be submitted', async () => {
      let response = await server.inject({
        method: 'POST',
        url: '/import',
        headers: { 'Authorization': `Bearer ${token}` },
        payload: importData
      })
      response.statusCode.should.eq(200)
      response.payload = JSON.parse(response.payload)

      let res = response.payload

      res.id.should.be.a('number')
      importID = res.id      

      res.created_at.should.be.a('string')
      res.updated_at.should.be.a('string')
      
      res.categories.should.be.an('object')
      res.categories.imported.should.eq(0)
      res.categories.expected.should.eq(9)

      res.entries.should.be.an('object')
      res.entries.imported.should.eq(0)
      res.entries.expected.should.eq(138)

      res.complete.should.eq(false)
      res.success.should.be.eq(false)
    })

    it('allows checking import status periodically', async () => {
      let lastCount = null;

      let checkCount = async () => {
        let response = await server.inject({
          method: 'GET',
          url: `/import/${importID}`,
          headers: { 'Authorization': `Bearer ${token}` }
        })
        response.statusCode.should.eq(200)
        response.payload = JSON.parse(response.payload)
        let payload = response.payload

        if (lastCount === null) {
          payload.categories.imported.should.be.lessThan(payload.categories.expected)
          payload.entries.imported.should.be.lessThan(payload.entries.expected)

          lastCount = payload.categories.imported + payload.entries.imported
        } else {
          let newCount = payload.categories.imported + payload.entries.imported
          newCount.should.be.greaterThan(lastCount)

          lastCount = newCount
        }        
      }

      await checkCount()

      for (let i = 0; i < 2; i++) {
        await sleep(30)
        await checkCount()
      }
    })

    it('eventually returns success when import has completed', async () => {
      let checkStatus = async () => {
        let response = await server.inject({
          method: 'GET',
          url: `/import/${importID}`,
          headers: { 'Authorization': `Bearer ${token}` }
        })
        response.statusCode.should.eq(200)
        response.payload = JSON.parse(response.payload)
        let payload = response.payload

        if (payload.complete !== true) {
          return null
        }

        return payload    
      }

      let notDone = true
      let result = null

      while (notDone) {
        await sleep(10)
        result = await checkStatus()

        if (result !== null) {
          notDone = false
        }
      }

      result.complete.should.eq(true)
      result.success.should.eq(true)
      result.categories.imported.should.eq(result.categories.expected)
      result.entries.imported.should.eq(result.entries.expected)
    })

    it('allows all requests to be fetched for a given user', async () => {
      let response = await server.inject({
        method: 'GET',
        url: `/import`,
        headers: { 'Authorization': `Bearer ${token}` }
      })
      response.statusCode.should.eq(200)
      response.payload = JSON.parse(response.payload)

      response.payload.length.should.eq(1)
      response.payload[0].id.should.eq(importID)
    })
  })
})