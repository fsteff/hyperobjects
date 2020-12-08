import codecs from 'codecs'
import Messages from '../messages'
import BlockStorage from './BlockStorage'
import { Changes, Collision, Diff, MergeHandler, SimpleMergeHandler } from './MergeHandler'
import {TransactionMarker, ChangedObject, CreatedObject, DeletedObject} from './types'

type ConstructorOpts = { valueEncoding?: string, mergeHandler?: MergeHandler }

export default class Transaction {
    private readonly store: BlockStorage
    private readonly transaction: Promise<{marker: TransactionMarker, head: number}>
    private readonly codec: any
    private readonly mergeHandler: MergeHandler

    private changed: Array<ChangedObject> = []
    private created: Array<CreatedObject> = []
    private deleted: Array<DeletedObject> = []

    constructor (store: BlockStorage, head?: number, opts?: ConstructorOpts) {
        opts = opts || {}
        this.store = store
        this.codec = codecs(opts.valueEncoding || 'binary')
        this.mergeHandler = opts.mergeHandler || new SimpleMergeHandler(store)
        this.transaction = this.findLatestTransaction(head)
            .then(({ block, index }) => { return {marker: block, head: index}})
    }

    async ready() {
        await this.transaction
    }

    async create (value?: any) {
        let index = 0
        if(value) {
            const data = this.codec.encode(value)
            index = await this.store.appendObject(data)
        }
        const obj: {id?: number} = {}
        this.created.push({index, resolveId: resolve})
        return obj

        function resolve(id: number) {
            obj.id = id
        }
    }

    async get (id: number) {
        const head = (await this.transaction).head - 1
        const index = await this.store.getObjectIndex(id, head)
        const data = await this.store.getObjectAtIndex(index)
        return this.codec.decode(data)
    }

    async set (id: number, value: any) {
        const data = this.codec.encode(value)
        const index = await this.store.appendObject(data)
        this.changed.push({id, index})
    }

    async delete (id: number) {
        this.deleted.push({id})
    }

    async commit() {
        const sumChanges = this.created.length + this.changed.length + this.deleted.length
        if(sumChanges === 0) {
            return // nothing changed, no need to create a transaction
        }
        const diff: Diff = {
            created: this.created,
            changed: this.changed,
            deleted: this.deleted,
            marker: (await this.transaction).marker
        }

        const latest = await this.findLatestTransaction()
        const current = (await this.transaction).head
        const changes: Changes = {
            diff: new Array<ChangedObject>(),
            marker: latest.block
        }
        const collisions = new Array<Collision>()

        // TODO: calc diffs!
        if(latest.index > current) {

        }

        await this.mergeHandler.merge(changes, diff, collisions, latest.index - 1)
        this.created.splice(0, this.created.length)
        this.changed.splice(0, this.changed.length)
        this.deleted.splice(0, this.deleted.length)
    }

    private async findLatestTransaction(head?: number) {
        let index = head || await this.store.feed.length()
        let block
        do {
          const buf = <Buffer> await this.store.feed.get(--index)
          block = this.decodeTransactionBlock(buf)
        } while (! block && index > 0)
        if (! block) throw new Error('no transaction marker found')
        return { block, index }
    }

    private decodeTransactionBlock(buf: Buffer) {
        try{
            let block = Messages.Block.decode(buf)
            if (block.marker) return block.marker
            else return null
        } catch (error) {
            console.error('failed to decode transaction block: ' + buf)
            return null
        }
    }
}