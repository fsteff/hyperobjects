import HyperObjects from ".."
import { TransactionMarker } from "./types"

export type Collision = {id: number, index1: number, index2: number}
export type Change = {id: number, index: number}
export type Changes = {diff: Array<Change>, marker: TransactionMarker}
export type Diff = {
    created: Array<{index: number}>
    changed: Array<Change>
    deleted: Array<{id: number}>,
    marker: TransactionMarker
}

export interface MergeHandler {
    merge(meanwhile: Changes, current: Diff, collisions: Array<Collision>, head: number)
}

export class SimpleMergeHandler implements MergeHandler {
    private db: HyperObjects

    constructor(db: HyperObjects) {
        this.db = db
    }

    public async merge(latest: Changes, current: Diff, collisions: Array<Collision>, head: number) {
        if (collisions && collisions.length > 0) {
            throw new Error('Collisions occured for objects ' + collisions.map(c => c.id))
        }

        const changes = latest.diff.concat(current.changed)
        const self = this
        return this.db.feed.criticalSection(lockKey => {
            let ctr = Math.max(latest.marker.objectCtr, current.marker.objectCtr)
            for(const {index} of current.created) {
                changes.push({id: ++ctr, index})
            }
            return self.db.saveChanges(changes, head, lockKey)
        })
    }
}