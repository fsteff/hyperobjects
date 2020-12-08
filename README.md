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
    /**
     * Creates a new Object
     * @param value (optional) object value
     * @param immediate {boolean} (default: false) if the changes should be written to the feed 
     *                  cannot be undone, is persisted even if the transaction fails!
     * @returns {Promise<{id: number|null}>} id is set AFTER the transaction is over!
     */
    objId = tr.create('hello world', false) 
})

await db.transaction(async tr => {
    /**
     * Fetches the value of an object
     * @param key {number} object ID
     * @param immediate {boolean} (default: false) if the changes should be written to the feed 
     *                  cannot be undone, is persisted even if the transaction fails!
     * @returns {Promise<any>} the object
     */
    const greeting = await tr.get(objId.id, false)
    console.log(greeting)
})

await db.transaction(async tr => {
    /**
     * Overwrites the value of an existing object
     * @param key {number} object ID
     * @param value {any} object value
     * @param immediate {boolean} (default: false) if the changes should be written to the feed 
     *                  cannot be undone, is persisted even if the transaction fails!
     * @returns {Promise<void>}
     */
    await tr.set(objId.id, 'something else')
})

await db.transaction(async tr => {
    /**
     * Deletes an object's value (practically it's set to null)
     * @param key {number} object ID
     * @returns {Promise<void>}
     */
    await tr.delete(objId.id)

    /**
     * Undos the transaction (changes are not persisted)
     * Theoretically it is possible to make changes after this again, the previous ones are simply removed from the queue
     */
    tr.rollback()
})
```
