import Messages from '../messages'
import {CBFunction, CBFunctionP1} from './types'

export type Feed = {
  get: CBFunctionP1,
  append: CBFunctionP1,
  head: CBFunction,
  ready: CBFunction,
  length: number
}

export class AsyncFeed {
  public readonly feed: Feed
  private readonly pending: Array<Promise<any>>
  private readonly readyPromise: Promise<void>
  private lock?: Promise<void> | null = null

  constructor(feed: Feed) {
    const self = this
    this.feed = feed
    this.pending = []
    this.readyPromise = ready().then(onReady)

    async function ready(): Promise<void> {
      return new Promise((resolve, reject) => {
        feed.ready((err) => {
          if (err) reject(err)
          else resolve()
        })
      })
    }

    async function onReady(): Promise<void> {
      if (await self.length() === 0) {
        const encoded = Messages.HypercoreHeader.encode({ dataStructureType: 'hyperobjects' })
        await new Promise((resolve, reject) => {
          feed.append(encoded, err => {
            if (err) reject(err)
            else resolve()
          })
        })
      }
    }
  }

  async length(): Promise<number> {
    while (pending.length > 0) {
      await Promise.all(this.pending)
    }
    if (pending.length > 0) throw new Error('pending should be zero!')
    return this.feed.length
  }

  ready() {
    return this.readyPromise
  }

  get(...args) {
    return this.promise(this.feed.get, ...args)
  }
  async append(block, opts?: {lockKey: Promise<void>}) {
    while (this.lock && !(opts && opts.lockKey === this.lock)) await this.lock
    return this.promise(this.feed.append, block)
  }

  head(...args) {
    return this.promise(this.feed.head, ...args)
  }

  async criticalSection (critical: (lockKey: Promise<void>) => void) {
    const self = this
    while(this.lock) await this.lock
    const lock = this.lock = new Promise(section)
    async function section(resolve: Function) {
      await critical(lock)
      resolve()
    }
    await this.lock
    this.lock = null
  }

  private async promise(foo: Function, ...args) {
    const self = this
    await this.readyPromise
    const p = new Promise((resolve, reject) => {
      foo.call(self.feed, ...args, callback) 

      function callback(err: Error, result?: any) {
        self.pending.splice(self.pending.indexOf(p), 1)
        if (err) reject(err)
        else resolve(result)
      }
    })
    self.pending.push(p)
    return p
  }
}
