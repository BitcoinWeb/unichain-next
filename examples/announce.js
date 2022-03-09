const Unichain = require('../')
const Bitswarm = require('@web4/bitswarm')
const chain = new Unichain('./source')

start()

async function start () {
  await chain.ready()
  while (chain.length < 1000) {
    await chain.append('block #' + chain.length)
  }

  const swarm = new Hyperswarm()
  swarm.on('connection', socket => chain.replicate(socket))
  swarm.join(chain.discoveryKey, { server: true, client: false })

  console.log('Chain:', chain.key.toString('hex'))
}
