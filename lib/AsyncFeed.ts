import Messages from '../messages'
import { InternalError } from './Errors'
import {CBFunction, CBFunctionP1} from './types'

export type Peer = {remoteAddress: string, type: string, remoteKey: Buffer}

export type Feed = {
  get: CBFunctionP1,
  append: CBFunctionP1,
  head: CBFunction,
  ready: CBFunction,
  update: CBFunctionP1 | CBFunction,
  on(event: string, cb: (...args) => any): void,
  once(event: string, cb: (...args) => any): void,
  length: number,
  key: Buffer,
  writable: boolean,
  discoveryKey: Buffer,
  peers: Peer[]
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
      return new Promise<void>((resolve, reject) => {
        feed.ready((err) => {
          if (err) reject(err)
          else resolve()
        })
      })
    }

    async function onReady(): Promise<void> {
      if (await self.length() === 0 && self.feed.writable) {
        const encoded = Messages.HypercoreHeader.encode({ dataStructureType: 'hyperobjects' })
        await new Promise<void>((resolve, reject) => {
          feed.append(encoded, err => {
            if (err) reject(err)
            else resolve()
          })
        })
      }
    }
  }

  async update(minLength?: number, timeout?: number) {
    let done = false
    return Promise.all([new Promise((resolve, reject) => {
        this.feed.update({minLength, ifAvailable: true}, err => {
          done = true
          if(err) reject(err)
          else resolve(undefined)
        })
      }),
      new Promise((resolve, reject) => {
        if(timeout) {
          setTimeout(() => done ? resolve(undefined) : reject(new Error('Timeout (' + timeout +'ms)')), timeout)
        } else {
          resolve(undefined)
        }
      })
    ]).catch(err => {
      throw new Error('failed to update feed ' + this.feed.key.toString('hex') + ' because of error: ' + err.message)
    })
  }

  async length(): Promise<number> {
    while (this.pending.length > 0) {
      await Promise.all(this.pending)
    }
    if (this.pending.length > 0) throw new InternalError('pending should be zero!')
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
    let resolveFoo
    this.lock = new Promise((resolve) => {resolveFoo = resolve })
    await critical(this.lock)
    this.lock = null
    resolveFoo()
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
