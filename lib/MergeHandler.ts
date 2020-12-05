import BlockStorage from "./BlockStorage"
import { TransactionMarker, CreatedObject, ChangedObject, DeletedObject } from "./types"

export type Collision = {id: number, index1: number, index2: number}
export type Changes = {diff: Array<ChangedObject>, marker: TransactionMarker}
export type Diff = {
    created: Array<CreatedObject>
    changed: Array<ChangedObject>
    deleted: Array<DeletedObject>,
    marker: TransactionMarker
}

export interface MergeHandler {
    merge(meanwhile: Changes, current: Diff, collisions: Array<Collision>, head: number)
}

export class SimpleMergeHandler implements MergeHandler {
    private store: BlockStorage

    constructor(store: BlockStorage) {
        this.store = store
    }

    public async merge(latest: Changes, current: Diff, collisions: Array<Collision>, head: number) {
        if (collisions && collisions.length > 0) {
            throw new Error('Collisions occured for objects ' + collisions.map(c => c.id))
        }

        const changes = latest.diff.concat(current.changed)
        const self = this
        return this.store.feed.criticalSection(async lockKey => {
            let ctr = Math.max(latest.marker.objectCtr, current.marker.objectCtr)
            for(const created of current.created) {
                const id = ++ctr
                created.id = id
                changes.push({id, index: created.index})
            }
            try {
                await self.store.saveChanges(changes, latest.marker, head, lockKey)
                current.created.forEach(c => c.defId.resolve(<number>c.id))
            } catch (err) {
                current.created.forEach(c => c.defId.reject(err))
                throw err
            }
        })
    }
}