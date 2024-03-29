import BlockStorage from "./BlockStorage"
import { CollisionError } from "./Errors"
import { TransactionMarker, CreatedObject, ChangedObject, DeletedObject } from "./types"

export type Collision = {id: number, index1: number, index2: number}
export type Changes = {diff: Array<ChangedObject>, marker: TransactionMarker, head: number}
export type Diff = {
    created: Array<CreatedObject>
    changed: Array<ChangedObject>
    deleted: Array<DeletedObject>,
    marker: TransactionMarker
}

export interface MergeHandler {
    merge(meanwhile: Changes, current: Diff, collisions: Array<Collision>, lockKey: Promise<void>): Promise<void>
}

export class SimpleMergeHandler implements MergeHandler {
    private store: BlockStorage

    constructor(store: BlockStorage) {
        this.store = store
    }

    // merge has to be in a critical section
    public async merge(latest: Changes, current: Diff, collisions: Array<Collision>, lockKey: Promise<void>) {
        if (collisions && collisions.length > 0) {
            throw new CollisionError(collisions, 'Collisions occured for objects ' + collisions.map(c => c.id))
        }

        const changes = latest.diff.concat(current.changed)
        const self = this
        let ctr = Math.max(latest.marker.objectCtr, current.marker.objectCtr)
        for(const created of current.created) {
            const id = ctr++
            created.id = id
            changes.push({id, index: created.index || 0})
        }

        await self.store.saveChanges(changes, latest.marker, latest.head - 1, lockKey)
    }
}