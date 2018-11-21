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

describe('Categories', function() {
  let server;

  before(async function() {
    this.timeout(5000)

    server = await require(process.env.PWD+'/server')

    AccountHelper.link(Time)
    CategoryHelper.link(Time)
    UserHelper.link(Time)
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
    // Managed by before/acfer
    let userA, userB;
    let tokenA, tokenB;

    let userBAccountID;
    let userBRootID;

    // Shared between tests
    let rootID;
    let childID;
    let accountID;

    before(async function() {
      this.timeout(5000)

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

    after(async () => {
      await UserHelper.cleanup(userA)
      await UserHelper.cleanup(userB)
    })
  })

  describe('Modifying categories', () => {
    let userA, userB;
    let tokenA, tokenB;
    let accountA, accountB, accountC;
    let rootA, rootB, rootC;
    let a, b, c, d, e, f, g, h;

    before(async function() {
      this.timeout(10000)

      userA = await UserHelper.create()
      tokenA = await UserHelper.login(userA, server)
      userB = await UserHelper.create()

      /*
          root A
          ├── A
          │   ├── B
          │   │   ├── C
          │   │   └── D
          │   ├── E
          │   └── F
          └── G

          root B
          └── H
      */

      accountA = await AccountHelper.create(userA.user.id)
      rootA = await AccountHelper.getRootCategory(accountA)

      accountB = await AccountHelper.create(userA.user.id)
      rootB = await AccountHelper.getRootCategory(accountB)

      accountC = await AccountHelper.create(userB.user.id)
      rootC = await AccountHelper.getRootCategory(accountC)

      a = await CategoryHelper.create("A", accountA)
      b = await CategoryHelper.create("B", accountA, a)
      c = await CategoryHelper.create("C", accountA, b)
      d = await CategoryHelper.create("D", accountA, b)
      e = await CategoryHelper.create("E", accountA, a)
      f = await CategoryHelper.create("F", accountA, a)
      g = await CategoryHelper.create("G", accountA)
      h = await CategoryHelper.create("H", accountB)
    })

    it('starts with the expected tree', async () => {
      let categories = await getCategories(tokenA)

      categories.payload.length.should.eq(10)
      categories.payload.forEach((category) => {
        switch (category.id) {
          case a.id:
            category.parent_id.should.eq(rootA.id)
            break
          case b.id:
            category.parent_id.should.eq(a.id)
            break
          case c.id:
            category.parent_id.should.eq(b.id)
            break
          case d.id:
            category.parent_id.should.eq(b.id)
            break
          case e.id:
            category.parent_id.should.eq(a.id)
            break
          case f.id:
            category.parent_id.should.eq(a.id)
            break
          case g.id:
            category.parent_id.should.eq(rootA.id)
            break
          case h.id:
            category.parent_id.should.eq(rootB.id)
            break
          default:
            category.name.should.eq('root')
        }
      })
    })

    describe('Validation', () => {
      it('rejects actions on categories that do not exist', async () => {
        let response = await server.inject({
          method: 'GET',
          url: '/categories/10000',
          headers: { 'Authorization': `Bearer ${tokenA}` }
        })

        response.statusCode.should.eq(404)
      })

      it('rejects actions on categories the user does not have access to', async () => {
        let response = await server.inject({
          method: 'GET',
          url: `/categories/${rootC.id}`,
          headers: { 'Authorization': `Bearer ${tokenA}` }
        })

        response.statusCode.should.eq(401)
      })
    })

    describe('Basic updates', () => {
      it('allows fetching a specific category', async () => {
        let response = await server.inject({
          method: 'GET',
          url: `/categories/${a.id}`,
          headers: { 'Authorization': `Bearer ${tokenA}` }
        })

        response.statusCode.should.eq(200)
        response.payload = JSON.parse(response.payload)
        response.payload.name.should.eq("A")
      })

      it('allows changing a category\'s name', async () => {
        let name = "Alphabet"
        let response = await server.inject({
          method: 'PUT',
          url: `/categories/${a.id}`,
          headers: { 'Authorization': `Bearer ${tokenA}` },
          payload: { name }
        })

        response.statusCode.should.eq(200)
        response.payload = JSON.parse(response.payload)
        response.payload.name.should.eq(name)
      })

      it('rejects empty updates', async () => {
        let response = await server.inject({
          method: 'PUT',
          url: `/categories/${a.id}`,
          headers: { 'Authorization': `Bearer ${tokenA}` },
          payload: { }
        })

        response.statusCode.should.eq(400)
      })

      it('allows fetching category updates', async () => {
        let response = await server.inject({
          method: 'GET',
          url: `/categories/${a.id}`,
          headers: { 'Authorization': `Bearer ${tokenA}` }
        })

        response.statusCode.should.eq(200)
        response.payload = JSON.parse(response.payload)
        response.payload.name.should.eq("Alphabet")
      })
    })

    describe('Moving categories', () => {
      it('allows moving a category within the same account', async () => {
        let response = await server.inject({
          method: 'PUT',
          url: `/categories/${f.id}`,
          headers: { 'Authorization': `Bearer ${tokenA}` },
          payload: { parent_id: d.id }
        })

        response.statusCode.should.eq(200)
        response.payload = JSON.parse(response.payload)
        response.payload.name.should.eq("F")
        response.payload.parent_id.should.eq(d.id)

        let categories = await getCategories(tokenA)
        let category = categories.payload.filter(category => category.id === f.id)[0]
        category.parent_id.should.eq(d.id)
      })

      it('allows moving a category between accounts without a new parent', async () => {
        let response = await server.inject({
          method: 'PUT',
          url: `/categories/${b.id}`,
          headers: { 'Authorization': `Bearer ${tokenA}` },
          payload: { account_id: accountB.id }
        })

        response.statusCode.should.eq(200)
        response.payload = JSON.parse(response.payload)
        response.payload.name.should.eq("B")
        response.payload.parent_id.should.eq(rootB.id)
        response.payload.account_id.should.eq(accountB.id)

        let categories = await getCategories(tokenA)

        let bUp = categories.payload.find(category => category.id === b.id)
        bUp.name.should.eq("B")
        bUp.parent_id.should.eq(rootB.id)
        bUp.account_id.should.eq(accountB.id)

        let cUp = categories.payload.find(category => category.id === c.id)
        cUp.name.should.eq("C")
        cUp.parent_id.should.eq(b.id)
        cUp.parent_id.should.eq(bUp.id)
        cUp.account_id.should.eq(accountB.id)

        let dUp = categories.payload.find(category => category.id === d.id)
        dUp.name.should.eq("D")
        dUp.parent_id.should.eq(b.id)
        dUp.parent_id.should.eq(bUp.id)
        dUp.account_id.should.eq(accountB.id)

        let fUp = categories.payload.find(category => category.id === f.id)
        fUp.name.should.eq("F")
        fUp.parent_id.should.eq(d.id)
        fUp.parent_id.should.eq(dUp.id)
        fUp.account_id.should.eq(accountB.id)
      })

      it('allows moving a category between accounts to a specific parent', async () => {
        let response = await server.inject({
          method: 'PUT',
          url: `/categories/${g.id}`,
          headers: { 'Authorization': `Bearer ${tokenA}` },
          payload: { account_id: accountB.id, parent_id: h.id }
        })

        response.statusCode.should.eq(200)
        response.payload = JSON.parse(response.payload)
        response.payload.name.should.eq("G")
        response.payload.parent_id.should.eq(h.id)
        response.payload.account_id.should.eq(accountB.id)
      })

      it('denies moving categories to a mismatched parent and account', async () => {
        let response = await server.inject({
          method: 'PUT',
          url: `/categories/${g.id}`,
          headers: { 'Authorization': `Bearer ${tokenA}` },
          payload: { account_id: accountA.id, parent_id: f.id }
        })

        response.statusCode.should.eq(400)
        let message = JSON.parse(response.payload).message
        message.should.eq('Mismatched Parent and Account IDs')
      })

      it('denies moving categories to a parent the user does not have access to', async () => {
        let response = await server.inject({
          method: 'PUT',
          url: `/categories/${g.id}`,
          headers: { 'Authorization': `Bearer ${tokenA}` },
          payload: { parent_id: rootC.id }
        })

        response.statusCode.should.eq(401)
      })

      it('denies moving categories to an account the user does not have access to', async () => {
        let response = await server.inject({
          method: 'PUT',
          url: `/categories/${g.id}`,
          headers: { 'Authorization': `Bearer ${tokenA}` },
          payload: { account_id: accountC.id }
        })

        response.statusCode.should.eq(401)
      })
    })

    describe('Deleting categories', () => {
      it('allows deleting categories and preserving the children', async () => {
        let response = await server.inject({
          method: 'DELETE',
          url: `/categories/${b.id}`,
          headers: { 'Authorization': `Bearer ${tokenA}` }
        })
        response.statusCode.should.eq(200)

        let categories = await getCategories(tokenA)

        let bUp = categories.payload.find(category => category.id === b.id)
        should.equal(bUp, undefined)

        let cUp = categories.payload.find(category => category.id === c.id)
        cUp.name.should.eq("C")
        cUp.parent_id.should.eq(rootB.id)
        cUp.account_id.should.eq(accountB.id)

        let dUp = categories.payload.find(category => category.id === d.id)
        dUp.name.should.eq("D")
        dUp.parent_id.should.eq(rootB.id)
        dUp.account_id.should.eq(accountB.id)

        let fUp = categories.payload.find(category => category.id === f.id)
        fUp.name.should.eq("F")
        fUp.parent_id.should.eq(d.id)
        fUp.parent_id.should.eq(dUp.id)
        fUp.account_id.should.eq(accountB.id)
      })

      it('allows deleting categories and the children', async () => {
        let response = await server.inject({
          method: 'DELETE',
          url: `/categories/${d.id}`,
          headers: { 'Authorization': `Bearer ${tokenA}` },
          payload: { delete_children: true }
        })
        response.statusCode.should.eq(200)

        let categories = await getCategories(tokenA)

        let dUp = categories.payload.find(category => category.id === d.id)
        should.equal(dUp, undefined)

        let fUp = categories.payload.find(category => category.id === f.id)
        should.equal(fUp, undefined)
      })

      it('allows explicitely preserving children', async () => {
        let response = await server.inject({
          method: 'DELETE',
          url: `/categories/${g.id}`,
          headers: { 'Authorization': `Bearer ${tokenA}` },
          payload: { delete_children: false }
        })

        response.statusCode.should.eq(200)

        let categories = await getCategories(tokenA)

        let gUp = categories.payload.find(category => category.id === g.id)
        should.equal(gUp, undefined)

        let hUp = categories.payload.find(category => category.id === h.id)
        hUp.name.should.eq("H")
        hUp.parent_id.should.eq(rootB.id)
        hUp.account_id.should.eq(accountB.id)
      })
    })

    after(async () => {
      await AccountHelper.cleanup(accountA)
      await AccountHelper.cleanup(accountB)

      await UserHelper.cleanup(userA)
      await UserHelper.cleanup(userB)
    })
  })
})
