import { Collision } from "./MergeHandler"

export class DecodingError extends Error {
    constructor(msg: string) {
        super(msg)
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
    readonly collisions: Array<Collision>

    constructor(collisions: Array<Collision>, msg: string) {
        super(msg)
        this.collisions = collisions
    }
}