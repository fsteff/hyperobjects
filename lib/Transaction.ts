import codecs from 'codecs'
import HyperObjects from '../index'
import Messages from '../messages'
import { Change, Changes, Collision, Diff, MergeHandler, SimpleMergeHandler } from './MergeHandler'
import {TransactionMarker} from './types'

type ConstructorOpts = { valueEncoding?: string, mergeHandler?: MergeHandler }
type ChangeEntry = {index?: number, id?: number}

export default class Transaction {
    private readonly db: HyperObjects
    private readonly transaction: Promise<{marker: TransactionMarker, head: number}>
    private readonly codec: any
    private readonly mergeHandler: MergeHandler

    private changes: Array<ChangeEntry>

    constructor (db: HyperObjects, head?: number, opts?: ConstructorOpts) {
        opts = opts || {}
        this.db = db
        this.codec = codecs(opts.valueEncoding)
        this.mergeHandler = opts.mergeHandler || new SimpleMergeHandler(db)
        this.changes = []
        this.transaction = this.findLatestTransaction(head)
            .then(({ block, index }) => { return {marker: block, head: index}})
    }

    async create (value: any) {
        const data = this.codec.encode(value)
        const index = await this.db.appendObject(data)
        this.changes.push({index})
    }

    async get (id: number) {
        const head = (await this.transaction).head
        const index = await this.db.getObjectIndex(id, head)
        const data = await this.db.getObjectAtIndex(index)
        return this.codec.decode(data)
    }

    async set (id: number, value: any) {
        const data = this.codec.encode(value)
        const index = await this.db.appendObject(data)
        this.changes.push({id, index})
    }

    async delete (id: number) {
        this.changes.push({id})
    }

    async commit() {
        const diff: Diff = {
            created: this.changes.filter(c => !c.id).map(c => {return {index: c.index}}),
            changed: this.changes.filter(c => !!c.id).map(c => <Change>c),
            deleted: this.changes.filter(c => !c.index).map(c => {return {id: c.id}}),
            marker: (await this.transaction).marker
        }

        const latest = await this.findLatestTransaction()
        const current = (await this.transaction).head
        const changes: Changes = {
            diff: new Array<Change>(),
            marker: latest.block
        }
        const collisions = new Array<Collision>()

        // TODO: calc diffs!
        if(latest.index > current) {

        }
    
        await this.mergeHandler.merge(changes, diff, collisions, latest.index)
    }

    private async findLatestTransaction(head?: number) {
        let index = head || await this.db.feed.length()
        let block
        do {
          const buf = <Buffer> await this.db.feed.get(--index)
          block = this.decodeTransactionBlock(buf)
        } while (! block && index > 0)
        if (! block) throw new Error('no transaction marker found')
        return { block, index }
    }

    private decodeTransactionBlock(buf: Buffer) {
        try{
            let block = Messages.Block.decode(buf)
            if (block.content.marker) return block.content.marker
            else return null
        } catch (error) {
            console.error('failed to decode transaction block: ' + buf)
            return null
        }
    }
}