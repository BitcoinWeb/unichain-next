const test = require('brittle')
const ram = require('random-access-memory')

const Unichain = require('../')
const { create } = require('./helpers')

test('basic', async function (t) {
  const chain = await create()
  let appends = 0

  t.is(chain.length, 0)
  t.is(chain.byteLength, 0)
  t.is(chain.writable, true)
  t.is(chain.readable, true)

  chain.on('append', function () {
    appends++
  })

  await chain.append('hello')
  await chain.append('world')

  t.is(chain.length, 2)
  t.is(chain.byteLength, 10)
  t.is(appends, 2)

  t.end()
})

test('session', async function (t) {
  const chain = await create()

  const session = chain.session()

  await session.append('test')
  t.alike(await chain.get(0), Buffer.from('test'))
  t.alike(await session.get(0), Buffer.from('test'))
  t.end()
})

test('close', async function (t) {
  const chain = await create()
  await chain.append('hello world')

  await chain.close()

  try {
    await chain.get(0)
    t.fail('chain should be closed')
  } catch {
    t.pass('get threw correctly when chain was closed')
  }
})

test('close multiple', async function (t) {
  const chain = await create()
  await chain.append('hello world')

  const ev = t.test('events')

  ev.plan(4)

  let i = 0

  chain.on('close', () => ev.is(i++, 0, 'on close'))
  chain.close().then(() => ev.is(i++, 1, 'first close'))
  chain.close().then(() => ev.is(i++, 2, 'second close'))
  chain.close().then(() => ev.is(i++, 3, 'third close'))

  await ev
})

test('storage options', async function (t) {
  const chain = new Unichain({ storage: ram })
  await chain.append('hello')
  t.alike(await chain.get(0), Buffer.from('hello'))
  t.end()
})

test(
  'allow publicKeys with different byteLength that 32, if opts.crypto were passed',
  function (t) {
    const key = Buffer.alloc(33).fill('a')

    const chain = new Unichain(ram, key, { crypto: {} })

    t.is(chain.key, key)
    t.pass('creating a chain with more than 32 byteLength key did not throw')
  }
)

test('createIfMissing', async function (t) {
  const chain = new Unichain(ram, { createIfMissing: false })

  t.exception(chain.ready())
})

test('reopen and overwrite', async function (t) {
  const st = {}
  const chain = new Unichain(open)

  await chain.ready()
  const key = chain.key

  const reopen = new Unichain(open)

  await reopen.ready()
  t.alike(reopen.key, key, 'reopened the chain')

  const overwritten = new Unichain(open, { overwrite: true })

  await overwritten.ready()
  t.unlike(overwritten.key, key, 'overwrote the chain')

  function open (name) {
    if (st[name]) return st[name]
    st[name] = ram()
    return st[name]
  }
})

test('truncate event has truncated-length and fork', async function (t) {
  t.plan(2)

  const chain = new Unichain(ram)

  chain.on('truncate', function (length, fork) {
    t.is(length, 2)
    t.is(fork, 1)
  })

  await chain.append(['a', 'b', 'c'])
  await chain.truncate(2)
})

test('treeHash gets the tree hash at a given chain length', async function (t) {
  const chain = new Unichain(ram)
  await chain.ready()

  const { chain: { tree } } = chain

  const hashes = [tree.hash()]

  for (let i = 1; i < 10; i++) {
    await chain.append([`${i}`])
    hashes.push(tree.hash())
  }

  for (let i = 0; i < 10; i++) {
    t.alike(await chain.treeHash(i), hashes[i])
  }
})

test('snapshot locks the state', async function (t) {
  const chain = new Unichain(ram)
  await chain.ready()

  const a = chain.snapshot()

  await chain.append('a')

  t.is(a.length, 0)
  t.is(chain.length, 1)

  const b = chain.snapshot()

  await chain.append('c')

  t.is(a.length, 0)
  t.is(b.length, 1)
})
