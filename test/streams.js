const test = require('brittle')

const { create } = require('./helpers')

test('basic read stream', async function (t) {
  const chain = await create()

  const expected = [
    'hello',
    'world',
    'verden',
    'welt'
  ]

  await chain.append(expected)

  for await (const data of chain.createReadStream()) {
    t.alike(data.toString(), expected.shift())
  }

  t.is(expected.length, 0)
})

test('read stream with start / end', async function (t) {
  const chain = await create()

  const datas = [
    'hello',
    'world',
    'verden',
    'welt'
  ]

  await chain.append(datas)

  {
    const expected = datas.slice(1)

    for await (const data of chain.createReadStream({ start: 1 })) {
      t.alike(data.toString(), expected.shift())
    }

    t.is(expected.length, 0)
  }

  {
    const expected = datas.slice(2, 3)

    for await (const data of chain.createReadStream({ start: 2, end: 3 })) {
      t.alike(data.toString(), expected.shift())
    }

    t.is(expected.length, 0)
  }
})

test('basic write+read stream', async function (t) {
  const chain = await create()

  const expected = [
    'hello',
    'world',
    'verden',
    'welt'
  ]

  const ws = chain.createWriteStream()

  for (const data of expected) ws.write(data)
  ws.end()

  await new Promise(resolve => ws.on('finish', resolve))

  for await (const data of chain.createReadStream()) {
    t.alike(data.toString(), expected.shift())
  }

  t.is(expected.length, 0)
})
