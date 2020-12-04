export type RWFunction = (index: number, data: Buffer) => Buffer
export type IndexNode = {id: number, children: Array<number>, content: Array<number>, index?: number}
export type TransactionMarker = { sequenceNr: number, objectCtr: number, timestamp?: number }
export type CBFunction = (cb: (err: Error, result?: any) => any) => any
export type CBFunctionP1 = (param1, cb: (err: Error, result?: any) => any) => any