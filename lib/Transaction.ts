import codecs from 'codecs'
import Messages from '../messages'
import BlockStorage from './BlockStorage'
import { InternalError } from './Errors'
import { Changes, Collision, Diff, MergeHandler, SimpleMergeHandler } from './MergeHandler'
import {TransactionMarker, ChangedObject, CreatedObject, DeletedObject, RWFunction} from './types'

export type ConstructorOpts = { valueEncoding?: string, mergeHandler?: MergeHandler }

export default class Transaction {
    private readonly store: BlockStorage
    private readonly codec: any
    private readonly mergeHandler: MergeHandler
    private transaction: Promise<{marker: TransactionMarker, head: number}>

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

    // for onWrite to be called immediate has to be true!
    async create (value?: any, immediate = false, onWrite?: RWFunction) {
        let index = 0
        if(value) {
            value = this.codec.encode(value)
            if(immediate) index = await this.store.appendObject(value, onWrite)
        }
        const obj: {id?: number} = {}
        const change: CreatedObject = {index, resolveId: resolve}
        if(!immediate) change.value = value
        this.created.push(change)
        return obj

        function resolve(id: number) {
            obj.id = id
        }
    }

    async get (id: number, onRead?: RWFunction) {
        const head = (await this.transaction).head - 1
        const index = await this.store.getObjectIndex(id, head)
        if(!index || index === 0) {
            return null
        }
        let data = await this.store.getObjectAtIndex(index)
        if(onRead) data = onRead(index, data)
        return this.codec.decode(data)
    }

    // for onWrite to be called immediate has to be true!
    async set (id: number, value: any, immediate = false, onWrite?: RWFunction) {
        let index = 0
        value = this.codec.encode(value)
        const change: ChangedObject = {id, index}
        if(immediate) change.index = await this.store.appendObject(value, onWrite)
        else change.value = value

        this.changed.push(change)
    }

    async delete (id: number) {
        this.deleted.push({id})
    }

    rollback() {
        this.created.splice(0, this.created.length)
        this.changed.splice(0, this.changed.length)
        this.deleted.splice(0, this.deleted.length)
    }

    async commit() {
        const sumChanges = this.created.length + this.changed.length + this.deleted.length
        const { marker, head } = await this.transaction
        const rootIndex = head - 1
        if(sumChanges === 0) {
            return // nothing changed, no need to create a transaction
        }

        // flush modified objects to the feed in one large batch
        let batch: Array<CreatedObject | ChangedObject> = this.created.filter(c => !!c.value)
        batch = batch.concat(this.changed.filter(c => !!c.value))
        if(batch.length > 0) {
            await this.store.appendObjectBatch(batch)
        }

        const diff: Diff = {
            created: this.created,
            changed: this.changed,
            deleted: this.deleted,
            marker: marker
        }

        const latest = await this.findLatestTransaction()
        const changes: Changes = {
            diff: new Array<ChangedObject>(),
            marker: latest.block,
            head: latest.index
        }
        const collisions = new Array<Collision>()

        if(latest.index > head) {
            for(let i = 0; i < latest.block.objectCtr; i += 8) {
                const oldNode = await this.store.getIndexNodeForObjectId(i, rootIndex)         
                const newNode = await this.store.getIndexNodeForObjectId(i, latest.index - 1)
                if(oldNode.index !== newNode.index) {
                    for(let slot = 0; slot < 8; slot++) {
                        if(oldNode.content[slot] !== newNode.content[slot]) {
                            changes.diff.push({id: i + slot, index: newNode.content[slot]})
                        }
                    }
                }
            }
        }

        for(const change of changes.diff) {
            let coll = diff.changed.find(c => c.id === change.id)
            if(coll) collisions.push({id: change.id, index1: change.index, index2: coll.index})
        }

        await this.mergeHandler.merge(changes, diff, collisions, rootIndex)
        this.created.splice(0, this.created.length)
        this.changed.splice(0, this.changed.length)
        this.deleted.splice(0, this.deleted.length)
        // reset to new transaction
        this.transaction = this.findLatestTransaction()
            .then(({ block, index }) => { return {marker: block, head: index}})
    }

    public async getPreviousTransactionIndex() {
        return (await this.transaction).head
    }

    private async findLatestTransaction(head?: number): Promise<{block: TransactionMarker, index: number}> {
        let index = head || await this.store.feed.length()
        let block: TransactionMarker | null
        do {
          const buf = <Buffer> await this.store.feed.get(--index)
          block = this.decodeTransactionBlock(buf)
        } while (! block && index > 0)
        if (! block) throw new InternalError('no transaction marker found')
        return { block, index }
    }

    private decodeTransactionBlock(buf: Buffer) : TransactionMarker | null {
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