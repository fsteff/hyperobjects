"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SimpleMergeHandler = void 0;
const Errors_1 = require("./Errors");
class SimpleMergeHandler {
    constructor(store) {
        this.store = store;
    }
    // merge has to be in a critical section
    async merge(latest, current, collisions, lockKey) {
        if (collisions && collisions.length > 0) {
            throw new Errors_1.CollisionError(collisions, 'Collisions occured for objects ' + collisions.map(c => c.id));
        }
        const changes = latest.diff.concat(current.changed);
        const self = this;
        let ctr = Math.max(latest.marker.objectCtr, current.marker.objectCtr);
        for (const created of current.created) {
            const id = ctr++;
            created.id = id;
            changes.push({ id, index: created.index || 0 });
        }
        await self.store.saveChanges(changes, latest.marker, latest.head - 1, lockKey);
    }
}
exports.SimpleMergeHandler = SimpleMergeHandler;
//# sourceMappingURL=MergeHandler.js.map