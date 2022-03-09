const { Writable, Readable } = require('streamx')

class ReadStream extends Readable {
  constructor (chain, opts = {}) {
    super()

    this.chain = chain
    this.start = opts.start || 0
    this.end = typeof opts.end === 'number' ? opts.end : -1
    this.snapshot = !opts.live && opts.snapshot !== false
    this.live = !!opts.live
  }

  _open (cb) {
    this._openP().then(cb, cb)
  }

  _read (cb) {
    this._readP().then(cb, cb)
  }

  async _openP () {
    if (this.end === -1) await this.chain.update()
    else await this.chain.ready()
    if (this.snapshot && this.end === -1) this.end = this.chain.length
  }

  async _readP () {
    const end = this.live ? -1 : (this.end === -1 ? this.chain.length : this.end)
    if (end >= 0 && this.start >= end) {
      this.push(null)
      return
    }

    this.push(await this.chain.get(this.start++))
  }
}

exports.ReadStream = ReadStream

class WriteStream extends Writable {
  constructor (chain) {
    super()
    this.chain = chain
  }

  _writev (batch, cb) {
    this._writevP(batch).then(cb, cb)
  }

  async _writevP (batch) {
    await this.chain.append(batch)
  }
}

exports.WriteStream = WriteStream
