// This file is auto generated by the protocol-buffers compiler

/* eslint-disable quotes */
/* eslint-disable indent */
/* eslint-disable no-redeclare */
/* eslint-disable camelcase */

// Remember to `npm install --save protocol-buffers-encodings`
var encodings = require('protocol-buffers-encodings')
var varint = encodings.varint
var skip = encodings.skip

var IndexNode = exports.IndexNode = {
  buffer: true,
  encodingLength: null,
  encode: null,
  decode: null
}

var Block = exports.Block = {
  buffer: true,
  encodingLength: null,
  encode: null,
  decode: null
}

var TransactionMarker = exports.TransactionMarker = {
  buffer: true,
  encodingLength: null,
  encode: null,
  decode: null
}

var HypercoreHeader = exports.HypercoreHeader = {
  buffer: true,
  encodingLength: null,
  encode: null,
  decode: null
}

defineIndexNode()
defineBlock()
defineTransactionMarker()
defineHypercoreHeader()

function defineIndexNode () {
  IndexNode.encodingLength = encodingLength
  IndexNode.encode = encode
  IndexNode.decode = decode

  function encodingLength (obj) {
    var length = 0
    if (!defined(obj.id)) throw new Error("id is required")
    var len = encodings.varint.encodingLength(obj.id)
    length += 1 + len
    if (defined(obj.children)) {
      for (var i = 0; i < obj.children.length; i++) {
        if (!defined(obj.children[i])) continue
        var len = encodings.varint.encodingLength(obj.children[i])
        length += 1 + len
      }
    }
    if (defined(obj.content)) {
      for (var i = 0; i < obj.content.length; i++) {
        if (!defined(obj.content[i])) continue
        var len = encodings.varint.encodingLength(obj.content[i])
        length += 1 + len
      }
    }
    return length
  }

  function encode (obj, buf, offset) {
    if (!offset) offset = 0
    if (!buf) buf = Buffer.allocUnsafe(encodingLength(obj))
    var oldOffset = offset
    if (!defined(obj.id)) throw new Error("id is required")
    buf[offset++] = 8
    encodings.varint.encode(obj.id, buf, offset)
    offset += encodings.varint.encode.bytes
    if (defined(obj.children)) {
      for (var i = 0; i < obj.children.length; i++) {
        if (!defined(obj.children[i])) continue
        buf[offset++] = 16
        encodings.varint.encode(obj.children[i], buf, offset)
        offset += encodings.varint.encode.bytes
      }
    }
    if (defined(obj.content)) {
      for (var i = 0; i < obj.content.length; i++) {
        if (!defined(obj.content[i])) continue
        buf[offset++] = 24
        encodings.varint.encode(obj.content[i], buf, offset)
        offset += encodings.varint.encode.bytes
      }
    }
    encode.bytes = offset - oldOffset
    return buf
  }

  function decode (buf, offset, end) {
    if (!offset) offset = 0
    if (!end) end = buf.length
    if (!(end <= buf.length && offset <= buf.length)) throw new Error("Decoded message is not valid")
    var oldOffset = offset
    var obj = {
      id: 0,
      children: [],
      content: []
    }
    var found0 = false
    while (true) {
      if (end <= offset) {
        if (!found0) throw new Error("Decoded message is not valid")
        decode.bytes = offset - oldOffset
        return obj
      }
      var prefix = varint.decode(buf, offset)
      offset += varint.decode.bytes
      var tag = prefix >> 3
      switch (tag) {
        case 1:
        obj.id = encodings.varint.decode(buf, offset)
        offset += encodings.varint.decode.bytes
        found0 = true
        break
        case 2:
        obj.children.push(encodings.varint.decode(buf, offset))
        offset += encodings.varint.decode.bytes
        break
        case 3:
        obj.content.push(encodings.varint.decode(buf, offset))
        offset += encodings.varint.decode.bytes
        break
        default:
        offset = skip(prefix & 7, buf, offset)
      }
    }
  }
}

