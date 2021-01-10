"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AsyncFeed = exports.Transaction = exports.HyperObjects = void 0;
const AsyncFeed_1 = require("./lib/AsyncFeed");
Object.defineProperty(exports, "AsyncFeed", { enumerable: true, get: function () { return AsyncFeed_1.AsyncFeed; } });
const BlockStorage_1 = __importDefault(require("./lib/BlockStorage"));
const Transaction_1 = __importDefault(require("./lib/Transaction"));
exports.Transaction = Transaction_1.default;
class HyperObjects {
    constructor(feed, opts) {
        opts = opts || {};
        this.feed = new AsyncFeed_1.AsyncFeed(feed);
        this.storage = new BlockStorage_1.default(this.feed, opts.onWrite, opts.onRead);
        this.valueEncoding = opts.valueEncoding || 'binary';
    }
    async transaction(executor, mergeHandler) {
        await this.storage.ready();
        const head = await this.feed.length();
        const tr = new Transaction_1.default(this.storage, head, { valueEncoding: this.valueEncoding, mergeHandler: mergeHandler });
        await tr.ready();
        const retval = await executor(tr);
        await tr.commit();
        return retval;
    }
}
exports.HyperObjects = HyperObjects;
//# sourceMappingURL=index.js.map