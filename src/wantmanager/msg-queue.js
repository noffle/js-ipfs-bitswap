'use strict'

const debug = require('debug')
const async = require('async')

const Message = require('../message')

const log = debug('bitswap:wantmanager:queue')
log.error = debug('bitswap:wantmanager:queue:error')

module.exports = class MsgQueue {
  constructor (peerId, network) {
    this.p = peerId
    this.network = network
    this.refcnt = 1

    this.queue = async.queue(this.doWork.bind(this), 1)
    // only start when `run` is called
    this.queue.pause()
  }

  addMessage (msg) {
    this.queue.push(msg)
  }

  addEntries (entries, full) {
    const msg = new Message(Boolean(full))

    for (let entry of entries) {
      if (entry.cancel) {
        msg.cancel(entry.key)
      } else {
        msg.addEntry(entry.key, entry.priority)
      }
    }

    this.addMessage(msg)
  }

  doWork (wlm, cb) {
    this.network.connectTo(this.p, (err) => {
      if (err) {
        log('cant connect to peer %s: %s', this.p.toHexString(), err.message)
        return cb()
      }

      this.network.sendMessage(this.p, wlm, (err) => {
        if (err) {
          log('send error: %s', err.message)
        }

        cb()
      })
    })
  }

  run () {
    this.queue.resume()
  }

  stop () {
    const done = () => {
      this.queue.kill()
      this.queue.pause()
    }

    // Give the queue up to 1s time to finish things
    this.queue.drain = done
    setTimeout(done, 1000)
  }
}
