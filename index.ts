import { AsyncFeed, Feed } from './lib/AsyncFeed'
import BlockStorage from './lib/BlockStorage'
import { MergeHandler } from './lib/MergeHandler'
import Transaction from './lib/Transaction'



type RWFunction = (index: number, data: Buffer) => Buffer
type ConstructOpts = { valueEncoding?: string, onWrite?: RWFunction, onRead?: RWFunction }
type IndexNode = { id: number, children: Array<number>, content: Array<number>, index?: number }

export class HyperObjects {
    public readonly feed: AsyncFeed
    private valueEncoding: string
    private storage: BlockStorage


    constructor(feed: Feed, opts?: ConstructOpts) {
        opts = opts || {}
        this.feed = new AsyncFeed(feed)
        this.storage = new BlockStorage(this.feed, opts.onWrite, opts.onRead)
        this.valueEncoding = opts.valueEncoding || 'binary'
    }

    async transaction<T>(executor: (tr: Transaction) => Promise<T>, mergeHandler?: MergeHandler) : Promise<T> {
        await this.storage.ready()
        const head = await this.feed.length()
        const tr = new Transaction(this.storage, head, {valueEncoding: this.valueEncoding, mergeHandler: mergeHandler})
        await tr.ready()
        const retval = await executor(tr)
        await tr.commit()
        return retval
    }

    
}