"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const messages_1 = __importDefault(require("../messages"));
const BUCKET_WIDTH = 3;
const BUCKET_SIZE = 1 << BUCKET_WIDTH;
const BUCKET_MASK = (BUCKET_SIZE - 1);
class BlockStorage {
    constructor(feed, onWrite, onRead) {
        this.feed = feed;
        this.onWrite = onWrite;
        this.onRead = onRead;
        const self = this;
        this.readyPromise = async function () {
            await feed.ready();
            const length = await feed.length();
            if (length === 1) {
                const indexNode = self.createIndexNode(0);
                await feed.criticalSection(async (lockKey) => {
                    const buf = self.encodeIndexNode(indexNode);
                    const marker = self.createTransactionMarker(1, 0);
                    await feed.append([buf, marker], { lockKey });
                });
            }
        }();
    }
    async ready() {
        return this.readyPromise;
    }
    async getObjectIndex(id, head) {
        const node = await this.getIndexNodeForObjectId(id, head);
        const slot = id & BUCKET_MASK;
        if (node.content.length <= slot || node.content.length[slot] === 0) {
            throw new Error(`Object #${id} not found for transaction at ${head ? head : -1}`);
        }
        return node.content[slot];
    }
    async getIndexNodeForObjectId(id, head) {
        const self = this;
        const prefix = id >> BUCKET_WIDTH;
        return this.getIndexNode(prefix, head);
    }
    async getIndexNode(prefix, head) {
        if (prefix === 0) {
            return this.fetchNodeAt(typeof head === 'number' ? head : -1); // get head
        }
        else {
            const path = this.calcNodePath(prefix);
            const node = await this.getIndexNodeByPath(path, head);
            if (node)
                return node;
            else
                return this.createIndexNode(prefix);
        }
    }
    async getIndexNodeByPath(path, head) {
        let decoded = await this.fetchNodeAt(typeof head === 'number' ? head : -1); // get head
        for (const slot of path) {
            if (decoded.children.length > slot && decoded.children[slot] > 0) {
                decoded = await this.fetchNodeAt(decoded.children[slot]);
            }
            else {
                return null;
            }
        }
        return decoded;
    }
    async fetchNodeAt(index) {
        const head = await (index >= 0 ? this.feed.get(index) : this.feed.head());
        const block = messages_1.default.Block.decode(head);
        if (!block.indexNode) {
            throw new Error('Block #' + (index || -1) + ' is not an indexNode block, but a ' + (block.marker ? 'marker' : 'dataBlock'));
        }
        const node = block.indexNode;
        node.index = index >= 0 ? index : await this.feed.length() - 1;
        return node;
    }
    createIndexNode(id) {
        return {
            id: id,
            children: [],
            content: []
        };
    }
    async getObjectAtIndex(index) {
        const buf = await this.feed.get(index);
        let data;
        let block;
        try {
            block = messages_1.default.Block.decode(buf);
            data = block.dataBlock;
        }
        catch (err) {
            console.error('decoded message is not valid');
            throw err;
        }
        if (!data) {
            throw new Error('Block #' + index + ' is not a data block, but a ' + (block.marker ? 'marker' : 'node'));
        }
        if (this.onRead) {
            data = this.onRead(index, data);
        }
        return data;
    }
    async appendObject(data) {
        let index;
        const self = this;
        await this.feed.criticalSection(async (lockKey) => {
            index = await self.feed.length();
            if (self.onWrite) {
                data = self.onWrite(index, data);
            }
            const block = this.encodeDataBlock(data);
            await self.feed.append(block, { lockKey });
        });
        return index;
    }
    async appendObjectBatch(objs) {
        const self = this;
        await this.feed.criticalSection(async (lockKey) => {
            let objectCtr = await self.feed.length();
            const batch = new Array();
            for (let obj of objs) {
                if (!obj.value)
                    throw new Error('Object needs to have value set');
                if (self.onWrite) {
                    obj.value = self.onWrite(objectCtr, obj.value);
                }
                obj.index = objectCtr++;
                batch.push(self.encodeDataBlock(obj.value));
                delete obj.value;
            }
            await self.feed.append(batch, { lockKey });
        });
        return objs;
    }
    async saveChanges(changes, lastTransaction, head, lockKey) {
        const nodes = new Map();
        const addrs = new Array();
        let objectCtr = 0;
        for (const change of changes) {
            objectCtr = Math.max(change.id, objectCtr);
            const addr = change.id >> BUCKET_WIDTH;
            const slot = change.id & BUCKET_MASK;
            let node = nodes.get(addr);
            if (!node) {
                node = await this.getIndexNodeForObjectId(change.id, head);
                nodes.set(addr, node);
                addrs.push(addr);
            }
            node.content[slot] = change.index;
        }
        addrs.sort((a, b) => b - a);
        const changedNodes = addrs.map(a => nodes.get(a));
        const bulk = new Array();
        let ctr = await this.feed.length();
        while (changedNodes.length > 0) {
            const node = changedNodes[0];
            node.index = ctr++;
            bulk.push(this.encodeIndexNode(node));
            changedNodes.splice(0, 1);
            if (node.id > 0) {
                const path = this.calcNodePath(node.id);
                const parentId = node.id >> BUCKET_WIDTH;
                const slot = path[path.length - 1];
                let parent;
                if (nodes.has(parentId)) {
                    parent = nodes.get(parentId);
                }
                else {
                    parent = await this.getIndexNodeByPath(path.slice(0, path.length - 1), head);
                    if (!parent) {
                        throw new Error('parent node must not be null');
                    }
                    nodes.set(parent.id, parent);
                    changedNodes.push(parent);
                    changedNodes.sort((a, b) => b.id - a.id);
                }
                parent.children[slot] = node.index;
            }
        }
        bulk.push(this.createTransactionMarker(lastTransaction.sequenceNr + 1, objectCtr + 1));
        await this.feed.append(bulk, { lockKey });
    }
    createTransactionMarker(sequenceNr, objectCtr) {
        const marker = {
            sequenceNr,
            objectCtr,
            timestamp: Date.now()
        };
        return this.encodeTransactionBlock(marker);
    }
    encodeIndexNode(indexNode) {
        return messages_1.default.Block.encode({ indexNode });
    }
    encodeDataBlock(dataBlock) {
        return messages_1.default.Block.encode({ dataBlock });
    }
    encodeTransactionBlock(marker) {
        return messages_1.default.Block.encode({ marker });
    }
    calcNodePath(addr) {
        const path = new Array();
        while (addr > 0) {
            path.push(addr & BUCKET_MASK);
            addr = addr >> BUCKET_WIDTH;
        }
        path.reverse();
        // due to the way the path is encoded, the root node has only 7 children and their ids start with 1 => slot offset of 1
        path[0] -= 1;
        return path;
    }
}
exports.default = BlockStorage;
//# sourceMappingURL=BlockStorage.js.map