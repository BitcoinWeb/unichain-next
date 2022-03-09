const test = require('brittle')
const ram = require('random-access-memory')
const crypto = require('@web4/bitweb-crypto')
const codecs = require('codecs')

const Unichain = require('../')

test('sessions - can create writable sessions from a read-only chain', async function (t) {
  t.plan(5)

  const keyPair = crypto.keyPair()
  const chain = new Unichain(ram, keyPair.publicKey, {
    valueEncoding: 'utf-8'
  })
  await chain.ready()
  t.absent(chain.writable)

  const session = chain.session({ keyPair: { secretKey: keyPair.secretKey } })
  await session.ready()
  t.ok(session.writable)

  try {
    await chain.append('hello')
    t.fail('should not have appended to the read-only chain')
  } catch {
    t.pass('read-only chain append threw correctly')
  }

  try {
    await session.append('world')
    t.pass('session append did not throw')
  } catch {
    t.fail('session append should not have thrown')
  }

  t.is(chain.length, 1)
  t.end()
})

test('sessions - writable session with custom sign function', async function (t) {
  t.plan(5)

  const keyPair = crypto.keyPair()
  const chain = new Unichain(ram, keyPair.publicKey, {
    valueEncoding: 'utf-8'
  })
  await chain.ready()
  t.absent(chain.writable)

  const session = chain.session({ sign: signable => crypto.sign(signable, keyPair.secretKey) })
  t.ok(session.writable)

  try {
    await chain.append('hello')
    t.fail('should not have appended to the read-only chain')
  } catch {
    t.pass('read-only chain append threw correctly')
  }

  try {
    await session.append('world')
    t.pass('session append did not throw')
  } catch {
    t.fail('session append should not have thrown')
  }

  t.is(chain.length, 1)
  t.end()
})

test('sessions - writable session with invalid keypair throws', async function (t) {
  t.plan(2)

  const keyPair1 = crypto.keyPair()
  const keyPair2 = crypto.keyPair()

  try {
    const chain = new Unichain(ram, keyPair2.publicKey) // Create a new chain in read-only mode.
    const session = chain.session({ keyPair: keyPair1 })
    await session.ready()
    t.fail('invalid keypair did not throw')
  } catch {
    t.pass('invalid keypair threw')
  }

  try {
    const chain = new Unichain(ram, keyPair1.publicKey, { keyPair: keyPair2 }) // eslint-disable-line
    await chain.ready()
    t.fail('invalid keypair did not throw')
  } catch {
    t.pass('invalid keypair threw')
  }
})

test('sessions - auto close', async function (t) {
  const chain = new Unichain(ram, { autoClose: true })

  let closed = false
  chain.on('close', function () {
    closed = true
  })

  const a = chain.session()
  const b = chain.session()

  await a.close()
  t.absent(closed, 'not closed yet')

  await b.close()
  t.ok(closed, 'all closed')
})

test('sessions - auto close different order', async function (t) {
  const chain = new Unichain(ram, { autoClose: true })

  const a = chain.session()
  const b = chain.session()

  let closed = false
  a.on('close', function () {
    closed = true
  })

  await chain.close()
  t.absent(closed, 'not closed yet')

  await b.close()
  t.ok(closed, 'all closed')
})

test('sessions - auto close with all closing', async function (t) {
  const chain = new Unichain(ram, { autoClose: true })

  const a = chain.session()
  const b = chain.session()

  let closed = 0
  a.on('close', () => closed++)
  b.on('close', () => closed++)
  chain.on('close', () => closed++)

  await Promise.all([chain.close(), a.close(), b.close()])
  t.is(closed, 3, 'all closed')
})

test('sessions - auto close when using from option', async function (t) {
  const chain1 = new Unichain(ram, {
    autoClose: true
  })
  const chain2 = new Unichain({
    preload: () => {
      return {
        from: chain1
      }
    }
  })
  await chain2.close()
  t.ok(chain1.closed)
})

test('sessions - close with from option', async function (t) {
  const chain1 = new Unichain(ram)
  await chain1.append('hello world')

  const chain2 = new Unichain({
    preload: () => {
      return {
        from: chain1
      }
    }
  })
  await chain2.close()

  t.absent(chain1.closed)
  t.alike(await chain1.get(0), Buffer.from('hello world'))
})

test('sessions - custom valueEncoding on session', async function (t) {
  const chain1 = new Unichain(ram)
  await chain1.append(codecs('json').encode({ a: 1 }))

  const chain2 = chain1.session({ valueEncoding: 'json' })
  await chain2.append({ b: 2 })

  t.alike(await chain2.get(0), { a: 1 })
  t.alike(await chain2.get(1), { b: 2 })
})

test('sessions - custom preload hook on first/later sessions', async function (t) {
  const preloadsTest = t.test('both preload hooks called')
  preloadsTest.plan(2)

  const chain1 = new Unichain(ram, {
    preload: () => {
      preloadsTest.pass('first hook called')
      return null
    }
  })
  const chain2 = chain1.session({
    preload: () => {
      preloadsTest.pass('second hook called')
      return null
    }
  })
  await chain2.ready()

  await preloadsTest
})
