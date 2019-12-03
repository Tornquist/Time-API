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
  	it('allows a large batch of data to be submitted', async () => {
  		let response = await server.inject({
	      method: 'POST',
	      url: '/import',
	      headers: { 'Authorization': `Bearer ${token}` },
	      payload: importData
	    })
	    response.payload = JSON.parse(response.payload)

      let res = response.payload

      res.id.should.be.a('number')
      res.created_at.should.be.a('string')
      
      res.categories.should.be.an('object')
      res.categories.imported.should.be.a('number')
      res.categories.expected.should.eq(9)

      res.entries.should.be.an('object')
      res.entries.imported.should.be.a('number')
      res.entries.expected.should.eq(138)

      res.complete.should.be.a('boolean')
      res.success.should.be.a('boolean')

      console.log("Now sleeping for 2s for async importing")
      await sleep(2000)
      console.log("Done sleeping")
  	}).timeout(10000)
  })
})