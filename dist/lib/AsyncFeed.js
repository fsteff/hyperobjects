"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AsyncFeed = void 0;
const messages_1 = __importDefault(require("../messages"));
const Errors_1 = require("./Errors");
class AsyncFeed {
    constructor(feed) {
        this.lock = null;
        const self = this;
        this.feed = feed;
        this.pending = [];
        this.readyPromise = ready().then(onReady);
        async function ready() {
            return new Promise((resolve, reject) => {
                feed.ready((err) => {
                    if (err)
                        reject(err);
                    else
                        resolve();
                });
            });
        }
        async function onReady() {
            if (await self.length() === 0 && self.feed.writable) {
                const encoded = messages_1.default.HypercoreHeader.encode({ dataStructureType: 'hyperobjects' });
                await new Promise((resolve, reject) => {
                    feed.append(encoded, err => {
                        if (err)
                            reject(err);
                        else
                            resolve();
                    });
                });
            }
        }
    }
    async update(minLength, timeout) {
        let done = false;
        return Promise.all([new Promise((resolve, reject) => {
                this.feed.update({ minLength, ifAvailable: true }, err => {
                    done = true;
                    if (err)
                        reject(err);
                    else
                        resolve(undefined);
                });
            }),
            new Promise((resolve, reject) => {
                if (timeout) {
                    setTimeout(() => done ? resolve(undefined) : reject(new Error('Timeout (' + timeout + 'ms)')), timeout);
                }
                else {
                    resolve(undefined);
                }
            })
        ]).catch(err => {
            throw new Error('failed to update feed ' + this.feed.key.toString('hex') + ' because of error: ' + err.message);
        });
    }
    async length() {
        while (this.pending.length > 0) {
            await Promise.all(this.pending);
        }
        if (this.pending.length > 0)
            throw new Errors_1.InternalError('pending should be zero!');
        return this.feed.length;
    }
    ready() {
        return this.readyPromise;
    }
    get(...args) {
        return this.promise(this.feed.get, ...args);
    }
    async append(block, opts) {
        while (this.lock && !(opts && opts.lockKey === this.lock))
            await this.lock;
        return this.promise(this.feed.append, block);
    }
    head(...args) {
        return this.promise(this.feed.head, ...args);
    }
    async criticalSection(critical) {
        const self = this;
        while (this.lock)
            await this.lock;
        let resolveFoo;
        this.lock = new Promise((resolve) => { resolveFoo = resolve; });
        await critical(this.lock);
        this.lock = null;
        resolveFoo();
    }
    async promise(foo, ...args) {
        const self = this;
        await this.readyPromise;
        const p = new Promise((resolve, reject) => {
            foo.call(self.feed, ...args, callback);
            function callback(err, result) {
                self.pending.splice(self.pending.indexOf(p), 1);
                if (err)
                    reject(err);
                else
                    resolve(result);
            }
        });
        self.pending.push(p);
        return p;
    }
}
exports.AsyncFeed = AsyncFeed;
//# sourceMappingURL=AsyncFeed.js.map