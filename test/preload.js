const crypto = require('@web4/bitweb-crypto')
const test = require('brittle')
const ram = require('random-access-memory')
const Unichain = require('../')

test('preload - storage', async function (t) {
  const chain = new Unichain(null, {
    preload: () => {
      return { storage: ram }
    }
  })
  await chain.ready()

  await chain.append('hello world')
  t.is(chain.length, 1)
  t.alike(await chain.get(0), Buffer.from('hello world'))

  t.end()
})

test('preload - from another chain', async function (t) {
  t.plan(2)

  const first = new Unichain(ram)
  await first.ready()

  const second = new Unichain(null, {
    preload: () => {
      return { from: first }
    }
  })
  await second.ready()

  t.is(first.key, second.key)
  t.is(first.sessions, second.sessions)
})

test('preload - custom keypair', async function (t) {
  const keyPair = crypto.keyPair()
  const chain = new Unichain(ram, keyPair.publicKey, {
    preload: () => {
      return { keyPair }
    }
  })
  await chain.ready()

  t.ok(chain.writable)
  t.is(chain.key, keyPair.publicKey)

  t.end()
})

test('preload - sign/storage', async function (t) {
  const keyPair = crypto.keyPair()
  const chain = new Unichain(null, keyPair.publicKey, {
    valueEncoding: 'utf-8',
    preload: () => {
      return {
        storage: ram,
        sign: signable => crypto.sign(signable, keyPair.secretKey)
      }
    }
  })
  await chain.ready()

  t.ok(chain.writable)
  await chain.append('hello world')
  t.is(chain.length, 1)
  t.is(await chain.get(0), 'hello world')

  t.end()
})
