const test = require('brittle')
const Unichain = require('../')
const tmp = require('tmp-promise')
const { create } = require('./helpers')

test('userdata - can set through setUserData', async function (t) {
  const chain = await create()
  await chain.setUserData('hello', Buffer.from('world'))

  t.alike(await chain.getUserData('hello'), Buffer.from('world'))

  t.end()
})

test('userdata - can set through constructor option', async function (t) {
  const chain = await create({
    userData: {
      hello: Buffer.from('world')
    }
  })

  t.alike(await chain.getUserData('hello'), Buffer.from('world'))

  t.end()
})

test('userdata - persists across restarts', async function (t) {
  const dir = await tmp.dir()

  let chain = new Unichain(dir.path, {
    userData: {
      hello: Buffer.from('world')
    }
  })
  await chain.ready()

  await chain.close()
  chain = new Unichain(dir.path, {
    userData: {
      other: Buffer.from('another')
    }
  })

  t.alike(await chain.getUserData('hello'), Buffer.from('world'))
  t.alike(await chain.getUserData('other'), Buffer.from('another'))
  t.end()
})
