"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CollisionError = exports.InternalError = exports.ObjectNotFoundError = exports.InvalidTypeError = exports.DecodingError = void 0;
class DecodingError extends Error {
    constructor(msg) {
        super(msg);
    }
}
exports.DecodingError = DecodingError;
class InvalidTypeError extends Error {
    constructor(msg) {
        super(msg);
    }
}
exports.InvalidTypeError = InvalidTypeError;
class ObjectNotFoundError extends Error {
    constructor(objectId, msg) {
        super(msg);
        this.objectId = objectId;
    }
}
exports.ObjectNotFoundError = ObjectNotFoundError;
class InternalError extends Error {
    constructor(msg) {
        super(msg);
    }
}
exports.InternalError = InternalError;
class CollisionError extends Error {
    constructor(collisions, msg) {
        super(msg);
        this.collisions = collisions;
    }
}
exports.CollisionError = CollisionError;
//# sourceMappingURL=Errors.js.map