const Unichain = require('../')

start()

async function start () {
  const chain = new Unichain('/tmp/basic')
  await chain.append(['Hello', 'World'])
  console.log(chain)
  await chain.close()
}
