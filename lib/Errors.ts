import { Collision as HyperObjectsErrors } from "./MergeHandler"

export class DecodingError extends Error {
    readonly index: number

    constructor(index: number, msg: string) {
        super(msg)
        this.index = index
    }
}

export class InvalidTypeError extends Error {
    constructor(msg: string) {
        super(msg)
    }
}

export class ObjectNotFoundError extends Error {
    readonly objectId: number

    constructor(objectId: number, msg: string) {
        super(msg)
        this.objectId = objectId
    }
}

export class InternalError extends Error {
    constructor(msg: string) {
        super(msg)
    }
}

export class CollisionError extends Error {
    readonly collisions: Array<HyperObjectsErrors>

    constructor(collisions: Array<HyperObjectsErrors>, msg: string) {
        super(msg)
        this.collisions = collisions
    }
}