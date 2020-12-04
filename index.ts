import { AsyncFeed, Feed } from './lib/AsyncFeed'
import { Change } from './lib/MergeHandler'
import Messages from './messages'

const BUCKET_WIDTH = 3
const BUCKET_SIZE = 1 << BUCKET_WIDTH
const BUCKET_MASK = (BUCKET_SIZE - 1)

type RWFunction = (index: number, data: Buffer) => Buffer
type ConstructOpts = { valueEncoding?: String, onWrite?: RWFunction, onRead?: RWFunction }
type IndexNode = { id: number, children: Array<number>, content: Array<number>, index?: number }

export default class HyperObjects {
    public readonly feed: AsyncFeed
    private valueEncoding: String
    private onWrite?: RWFunction
    private onRead?: RWFunction

    constructor(feed: Feed, opts?: ConstructOpts) {
        opts = opts || {}
        this.feed = new AsyncFeed(feed)
        this.onRead = opts.onRead
        this.onWrite = opts.onWrite
        this.valueEncoding = opts.valueEncoding || 'binary'
    }

    public async getObjectIndex(id: number, head?: number): Promise<number> {
        const node = await this.getIndexNode(id, head)
        const slot = id & BUCKET_MASK
        if (node.children.length <= slot || node.children.length[slot] === 0) {
            throw new Error(`Object #${id} not found for transaction at ${head ? head : -1}`)
        }
        return node.children[slot]
    }

    private async getIndexNode(id: number, head?: number): Promise<IndexNode> {
        const prefix = id >> BUCKET_WIDTH
        let decoded
        if (id === 0 && await this.feed.length() < 3) {
            decoded = this.createIndexNode(id)
        } else {
            decoded = await this.fetchNodeAt(typeof head === 'number' ? head : -1) // get head
        }
        let addr = prefix
        let slot = (addr & BUCKET_MASK) - 1
        while (decoded.id !== prefix) {
            if (decoded.children.length > slot && decoded.children[slot] !== 0) {
                decoded = await this.fetchNodeAt(decoded.children[slot])
            } else {
                return this.createIndexNode(prefix)
            }
            slot = addr & BUCKET_MASK
            addr = addr >> BUCKET_WIDTH
        }
        return decoded
    }

    private async fetchNodeAt(index: number): Promise<IndexNode> {
        const head = await (index >= 0 ? this.feed.get(index) : this.feed.head())
        const node = <IndexNode>Messages.IndexNode.decode(head)
        node.index = index >= 0 ? index : await this.feed.length() - 1
        return node
    }

    private createIndexNode(id): IndexNode {
        return {
            id: id,
            children: [],
            content: []
        }
    }

    async getObjectAtIndex(index: number) {
        const buf = <Buffer>await this.feed.get(index)
        const block = Messages.Block.decode(buf)
        let data = block.content.dataBlock
        if (!data) {
            throw new Error('Block is not a data block, but a ' + block.content.marker ? 'marker' : 'node')
        }
        if (this.onRead) {
            data = this.onRead(index, data)
        }
        return data
    }

    async appendObject(data) {
        const block = Messages.Block.encode({ content: { dataBlock: data } })
        const index = await this.feed.length()
        await this.feed.append(block)
        return index
    }

    async saveChanges(changes: Array<Change>, head: number, lockKey: Promise<void>) {
        const nodes = new Map<number, IndexNode>()
        const addrs = new Array<number>()
        for(const change of changes) {
            const addr = change.id >> BUCKET_WIDTH
            const slot = change.id & BUCKET_MASK
            let node = nodes.get(addr)
            if(!node) {
                node = await this.getIndexNode(change.id, head)
                nodes.set(addr, node)
                addrs.push(addr)
            }
            node.content[slot] = change.index
        }
        addrs.sort((a,b) => b - a)
        const changedNodes = <Array<IndexNode>> addrs.map(a => nodes.get(a))

        const bulk = new Array<Buffer>()
        let ctr = await this.feed.length()
        while(changedNodes.length > 0) {
            const node = changedNodes[0]
            node.index = ctr++
            bulk.push(Messages.Block.encode({content: {indexNode: node}}))
            changedNodes.splice(0 , 1)

            let addr = node.id >> BUCKET_WIDTH
            let slot = (addr & BUCKET_MASK) - 1
            while (addr > 0) {
                let parent
                if(nodes.has(addr)) {
                    parent = nodes.get(addr)
                }
                else {
                    parent = await this.getIndexNode(addr)
                    nodes.set(addr, parent)
                    changedNodes.push(parent)
                    changedNodes.sort((a,b) => b.id - a.id)
                }
                parent.children[slot] = node.index
            }
        }
        await this.feed.append(bulk, { lockKey })
    }
}