const tape = require('tape')
const path = require('path')
const hypercore = require('../')

tape('default storage works', function (t) {
  const dir = path.join(__dirname, 'sandbox')
  const feed = hypercore(dir, { overwrite: true })

  feed.append('a', function (err) {
    t.error(err, 'no error')

    feed.get(0, function (err, data) {
      t.error(err, 'no error')
      t.same(data, Buffer.from('a'))
      t.same(feed.length, 1)

      feed.close(function () {
        const feed2 = hypercore(dir)

        feed2.ready(function (err) {
          t.error(err, 'no error')
          t.same(feed2.length, 1)
          t.end()
        })
      })
    })
  })
})