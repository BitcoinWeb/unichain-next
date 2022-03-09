const Unuchain = require('../')
const Bitswarm = require('@web4/bitswarm')

const chain = new Unichain('./clone', process.argv[2])

start()

async function start () {
  await chain.ready()

  const swarm = new Bitswarm()
  swarm.on('connection', socket => chain.replicate(socket))
  swarm.join(chain.discoveryKey, { server: false, client: true })

  console.log((await chain.get(42)).toString())
  console.log((await chain.get(142)).toString())
  console.log((await chain.get(511)).toString())
  console.log((await chain.get(512)).toString())
  console.log((await chain.get(513)).toString())
}
