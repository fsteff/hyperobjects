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

    constructor(feed: AsyncFeed, onWrite?: RWFunction, onRead?: RWFunction) {
        this.feed = feed
        this.onWrite = onWrite
        this.onRead = onRead
        const self = this
        this.readyPromise = async function () {
            await feed.ready()
            const length = await feed.length()
            if (length === 1) {
                const indexNode = self.createIndexNode(0)
                await feed.criticalSection(async lockKey => {
                    const buf = self.encodeIndexNode(indexNode)
                    const marker = self.createTransactionMarker(1, 0)
                    await feed.append([buf, marker], { lockKey })
                })
            }
        }()
    }

    public async ready() {
        return this.readyPromise
    }

    public async getObjectIndex(id: number, head?: number): Promise<number> {
        const node = await this.getIndexNodeForObjectId(id, head)
        const slot = id & BUCKET_MASK
        if (node.content.length <= slot || node.content.length[slot] === 0) {
            throw new Error(`Object #${id} not found for transaction at ${head ? head : -1}`)
        }
        return node.content[slot]
    }

    async getIndexNodeForObjectId(id: number, head?: number): Promise<IndexNode> {
        const self = this
        const prefix = id >> BUCKET_WIDTH
        return this.getIndexNode(prefix, head)
    }

    async getIndexNode(prefix: number, head?: number) : Promise<IndexNode>{
        if (prefix === 0) {
            return this.fetchNodeAt(typeof head === 'number' ? head : -1) // get head
        } else {
            const path = this.calcNodePath(prefix)
            const node = await this.getIndexNodeByPath(path, head)
            if(node) return node
            else return this.createIndexNode(prefix)
        }
    }

    async getIndexNodeByPath(path: Array<number>, head?: number) {
        let decoded = await this.fetchNodeAt(typeof head === 'number' ? head : -1) // get head
        for (const slot of path) {
            if (decoded.children.length > slot && decoded.children[slot] > 0) {
                decoded = await this.fetchNodeAt(decoded.children[slot])
            } else {
                return null
            }
        }
        return decoded
    }
    

    private async fetchNodeAt(index: number): Promise<IndexNode> {
        const head = await (index >= 0 ? this.feed.get(index) : this.feed.head())
        const block = Messages.Block.decode(head)
        if (!block.indexNode) {
            throw new Error('Block #' + (index || -1) + ' is not an indexNode block, but a ' + (block.marker ? 'marker' : 'dataBlock'))
        }
        const node = <IndexNode>block.indexNode
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
        let data = block.dataBlock
        if (!data) {
            throw new Error('Block #' + index + ' is not a data block, but a ' + (block.marker ? 'marker' : 'node'))
        }
        if (this.onRead) {
            data = this.onRead(index, data)
        }
        return data
    }

    async appendObject(data) {
        let index
        const self = this
        await this.feed.criticalSection(async lockKey => {
            index = await self.feed.length()
            if (self.onWrite) {
                data = self.onWrite(index, data)
            }
            const block = this.encodeDataBlock(data)
            await self.feed.append(block, { lockKey })
        })

        return index
    }

    async saveChanges(changes: Array<ChangedObject>, lastTransaction: TransactionMarker, head: number, lockKey: Promise<void>) {
        const nodes = new Map<number, IndexNode>()
        const addrs = new Array<number>()
        let objectCtr = 0
        for (const change of changes) {
            objectCtr = Math.max(change.id, objectCtr)
            const addr = change.id >> BUCKET_WIDTH
            const slot = change.id & BUCKET_MASK
            let node = nodes.get(addr)
            if (!node) {
                node = await this.getIndexNodeForObjectId(change.id, head)
                nodes.set(addr, node)
                addrs.push(addr)
            }
            node.content[slot] = change.index
        }
        addrs.sort((a, b) => b - a)
        const changedNodes = <Array<IndexNode>>addrs.map(a => nodes.get(a))

        const bulk = new Array<Buffer>()
        let ctr = await this.feed.length()
        while (changedNodes.length > 0) {
            const node = changedNodes[0]
            node.index = ctr++
            bulk.push(this.encodeIndexNode(node))
            changedNodes.splice(0, 1)

            if (node.id > 0) {
                const path = this.calcNodePath(node.id)
                const parentId = node.id >> BUCKET_WIDTH
                const slot = path[path.length - 1]
                let parent
                if (nodes.has(parentId)) {
                    parent = nodes.get(parentId)
                } else {
                    parent = await this.getIndexNodeByPath(path.slice(0, path.length - 1))
                    if(!parent) {
                        throw new Error('parent node must not be null')
                    }
                    nodes.set(parent.id, parent)
                    changedNodes.push(parent)
                    changedNodes.sort((a, b) => b.id - a.id)
                }
                parent.children[slot] = node.index
            }
        }
        bulk.push(this.createTransactionMarker(lastTransaction.sequenceNr + 1, objectCtr + 1))
        await this.feed.append(bulk, { lockKey })
    }

    createTransactionMarker(sequenceNr: number, objectCtr: number) {
        const marker = {
            sequenceNr,
            objectCtr,
            timestamp: Date.now()
        }
        return this.encodeTransactionBlock(marker)
    }

    private encodeIndexNode(indexNode: IndexNode) {
        return Messages.Block.encode({ indexNode })
    }

    private encodeDataBlock(dataBlock: Buffer) {
        return Messages.Block.encode({ dataBlock })
    }

    private encodeTransactionBlock(marker: TransactionMarker) {
        return Messages.Block.encode({ marker })
    }

    private calcNodePath(addr: number) {
        const path = new Array<number>()
        while (addr > 0) {
            path.push(addr & BUCKET_MASK)
            addr = addr >> BUCKET_WIDTH
        }
        path.reverse()
        path[0] -= 1 // slots of first node have an offset of 1
        return path
    }
}