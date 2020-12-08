import tape from 'tape'
import RAM from 'random-access-memory'
import hypercore from 'hypercore'
import { HyperObjects } from '..'

tape('basic', async t => {
    const core = hypercore(RAM)
    const db = new HyperObjects(core, { valueEncoding: 'utf-8' })
    const objs = new Array<{id?: number}>()
    await db.transaction(async tr => {
        for(let i = 0; i < 1000; i++) {
            objs.push(await tr.create('' + i))
        }
    })

    await db.transaction(async tr => {
        for(let i = 0; i < 1000; i++) {
            const obj = await tr.get(<number>objs[i].id)
            t.same(obj, '' + i)
        }
    })
})

tape('concurrent', async t => {
    const core = hypercore(RAM)
    const db = new HyperObjects(core, { valueEncoding: 'utf-8' })
    const objs = new Array<{defId: {id?: number}, value: string}>()
    await db.transaction(async tr => {
        for(let i = 0; i < 10; i++) {
            const value = '' + i
            objs.push({defId: await tr.create(value), value})
        }
    })

    const p1 = db.transaction(async tr => {
        const value = 'c1'
        objs.push({defId: await tr.create(value, true), value})
        await tr.set(0, '#0')
        objs[0].value = '#0'
    })

    await db.transaction(async tr => {
        const value = 'c2'
        objs.push({defId: await tr.create(value, true), value})
        await tr.set(1, '#1')
        objs[1].value = '#1'
        await p1
    })

    await db.transaction(async tr => {
        for(const obj of objs) {
            t.same(await tr.get(<number>obj.defId.id), obj.value)
        }
    })
})

tape('collision', async t => {
    const core = hypercore(RAM)
    const db = new HyperObjects(core, { valueEncoding: 'utf-8' })
    let objId
    await db.transaction(async tr => {
        objId = await tr.create()
    })

    const p1 = db.transaction(async tr => {
        tr.create('sth', true)
        await tr.set(objId.id, 'test1')
    })

    await db.transaction(async tr => {
        tr.create('anything', true)
        await tr.set(objId.id, 'test2')
        await p1
    })
    .then(() => t.fail('expected an error'))
    .catch(err => {
        t.ok(err)
    })
})