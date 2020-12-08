# HyperObjects

Simple object store with transaction support, built on [hypercore](https://github.com/hypercore-protocol/hypercore).

## Features

- simple DB journal
- concurrent, atomic transactions
- the default merge handler merges transactions that change different objects
  - but a custom one can be passed to each transaction
  - throws an error and rolls back the transaction if a collision occures
- generates sequential object IDs to maximize efficiency
  - internally uses an octree to store object-ID > hypercore index mappings

## Usage

```javascript
const feed = somehowCreateHypercore()
const db = new HyperObjects(feed, {valueEncoding: 'utf-8'})
let objId
await db.transaction(async tr => {
    // objId.id is set AFTER the transaction is over!
    objId = tr.create('hello world') // optional parameter
})

await db.transaction(async tr => {
    console.log(await tr.get(objId.id))
})

await db.transaction(async tr => {
    await tr.set(objId.id, 'something else')
})
```
