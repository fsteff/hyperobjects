import { AsyncFeed } from "./AsyncFeed";
import { ChangedObject, IndexNode, RWFunction, TransactionMarker } from './types'
import Messages from '../messages'

const BUCKET_WIDTH = 3
const BUCKET_SIZE = 1 << BUCKET_WIDTH
const BUCKET_MASK = (BUCKET_SIZE - 1)

export default class BlockStorage {
    readonly feed: AsyncFeed
    readonly onWrite?: RWFunction
    readonly onRead?: RWFunction
    private readyPromise: Promise<void>
    
    constructor (feed: AsyncFeed, onWrite?: RWFunction, onRead?: RWFunction) {
        this.feed = feed
        this.onWrite = onWrite
        this.onRead = onRead
        const self = this
        this.readyPromise = async function() {
            const length = await feed.length()
            if(length === 1) {
                const indexNode = self.createIndexNode(1)
                feed.criticalSection(async lockKey => {
                    await feed.append(Messages.Block.encode({content: {indexNode}}))
                    await self.appendTransactionMarker(1, 0, lockKey)
                })
            }
        }()
    }

    public async ready() {
        return this.readyPromise
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
        let index
        const self = this
        this.feed.criticalSection(async lockKey => {
            index = await self.feed.length()
            if(self.onWrite) {
                data = self.onWrite(index, data)
            }
            const block = Messages.Block.encode({ content: { dataBlock: data } })
            await self.feed.append(block, {lockKey})
        })
        
        return index
    }

    async saveChanges(changes: Array<ChangedObject>, lastTransaction: TransactionMarker, head: number, lockKey: Promise<void>) {
        const nodes = new Map<number, IndexNode>()
        const addrs = new Array<number>()
        let objectCtr = 0
        for(const change of changes) {
            objectCtr = Math.max(change.id, objectCtr)
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
        await this.appendTransactionMarker(lastTransaction.sequenceNr + 1, objectCtr, lockKey)
    }

    async appendTransactionMarker(sequenceNr: number, objectCtr: number, lockKey: Promise<void>) {
        const marker = {
            sequenceNr,
            objectCtr,
            timestamp: new Date().getUTCMilliseconds() / 1000
        }
        await this.feed.append(Messages.Block.encode({content: {marker}}), {lockKey})
    }
}