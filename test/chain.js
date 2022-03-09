const test = require('brittle')
const RAM = require('random-access-memory')
const Chain = require('../lib/chain')

test('chain - append', async function (t) {
  const { chain } = await create()

  {
    const seq = await chain.append([
      Buffer.from('hello'),
      Buffer.from('world')
    ])

    t.is(seq, 0)
    t.is(chain.tree.length, 2)
    t.is(chain.tree.byteLength, 10)
    t.alike([
      await chain.blocks.get(0),
      await chain.blocks.get(1)
    ], [
      Buffer.from('hello'),
      Buffer.from('world')
    ])
  }

  {
    const seq = await chain.append([
      Buffer.from('hej')
    ])

    t.is(seq, 2)
    t.is(chain.tree.length, 3)
    t.is(chain.tree.byteLength, 13)
    t.alike([
      await chain.blocks.get(0),
      await chain.blocks.get(1),
      await chain.blocks.get(2)
    ], [
      Buffer.from('hello'),
      Buffer.from('world'),
      Buffer.from('hej')
    ])
  }
})

test('chain - append and truncate', async function (t) {
  const { chain, reopen } = await create()

  await chain.append([
    Buffer.from('hello'),
    Buffer.from('world'),
    Buffer.from('fo'),
    Buffer.from('ooo')
  ])

  await chain.truncate(3, 1)

  t.is(chain.tree.length, 3)
  t.is(chain.tree.byteLength, 12)
  t.is(chain.tree.fork, 1)
  t.alike(chain.header.hints.reorgs, [{ from: 0, to: 1, ancestors: 3 }])

  await chain.append([
    Buffer.from('a'),
    Buffer.from('b'),
    Buffer.from('c'),
    Buffer.from('d')
  ])

  await chain.truncate(3, 2)

  t.is(chain.tree.length, 3)
  t.is(chain.tree.byteLength, 12)
  t.is(chain.tree.fork, 2)
  t.alike(chain.header.hints.reorgs, [{ from: 0, to: 1, ancestors: 3 }, { from: 1, to: 2, ancestors: 3 }])

  await chain.truncate(2, 3)

  t.alike(chain.header.hints.reorgs, [{ from: 2, to: 3, ancestors: 2 }])

  await chain.append([Buffer.from('a')])
  await chain.truncate(2, 4)

  await chain.append([Buffer.from('a')])
  await chain.truncate(2, 5)

  await chain.append([Buffer.from('a')])
  await chain.truncate(2, 6)

  await chain.append([Buffer.from('a')])
  await chain.truncate(2, 7)

  t.is(chain.header.hints.reorgs.length, 4)

  // check that it was persisted
  const chainReopen = await reopen()

  t.is(chainReopen.tree.length, 2)
  t.is(chainReopen.tree.byteLength, 10)
  t.is(chainReopen.tree.fork, 7)
  t.is(chainReopen.header.hints.reorgs.length, 4)
})

test('chain - user data', async function (t) {
  const { chain, reopen } = await create()

  await chain.userData('hello', Buffer.from('world'))
  t.alike(chain.header.userData, [{ key: 'hello', value: Buffer.from('world') }])

  await chain.userData('hej', Buffer.from('verden'))
  t.alike(chain.header.userData, [
    { key: 'hello', value: Buffer.from('world') },
    { key: 'hej', value: Buffer.from('verden') }
  ])

  await chain.userData('hello', null)
  t.alike(chain.header.userData, [{ key: 'hej', value: Buffer.from('verden') }])

  await chain.userData('hej', Buffer.from('world'))
  t.alike(chain.header.userData, [{ key: 'hej', value: Buffer.from('world') }])

  // check that it was persisted
  const chainReopen = await reopen()

  t.alike(chainReopen.header.userData, [{ key: 'hej', value: Buffer.from('world') }])
})

test('chain - verify', async function (t) {
  const { chain } = await create()
  const { chain: clone } = await create({ keyPair: { publicKey: chain.header.signer.publicKey } })

  t.is(clone.header.signer.publicKey, chain.header.signer.publicKey)

  await chain.append([Buffer.from('a'), Buffer.from('b')])

  {
    const p = await chain.tree.proof({ upgrade: { start: 0, length: 2 } })
    await clone.verify(p)
  }

  t.is(clone.header.tree.length, 2)
  t.is(clone.header.tree.signature, chain.header.tree.signature)

  {
    const p = await chain.tree.proof({ block: { index: 1, nodes: await clone.tree.nodes(2), value: true } })
    p.block.value = await chain.blocks.get(1)
    await clone.verify(p)
  }
})

