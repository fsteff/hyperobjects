import tape from 'tape'
import RAM from 'random-access-memory'
import hypercore from 'hypercore'
import { HyperObjects } from '..'

tape('basic', async t => {
    const core = hypercore(RAM)
    const db = new HyperObjects(core, { valueEncoding: 'utf-8' })
    const tr = await db.transaction()
    const objs = new Array<{id: Promise<number>}>()
    for(let i = 0; i < 100; i++) {
        objs.push(await tr.create('' + i))
    }
    await tr.commit()
    for(let i = 0; i < 100; i++) {
        const obj = await tr.get(await objs[i].id)
        t.same('' + i, obj)
    }
})