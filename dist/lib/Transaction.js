"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const codecs_1 = __importDefault(require("codecs"));
const messages_1 = __importDefault(require("../messages"));
const MergeHandler_1 = require("./MergeHandler");
class Transaction {
    constructor(store, head, opts) {
        this.changed = [];
        this.created = [];
        this.deleted = [];
        opts = opts || {};
        this.store = store;
        this.codec = codecs_1.default(opts.valueEncoding || 'binary');
        this.mergeHandler = opts.mergeHandler || new MergeHandler_1.SimpleMergeHandler(store);
        this.transaction = this.findLatestTransaction(head)
            .then(({ block, index }) => { return { marker: block, head: index }; });
    }
    async ready() {
        await this.transaction;
    }
    async create(value, immediate = false) {
        let index = 0;
        if (value) {
            value = this.codec.encode(value);
            if (immediate)
                index = await this.store.appendObject(value);
        }
        const obj = {};
        const change = { index, resolveId: resolve };
        if (!immediate)
            change.value = value;
        this.created.push(change);
        return obj;
        function resolve(id) {
            obj.id = id;
        }
    }
    async get(id) {
        const head = (await this.transaction).head - 1;
        const index = await this.store.getObjectIndex(id, head);
        if (!index || index === 0) {
            return null;
        }
        const data = await this.store.getObjectAtIndex(index);
        return this.codec.decode(data);
    }
    async set(id, value, immediate = false) {
        let index = 0;
        value = this.codec.encode(value);
        const change = { id, index };
        if (immediate)
            change.index = await this.store.appendObject(value);
        else
            change.value = value;
        this.changed.push(change);
    }
    async delete(id) {
        this.deleted.push({ id });
    }
    rollback() {
        this.created.splice(0, this.created.length);
        this.changed.splice(0, this.changed.length);
        this.deleted.splice(0, this.deleted.length);
    }
    async commit() {
        const sumChanges = this.created.length + this.changed.length + this.deleted.length;
        const { marker, head } = await this.transaction;
        const rootIndex = head - 1;
        if (sumChanges === 0) {
            return; // nothing changed, no need to create a transaction
        }
        // flush modified objects to the feed in one large batch
        let batch = this.created.filter(c => !!c.value);
        batch = batch.concat(this.changed.filter(c => !!c.value));
        if (batch.length > 0) {
            await this.store.appendObjectBatch(batch);
        }
        const diff = {
            created: this.created,
            changed: this.changed,
            deleted: this.deleted,
            marker: marker
        };
        const latest = await this.findLatestTransaction();
        const changes = {
            diff: new Array(),
            marker: latest.block
        };
        const collisions = new Array();
        if (latest.index > head) {
            for (let i = 0; i < latest.block.objectCtr; i += 8) {
                const oldNode = await this.store.getIndexNodeForObjectId(i, rootIndex);
                const newNode = await this.store.getIndexNodeForObjectId(i, latest.index - 1);
                if (oldNode.index !== newNode.index) {
                    for (let slot = 0; slot < 8; slot++) {
                        if (oldNode.content[slot] !== newNode.content[slot]) {
                            changes.diff.push({ id: i + slot, index: newNode.content[slot] });
                        }
                    }
                }
            }
        }
        for (const change of changes.diff) {
            let coll = diff.changed.find(c => c.id === change.id);
            if (coll)
                collisions.push({ id: change.id, index1: change.index, index2: coll.index });
        }
        await this.mergeHandler.merge(changes, diff, collisions, rootIndex);
        this.created.splice(0, this.created.length);
        this.changed.splice(0, this.changed.length);
        this.deleted.splice(0, this.deleted.length);
    }
    async findLatestTransaction(head) {
        let index = head || await this.store.feed.length();
        let block;
        do {
            const buf = await this.store.feed.get(--index);
            block = this.decodeTransactionBlock(buf);
        } while (!block && index > 0);
        if (!block)
            throw new Error('no transaction marker found');
        return { block, index };
    }
    decodeTransactionBlock(buf) {
        try {
            let block = messages_1.default.Block.decode(buf);
            if (block.marker)
                return block.marker;
            else
                return null;
        }
        catch (error) {
            console.error('failed to decode transaction block: ' + buf);
            return null;
        }
    }
}
exports.default = Transaction;
//# sourceMappingURL=Transaction.js.map