test('chain - verify parallel upgrades', async function (t) {
  const { chain } = await create()
  const { chain: clone } = await create({ keyPair: { publicKey: chain.header.signer.publicKey } })

  t.is(clone.header.signer.publicKey, chain.header.signer.publicKey)

  await chain.append([Buffer.from('a'), Buffer.from('b'), Buffer.from('c'), Buffer.from('d')])

  {
    const p1 = await chain.tree.proof({ upgrade: { start: 0, length: 2 } })
    const p2 = await chain.tree.proof({ upgrade: { start: 0, length: 3 } })

    const v1 = clone.verify(p1)
    const v2 = clone.verify(p2)

    await v1
    await v2
  }

  t.is(clone.header.tree.length, chain.header.tree.length)
  t.is(clone.header.tree.signature, chain.header.tree.signature)
})

test('chain - update hook is triggered', async function (t) {
  const { chain } = await create()
  const { chain: clone } = await create({ keyPair: { publicKey: chain.header.signer.publicKey } })

  let ran = 0

  chain.onupdate = (status, bitfield, value, from) => {
    t.is(status, 0b01, 'was appended')
    t.is(from, null, 'was local')
    t.alike(bitfield, { drop: false, start: 0, length: 4 })
    ran |= 1
  }

  await chain.append([Buffer.from('a'), Buffer.from('b'), Buffer.from('c'), Buffer.from('d')])

  const peer = {}

  clone.onupdate = (status, bitfield, value, from) => {
    t.is(status, 0b01, 'was appended')
    t.is(from, peer, 'was remote')
    t.alike(bitfield, { drop: false, start: 1, length: 1 })
    t.alike(value, Buffer.from('b'))
    ran |= 2
  }

  {
    const p = await chain.tree.proof({ block: { index: 1, nodes: 0, value: true }, upgrade: { start: 0, length: 2 } })
    p.block.value = await chain.blocks.get(1)
    await clone.verify(p, peer)
  }

  clone.onupdate = (status, bitfield, value, from) => {
    t.is(status, 0b00, 'no append or truncate')
    t.is(from, peer, 'was remote')
    t.alike(bitfield, { drop: false, start: 3, length: 1 })
    t.alike(value, Buffer.from('d'))
    ran |= 4
  }

  {
    const p = await chain.tree.proof({ block: { index: 3, nodes: await clone.tree.nodes(6), value: true } })
    p.block.value = await chain.blocks.get(3)
    await clone.verify(p, peer)
  }

  chain.onupdate = (status, bitfield, value, from) => {
    t.is(status, 0b10, 'was truncated')
    t.is(from, null, 'was local')
    t.alike(bitfield, { drop: true, start: 1, length: 3 })
    ran |= 8
  }

  await chain.truncate(1, 1)

  chain.onupdate = (status, bitfield, value, from) => {
    t.is(status, 0b01, 'was appended')
    t.is(from, null, 'was local')
    t.alike(bitfield, { drop: false, start: 1, length: 1 })
    ran |= 16
  }

  await chain.append([Buffer.from('e')])

  clone.onupdate = (status, bitfield, value, from) => {
    t.is(status, 0b11, 'was appended and truncated')
    t.is(from, peer, 'was remote')
    t.alike(bitfield, { drop: true, start: 1, length: 3 })
    ran |= 32
  }

  {
    const p = await chain.tree.proof({ block: { index: 0, nodes: 0, value: false }, upgrade: { start: 0, length: 2 } })
    const r = await clone.tree.reorg(p)

    await clone.reorg(r, peer)
  }

  chain.onupdate = (status, bitfield, value, from) => {
    t.is(status, 0b10, 'was truncated')
    t.is(from, null, 'was local')
    t.alike(bitfield, { drop: true, start: 1, length: 1 })
    ran |= 64
  }

  await chain.truncate(1, 2)

  clone.onupdate = (status, bitfield, value, from) => {
    t.is(status, 0b10, 'was truncated')
    t.is(from, peer, 'was remote')
    t.alike(bitfield, { drop: true, start: 1, length: 1 })
    ran |= 128
  }

  {
    const p = await chain.tree.proof({ block: { index: 0, nodes: 0, value: false }, upgrade: { start: 0, length: 1 } })
    const r = await clone.tree.reorg(p)

    await clone.reorg(r, peer)
  }

  t.is(ran, 255, 'ran all')
})

async function create (opts) {
  const storage = new Map()

  const createFile = (name) => {
    if (storage.has(name)) return storage.get(name)
    const s = new RAM()
    storage.set(name, s)
    return s
  }

  const reopen = () => Chain.open(createFile, opts)
  const chain = await reopen()
  return { chain, reopen }
}