function defineBlock () {
  Block.encodingLength = encodingLength
  Block.encode = encode
  Block.decode = decode

  function encodingLength (obj) {
    var length = 0
    if ((+defined(obj.marker) + +defined(obj.indexNode) + +defined(obj.dataBlock)) > 1) throw new Error("only one of the properties defined in oneof content can be set")
    if (defined(obj.marker)) {
      var len = TransactionMarker.encodingLength(obj.marker)
      length += varint.encodingLength(len)
      length += 1 + len
    }
    if (defined(obj.indexNode)) {
      var len = IndexNode.encodingLength(obj.indexNode)
      length += varint.encodingLength(len)
      length += 1 + len
    }
    if (defined(obj.dataBlock)) {
      var len = encodings.bytes.encodingLength(obj.dataBlock)
      length += 1 + len
    }
    return length
  }

  function encode (obj, buf, offset) {
    if (!offset) offset = 0
    if (!buf) buf = Buffer.allocUnsafe(encodingLength(obj))
    var oldOffset = offset
    if ((+defined(obj.marker) + +defined(obj.indexNode) + +defined(obj.dataBlock)) > 1) throw new Error("only one of the properties defined in oneof content can be set")
    if (defined(obj.marker)) {
      buf[offset++] = 10
      varint.encode(TransactionMarker.encodingLength(obj.marker), buf, offset)
      offset += varint.encode.bytes
      TransactionMarker.encode(obj.marker, buf, offset)
      offset += TransactionMarker.encode.bytes
    }
    if (defined(obj.indexNode)) {
      buf[offset++] = 18
      varint.encode(IndexNode.encodingLength(obj.indexNode), buf, offset)
      offset += varint.encode.bytes
      IndexNode.encode(obj.indexNode, buf, offset)
      offset += IndexNode.encode.bytes
    }
    if (defined(obj.dataBlock)) {
      buf[offset++] = 26
      encodings.bytes.encode(obj.dataBlock, buf, offset)
      offset += encodings.bytes.encode.bytes
    }
    encode.bytes = offset - oldOffset
    return buf
  }

  function decode (buf, offset, end) {
    if (!offset) offset = 0
    if (!end) end = buf.length
    if (!(end <= buf.length && offset <= buf.length)) throw new Error("Decoded message is not valid")
    var oldOffset = offset
    var obj = {
      marker: null,
      indexNode: null,
      dataBlock: null
    }
    while (true) {
      if (end <= offset) {
        decode.bytes = offset - oldOffset
        return obj
      }
      var prefix = varint.decode(buf, offset)
      offset += varint.decode.bytes
      var tag = prefix >> 3
      switch (tag) {
        case 1:
        delete obj.indexNode
        delete obj.dataBlock
        var len = varint.decode(buf, offset)
        offset += varint.decode.bytes
        obj.marker = TransactionMarker.decode(buf, offset, offset + len)
        offset += TransactionMarker.decode.bytes
        break
        case 2:
        delete obj.marker
        delete obj.dataBlock
        var len = varint.decode(buf, offset)
        offset += varint.decode.bytes
        obj.indexNode = IndexNode.decode(buf, offset, offset + len)
        offset += IndexNode.decode.bytes
        break
        case 3:
        delete obj.marker
        delete obj.indexNode
        obj.dataBlock = encodings.bytes.decode(buf, offset)
        offset += encodings.bytes.decode.bytes
        break
        default:
        offset = skip(prefix & 7, buf, offset)
      }
    }
  }
}

