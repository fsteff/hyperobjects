"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SimpleMergeHandler = void 0;
class SimpleMergeHandler {
    constructor(store) {
        this.store = store;
    }
    async merge(latest, current, collisions, head) {
        if (collisions && collisions.length > 0) {
            throw new Error('Collisions occured for objects ' + collisions.map(c => c.id));
        }
        const changes = latest.diff.concat(current.changed);
        const self = this;
        return this.store.feed.criticalSection(async (lockKey) => {
            let ctr = Math.max(latest.marker.objectCtr, current.marker.objectCtr);
            for (const created of current.created) {
                const id = ctr++;
                created.id = id;
                changes.push({ id, index: created.index || 0 });
            }
            await self.store.saveChanges(changes, latest.marker, latest.head - 1, lockKey);
            current.created.forEach(c => c.resolveId(c.id));
        });
    }
}
exports.SimpleMergeHandler = SimpleMergeHandler;
//# sourceMappingURL=MergeHandler.js.map