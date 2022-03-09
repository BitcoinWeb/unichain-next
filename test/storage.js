const test = require('brittle')
const sodium = require('sodium-universal')
const crypto = require('@web4/bitweb-crypto')
const RAM = require('random-access-memory')
const Unichain = require('..')

const keyPair = crypto.keyPair(Buffer.alloc(sodium.crypto_sign_SEEDBYTES, 'seed'))

const encryptionKey = Buffer.alloc(sodium.crypto_stream_KEYBYTES, 'encryption key')

test('storage layout', async function (t) {
  const chain = new Unichain(RAM, { keyPair })

  for (let i = 0; i < 10000; i++) {
    await chain.append(Buffer.from([i]))
  }

  t.snapshot(chain.chain.blocks.storage.toBuffer().toString('base64'), 'blocks')
  t.snapshot(chain.chain.tree.storage.toBuffer().toString('base64'), 'tree')
})

test('encrypted storage layout', async function (t) {
  const chain = new Unichain(RAM, { keyPair, encryptionKey })

  for (let i = 0; i < 10000; i++) {
    await chain.append(Buffer.from([i]))
  }

  t.snapshot(chain.chain.blocks.storage.toBuffer().toString('base64'), 'blocks')
  t.snapshot(chain.chain.tree.storage.toBuffer().toString('base64'), 'tree')
})