function defineTransactionMarker () {
  TransactionMarker.encodingLength = encodingLength
  TransactionMarker.encode = encode
  TransactionMarker.decode = decode

  function encodingLength (obj) {
    var length = 0
    if (!defined(obj.sequenceNr)) throw new Error("sequenceNr is required")
    var len = encodings.varint.encodingLength(obj.sequenceNr)
    length += 1 + len
    if (defined(obj.timestamp)) {
      var len = encodings.varint.encodingLength(obj.timestamp)
      length += 1 + len
    }
    return length
  }

  function encode (obj, buf, offset) {
    if (!offset) offset = 0
    if (!buf) buf = Buffer.allocUnsafe(encodingLength(obj))
    var oldOffset = offset
    if (!defined(obj.sequenceNr)) throw new Error("sequenceNr is required")
    buf[offset++] = 8
    encodings.varint.encode(obj.sequenceNr, buf, offset)
    offset += encodings.varint.encode.bytes
    if (defined(obj.timestamp)) {
      buf[offset++] = 16
      encodings.varint.encode(obj.timestamp, buf, offset)
      offset += encodings.varint.encode.bytes
    }
    encode.bytes = offset - oldOffset
    return buf
  }

  function decode (buf, offset, end) {
    if (!offset) offset = 0
    if (!end) end = buf.length
    if (!(end <= buf.length && offset <= buf.length)) throw new Error("Decoded message is not valid")
    var oldOffset = offset
    var obj = {
      sequenceNr: 0,
      timestamp: 0
    }
    var found0 = false
    while (true) {
      if (end <= offset) {
        if (!found0) throw new Error("Decoded message is not valid")
        decode.bytes = offset - oldOffset
        return obj
      }
      var prefix = varint.decode(buf, offset)
      offset += varint.decode.bytes
      var tag = prefix >> 3
      switch (tag) {
        case 1:
        obj.sequenceNr = encodings.varint.decode(buf, offset)
        offset += encodings.varint.decode.bytes
        found0 = true
        break
        case 2:
        obj.timestamp = encodings.varint.decode(buf, offset)
        offset += encodings.varint.decode.bytes
        break
        default:
        offset = skip(prefix & 7, buf, offset)
      }
    }
  }
}

function defineHypercoreHeader () {
  HypercoreHeader.encodingLength = encodingLength
  HypercoreHeader.encode = encode
  HypercoreHeader.decode = decode

  function encodingLength (obj) {
    var length = 0
    if (!defined(obj.dataStructureType)) throw new Error("dataStructureType is required")
    var len = encodings.string.encodingLength(obj.dataStructureType)
    length += 1 + len
    if (defined(obj.extension)) {
      var len = encodings.bytes.encodingLength(obj.extension)
      length += 1 + len
    }
    return length
  }

  function encode (obj, buf, offset) {
    if (!offset) offset = 0
    if (!buf) buf = Buffer.allocUnsafe(encodingLength(obj))
    var oldOffset = offset
    if (!defined(obj.dataStructureType)) throw new Error("dataStructureType is required")
    buf[offset++] = 10
    encodings.string.encode(obj.dataStructureType, buf, offset)
    offset += encodings.string.encode.bytes
    if (defined(obj.extension)) {
      buf[offset++] = 18
      encodings.bytes.encode(obj.extension, buf, offset)
      offset += encodings.bytes.encode.bytes
    }
    encode.bytes = offset - oldOffset
    return buf
  }

  function decode (buf, offset, end) {
    if (!offset) offset = 0
    if (!end) end = buf.length
    if (!(end <= buf.length && offset <= buf.length)) throw new Error("Decoded message is not valid")
    var oldOffset = offset
    var obj = {
      dataStructureType: "",
      extension: null
    }
    var found0 = false
    while (true) {
      if (end <= offset) {
        if (!found0) throw new Error("Decoded message is not valid")
        decode.bytes = offset - oldOffset
        return obj
      }
      var prefix = varint.decode(buf, offset)
      offset += varint.decode.bytes
      var tag = prefix >> 3
      switch (tag) {
        case 1:
        obj.dataStructureType = encodings.string.decode(buf, offset)
        offset += encodings.string.decode.bytes
        found0 = true
        break
        case 2:
        obj.extension = encodings.bytes.decode(buf, offset)
        offset += encodings.bytes.decode.bytes
        break
        default:
        offset = skip(prefix & 7, buf, offset)
      }
    }
  }
}

function defined (val) {
  return val !== null && val !== undefined && (typeof val !== 'number' || !isNaN(val))
}
