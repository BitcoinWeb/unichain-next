# Unichain 2

NOTE: This is the _ALPHA_ version of the upcoming [Unichain](https://github.com/bitwebs/unichain-next) 2 protocol upgrade.

Features all the power of Unichain combined with

* Multiwriter support
* Fork recovery
* Promises
* Simplications and performance/scaling improvements
* Internal oplog design

## Install

Install from NPM using the next tag

```sh
npm install @web4/unichain@next
```

## API

#### `const chain = new Unichain(storage, [key], [options])`

Make a new Unichain instance.

`storage` should be set to a directory where you want to store the data and chain metadata.

``` js
const chain = new Unichain('./directory') // store data in ./directory
```

Alternatively you can pass a function instead that is called with every filename Unichain needs to function and return your own [abstract-random-access](https://github.com/random-access-storage/abstract-random-access) instance that is used to store the data.

``` js
const ram = require('random-access-memory')
const chain = new Unichain((filename) => {
  // filename will be one of: data, bitfield, tree, signatures, key, secret_key
  // the data file will contain all your data concatenated.

  // just store all files in ram by returning a random-access-memory instance
  return ram()
})
```

Per default Unichain uses [random-access-file](https://github.com/random-access-storage/random-access-file). This is also useful if you want to store specific files in other directories.

Unichain will produce the following files:

* `oplog` - The internal truncating journal/oplog that tracks mutations, the public key and other metadata.
* `tree` - The Merkle Tree file.
* `bitfield` - The bitfield of which data blocks this chain has.
* `data` - The raw data of each block.

Note that `tree`, `data`, and `bitfield` are normally heavily sparse files.

`key` can be set to a Unichain public key. If you do not set this the public key will be loaded from storage. If no key exists a new key pair will be generated.

`options` include:

``` js
{
  createIfMissing: true, // create a new Unichain key pair if none was present in storage
  overwrite: false, // overwrite any old Unichain that might already exist
  valueEncoding: 'json' | 'utf-8' | 'binary', // defaults to binary
  encodeBatch: batch => { ... }, // optionally apply an encoding to complete batches
  keyPair: kp, // optionally pass the public key and secret key as a key pair
  encryptionKey: k // optionally pass an encryption key to enable block encryption
}
```

You can also set valueEncoding to any [abstract-encoding](https://github.com/mafintosh/abstract-encoding) or [compact-encoding](https://github.com/compact-encoding) instance.

valueEncodings will be applied to individually blocks, even if you append batches. If you want to control encoding at the batch-level, you can use the `encodeBatch` option, which is a function that takes a batch and returns a binary-encoded batch. If you provide a custom valueEncoding, it will not be applied prior to `encodeBatch`.

#### `const seq = await chain.append(block)`

Append a block of data (or an array of blocks) to the chain.
Returns the seq the first block was stored at.

#### `const block = await chain.get(index, [options])`

Get a block of data.
If the data is not available locally this method will prioritize and wait for the data to be downloaded.

Options include

``` js
{
  wait: true, // wait for block to be downloaded
  onwait: () => {}, // hook that is called if the get is waiting for download
  timeout: 0, // wait at max some milliseconds (0 means no timeout)
  valueEncoding: 'json' | 'utf-8' | 'binary' // defaults to the chain's valueEncoding
}
```

#### `await chain.truncate(newLength, [forkId])`

Truncate the chain to a smaller length.

Per default this will update the fork id of the chain to `+ 1`, but you can set the fork id you prefer with the option.
Note that the fork id should be monotonely incrementing.

#### `const hash = await chain.treeHash([length])`

Get the Merkle Tree hash of the chain at a given length, defaulting to the current length of the chain.

#### `const stream = chain.createReadStream([options])`

Make a read stream. Options include:

``` js
{
  start: 0,
  end: chain.length,
  live: false,
  snapshot: true // auto set end to chain.length on open or update it on every read
}
```

#### `const range = chain.download([range])`

Download a range of data.

You can await when the range has been fully downloaded by doing:

```js
await range.downloaded()
```

A range can have the following properties:

``` js
{
  start: startIndex,
  end: nonInclusiveEndIndex,
  blocks: [index1, index2, ...],
  linear: false // download range linearly and not randomly
}
```

To download the full chain continously (often referred to as non sparse mode) do

``` js
// Note that this will never be consider downloaded as the range
// will keep waiting for new blocks to be appended.
chain.download({ start: 0, end: -1 })
```

To downloaded a discrete range of blocks pass a list of indices.

```js
chain.download({ blocks: [4, 9, 7] });
```

To cancel downloading a range simply destroy the range instance.

``` js
// will stop downloading now
range.destroy()
```

#### `const [index, relativeOffset] = await chain.seek(byteOffset)`

Seek to a byte offset.

Returns `(index, relativeOffset)`, where `index` is the data block the byteOffset is contained in and `relativeOffset` is
the relative byte offset in the data block.

#### `const updated = await chain.update()`

Wait for the chain to try and find a signed update to it's length.
Does not download any data from peers except for a proof of the new chain length.

``` js
const updated = await chain.update()
console.log('chain was updated?', updated, 'length is', chain.length)
```

#### `await chain.close()`

Fully close this chain.

#### `chain.on('close')`

Emitted when then chain has been fully closed.

#### `await chain.ready()`

Wait for the chain to fully open.

After this has called `chain.length` and other properties have been set.

In general you do NOT need to wait for `ready`, unless checking a synchronous property,
as all internals await this themself.

#### `chain.on('ready')`

Emitted after the chain has initially opened all it's internal state.

#### `chain.writable`

Can we append to this chain?

Populated after `ready` has been emitted. Will be `false` before the event.

#### `chain.readable`

Can we read from this chain? After closing the chain this will be false.

Populated after `ready` has been emitted. Will be `false` before the event.

#### `chain.key`

Buffer containing the public key identifying this chain.

Populated after `ready` has been emitted. Will be `null` before the event.

#### `chain.keyPair`

Object containing buffers of the chain's public and secret key

Populated after `ready` has been emitted. Will be `null` before the event.

#### `chain.discoveryKey`

Buffer containing a key derived from the chain's public key.
In contrast to `chain.key` this key does not allow you to verify the data but can be used to announce or look for peers that are sharing the same chain, without leaking the chain key.

Populated after `ready` has been emitted. Will be `null` before the event.

#### `chain.encryptionKey`

Buffer containing the optional block encryption key of this chain. Will be `null` unless block encryption is enabled.

#### `chain.length`

How many blocks of data are available on this chain?

Populated after `ready` has been emitted. Will be `0` before the event.

#### `chain.byteLength`

How much data is available on this chain in bytes?

Populated after `ready` has been emitted. Will be `0` before the event.

#### `chain.fork`

What is the current fork id of this chain?

Populated after `ready` has been emitted. Will be `0` before the event.

#### `chain.padding`

How much padding is applied to each block of this chain? Will be `0` unless block encryption is enabled.

#### `const stream = chain.replicate(isInitiatorOrReplicationStream)`

Create a replication stream. You should pipe this to another Unichain instance.

The `isInitiator` argument is a boolean indicating whether you are the iniatior of the connection (ie the client)
or if you are the passive part (ie the server).

If you are using a P2P swarm like [BitSwarm](https://github.com/bitwebs/bitswarm) you can know this by checking if the swarm connection is a client socket or server socket. In BitSwarm you can check that using the [client property on the peer details object](https://github.com/bitwebs/bitswarm#swarmonconnection-socket-details--)

If you want to multiplex the replication over an existing Unichain replication stream you can pass
another stream instance instead of the `isInitiator` boolean.

``` js
// assuming we have two chains, localChain + remoteChain, sharing the same key
// on a server
const net = require('net')
const server = net.createServer(function (socket) {
  socket.pipe(remoteChain.replicate(false)).pipe(socket)
})

// on a client
const socket = net.connect(...)
socket.pipe(localChain.replicate(true)).pipe(socket)
```

#### `chain.on('append')`

Emitted when the chain has been appended to (i.e. has a new length / byteLength), either locally or remotely.

#### `chain.on('truncate', ancestors, forkId)`

Emitted when the chain has been truncated, either locally or remotely.
