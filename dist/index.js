"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Errors = exports.BlockStorage = exports.AsyncFeed = exports.Transaction = exports.HyperObjects = void 0;
const AsyncFeed_1 = require("./lib/AsyncFeed");
Object.defineProperty(exports, "AsyncFeed", { enumerable: true, get: function () { return AsyncFeed_1.AsyncFeed; } });
const BlockStorage_1 = __importDefault(require("./lib/BlockStorage"));
exports.BlockStorage = BlockStorage_1.default;
const Transaction_1 = __importDefault(require("./lib/Transaction"));
exports.Transaction = Transaction_1.default;
const Errors = __importStar(require("./lib/Errors"));
exports.Errors = Errors;
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