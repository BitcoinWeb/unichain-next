const tape = require('tape')
const { create } = require('./helpers')

tape('basic', async function (t) {
  const core = await create()
  let appends = 0

  t.same(core.length, 0)
  t.same(core.byteLength, 0)
  t.same(core.writable, true)
  t.same(core.readable, true)

  core.on('append', function () {
    appends++
  })

  await core.append('hello')
  await core.append('world')

  t.same(core.length, 2)
  t.same(core.byteLength, 10)
  t.same(appends, 2)

  t.end()
})

tape('session', async function (t) {
  const core = await create()

  const session = core.session()

  await session.append('test')
  t.same(await core.get(0), Buffer.from('test'))
  t.same(await session.get(0), Buffer.from('test'))
  t.end()
})

tape('get beyond length throws immediately', async function (t) {
  t.plan(1)

  const core = await create()
  try {
    await core.get(10)
    t.fail('should have thrown')
  } catch {
    t.pass('threw successfully')
  }
})
