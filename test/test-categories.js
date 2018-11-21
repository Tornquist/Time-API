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

describe('Categories', function() {
  let server;

  let userA, userB;
  let tokenA, tokenB;

  let userBAccountID;
  let userBRootID;

  let createdAccountID;

  before(async function() {
    this.timeout(5000)

    server = await require(process.env.PWD+'/server')

    UserHelper.link(Time)
    userA = await UserHelper.create()
    tokenA = await UserHelper.login(userA, server)

    userB = await UserHelper.create()
    tokenB = await UserHelper.login(userB, server)

    let accountResponse = await server.inject({
      method: 'POST',
      url: '/accounts',
      headers: { 'Authorization': `Bearer ${tokenB}` }
    })
    userBAccountID = JSON.parse(accountResponse.payload).id
    userBRootID = (await getCategories(tokenB)).payload[0].id
  })

  let getCategories = async (token) => {
    let response = await server.inject({
      method: 'GET',
      url: '/categories',
      headers: { 'Authorization': `Bearer ${token}` }
    })

    response.payload = JSON.parse(response.payload)
    return response
  }

  describe('Listing and creating', () => {
    let rootID;
    let childID;
    let accountID;

    it('starts with no categories', async () => {
      let response = await getCategories(tokenA)

      response.statusCode.should.eq(200)
      response.payload.length.should.eq(0)
    })

    it('creates a root category with every account created', async () => {
      let accountResponse = await server.inject({
        method: 'POST',
        url: '/accounts',
        headers: { 'Authorization': `Bearer ${tokenA}` }
      })
      accountID = JSON.parse(accountResponse.payload).id

      let response = await getCategories(tokenA)

      response.statusCode.should.eq(200)
      response.payload.length.should.eq(1)

      should.equal(response.payload[0].parent_id, null)
      response.payload[0].name.should.eq("root")
      rootID = response.payload[0].id
    })

    it('makes new categories without a parent children of the root category', async () => {
      let newCategory = await server.inject({
        method: 'POST',
        url: '/categories',
        headers: { 'Authorization': `Bearer ${tokenA}` },
        payload: {
          account_id: accountID,
          name: 'My first category'
        }
      })

      newCategory.statusCode.should.eq(200)
      let createdCategory = JSON.parse(newCategory.payload)

      createdCategory.parent_id.should.eq(rootID)
      createdCategory.account_id.should.eq(accountID)
      createdCategory.name.should.eq('My first category')
      createdCategory.id.should.be.a('number')

      childID = createdCategory.id
    })

    it('returns all categories after creating new ones', async () => {
      let response = await getCategories(tokenA)

      response.statusCode.should.eq(200)
      response.payload.length.should.eq(2)
    })

    it('allows creating categories with a specified parent', async () => {
      let newCategory = await server.inject({
        method: 'POST',
        url: '/categories',
        headers: { 'Authorization': `Bearer ${tokenA}` },
        payload: {
          account_id: accountID,
          name: 'My second category',
          parent_id: childID
        }
      })

      newCategory.statusCode.should.eq(200)
      let createdCategory = JSON.parse(newCategory.payload)

      createdCategory.parent_id.should.eq(childID)
      createdCategory.account_id.should.eq(accountID)
      createdCategory.name.should.eq('My second category')
      createdCategory.id.should.be.a('number')
    })

    it('rejects creating categories with a parent that does not exist', async () => {
      let newCategory = await server.inject({
        method: 'POST',
        url: '/categories',
        headers: { 'Authorization': `Bearer ${tokenA}` },
        payload: {
          account_id: accountID,
          name: 'My failing category',
          parent_id: 1000000
        }
      })

      newCategory.statusCode.should.eq(400)
    })

    it('rejects creating categories for unauthorized accounts', async () => {
      let newCategory = await server.inject({
        method: 'POST',
        url: '/categories',
        headers: { 'Authorization': `Bearer ${tokenA}` },
        payload: {
          account_id: userBAccountID,
          name: 'My failing category'
        }
      })

      newCategory.statusCode.should.eq(401)
    })

    it('rejects mismatched account and parent ids', async () => {
      let newCategory = await server.inject({
        method: 'POST',
        url: '/categories',
        headers: { 'Authorization': `Bearer ${tokenA}` },
        payload: {
          account_id: accountID,
          name: 'My failing category',
          parent_id: userBRootID
        }
      })

      newCategory.statusCode.should.eq(400)
      let message = JSON.parse(newCategory.payload).message
      message.should.eq('Mismatched Parent and Account IDs')
    })
  })

  after(async () => {
    await UserHelper.cleanup(userA)
    await UserHelper.cleanup(userB)
  })
})
