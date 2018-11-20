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
const UserHelper = require('./helpers/user')

describe('Accounts', function() {
  let server;

  let userA, userB;
  let tokenA, tokenB;

  let createdAccountID;

  before(async function() {
    this.timeout(5000)

    server = await require(process.env.PWD+'/server')

    UserHelper.link(Time)
    userA = await UserHelper.create()
    tokenA = await UserHelper.login(userA, server)

    userB = await UserHelper.create()
    tokenB = await UserHelper.login(userB, server)
  })

  describe('User Accounts', () => {
    it('allows users to fetch the accounts they have access to', async () => {
      let response = await server.inject({
        method: 'GET',
        url: '/accounts',
        headers: { 'Authorization': `Bearer ${tokenA}` }
      })

      response.statusCode.should.eq(200)
      response.payload = JSON.parse(response.payload)
      response.payload.length.should.eq(0)
    })

    it('allows users to create new accounts', async () => {
      let response = await server.inject({
        method: 'POST',
        url: '/accounts',
        headers: { 'Authorization': `Bearer ${tokenA}` }
      })

      response.statusCode.should.eq(200)
      response.payload = JSON.parse(response.payload)
      response.payload.id.should.be.a('number')
      response.payload.user_ids.length.should.eq(1)
      response.payload.user_ids[0].should.eq(userA.user.id)

      createdAccountID = response.payload.id
    })

    it('returns an updated account list after making a new account', async () => {
      let response = await server.inject({
        method: 'GET',
        url: '/accounts',
        headers: { 'Authorization': `Bearer ${tokenA}` }
      })

      response.statusCode.should.eq(200)
      response.payload = JSON.parse(response.payload)
      response.payload.length.should.eq(1)
      response.payload.forEach(entry => {
        entry.id.should.be.a('number')
        entry.user_ids.length.should.eq(1)
        entry.user_ids[0].should.eq(userA.user.id)
      })
    })
  })

  describe('Specific Accounts', () => {
    it('allows users to pull specific information about individual accounts', async () => {
      let response = await server.inject({
        method: 'GET',
        url: `/accounts/${createdAccountID}`,
        headers: { 'Authorization': `Bearer ${tokenA}` }
      })

      response.statusCode.should.eq(200)
      response.payload = JSON.parse(response.payload)
      response.payload.id.should.eq(createdAccountID)
      response.payload.user_ids.length.should.eq(1)
      response.payload.user_ids[0].should.eq(userA.user.id)
    })

    it('blocks requests from users that do not have access to a specific account', async () => {
      let response = await server.inject({
        method: 'GET',
        url: `/accounts/${createdAccountID}`,
        headers: { 'Authorization': `Bearer ${tokenB}` }
      })

      response.statusCode.should.eq(401)
    })

    it('returns not found for accounts that do not exist', async () => {
      let response = await server.inject({
        method: 'GET',
        url: `/accounts/1000000`,
        headers: { 'Authorization': `Bearer ${tokenB}` }
      })

      response.statusCode.should.eq(404)
    })
  })

  after(async () => {
    await UserHelper.cleanup(userA)
    await UserHelper.cleanup(userB)
  })
})
