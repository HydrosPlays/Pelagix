/**
 * Lossless PNG re-encoding with Node's zlib only: the screenshots Chromium hands over are
 * compressed for speed, not size. Pixels are untouched; a fully opaque alpha channel is dropped.
 * Handles what Chromium writes (8-bit RGB or RGBA, not interlaced) and returns anything else as is.
 */

import { deflateSync, inflateSync } from 'node:zlib'

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(...buffers) {
  let c = 0xffffffff
  for (const buf of buffers) for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const head = Buffer.alloc(8)
  head.writeUInt32BE(data.length, 0)
  head.write(type, 4, 'latin1')
  const tail = Buffer.alloc(4)
  tail.writeUInt32BE(crc32(head.subarray(4), data), 0)
  return Buffer.concat([head, data, tail])
}

const paeth = (a, b, c) => {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
}

/** Reads the header and the raw (unfiltered) pixels of a PNG; null when it is not a format handled here. */
export function decodePng(png) {
  if (png.length < 33 || !png.subarray(0, 8).equals(SIGNATURE)) return null
  let offset = 8
  let header = null
  const idat = []
  while (offset + 8 <= png.length) {
    const length = png.readUInt32BE(offset)
    const type = png.toString('latin1', offset + 4, offset + 8)
    const data = png.subarray(offset + 8, offset + 8 + length)
    if (type === 'IHDR') header = { width: data.readUInt32BE(0), height: data.readUInt32BE(4), depth: data[8], colorType: data[9], interlace: data[12] }
    else if (type === 'IDAT') idat.push(data)
    else if (type === 'IEND') break
    offset += 12 + length
  }
  if (!header || header.depth !== 8 || header.interlace !== 0 || (header.colorType !== 2 && header.colorType !== 6)) return null

  const { width, height } = header
  const bpp = header.colorType === 6 ? 4 : 3
  const stride = width * bpp
  const filtered = inflateSync(Buffer.concat(idat))
  const pixels = Buffer.alloc(stride * height)
  for (let y = 0; y < height; y++) {
    const filter = filtered[y * (stride + 1)]
    const src = y * (stride + 1) + 1
    const dst = y * stride
    for (let x = 0; x < stride; x++) {
      const left = x >= bpp ? pixels[dst + x - bpp] : 0
      const up = y > 0 ? pixels[dst + x - stride] : 0
      const upLeft = x >= bpp && y > 0 ? pixels[dst + x - stride - bpp] : 0
      const predictor = filter === 0 ? 0 : filter === 1 ? left : filter === 2 ? up : filter === 3 ? (left + up) >> 1 : paeth(left, up, upLeft)
      pixels[dst + x] = (filtered[src + x] + predictor) & 0xff
    }
  }
  return { width, height, channels: bpp, pixels }
}

/** Encodes raw 8-bit RGB / RGBA pixels, choosing the filter of each row by the usual minimum-sum heuristic. */
export function encodePng({ width, height, channels, pixels }) {
  const bpp = channels
  const stride = width * bpp
  const out = Buffer.alloc((stride + 1) * height)
  const candidates = [0, 1, 2, 3, 4].map(() => Buffer.alloc(stride))
  for (let y = 0; y < height; y++) {
    const row = y * stride
    let best = 0
    let bestSum = Infinity
    for (let filter = 0; filter < 5; filter++) {
      const line = candidates[filter]
      let sum = 0
      for (let x = 0; x < stride; x++) {
        const value = pixels[row + x]
        const left = x >= bpp ? pixels[row + x - bpp] : 0
        const up = y > 0 ? pixels[row + x - stride] : 0
        const upLeft = x >= bpp && y > 0 ? pixels[row + x - stride - bpp] : 0
        const predictor = filter === 0 ? 0 : filter === 1 ? left : filter === 2 ? up : filter === 3 ? (left + up) >> 1 : paeth(left, up, upLeft)
        const v = (value - predictor) & 0xff
        line[x] = v
        sum += v < 128 ? v : 256 - v
        if (sum >= bestSum) break
      }
      if (sum < bestSum) {
        bestSum = sum
        best = filter
      }
    }
    // Only a candidate that ran to the end of the row can win, so its buffer is complete.
    out[y * (stride + 1)] = best
    candidates[best].copy(out, y * (stride + 1) + 1)
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = channels === 4 ? 6 : 2
  return Buffer.concat([SIGNATURE, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(out, { level: 9, memLevel: 9 })), chunk('IEND', Buffer.alloc(0))])
}

/** The same picture in fewer bytes. Returns the input when it cannot be read or would not get smaller. */
export function optimizePng(png) {
  const image = decodePng(png)
  if (!image) return png
  let { channels, pixels } = image
  if (channels === 4) {
    let opaque = true
    for (let i = 3; i < pixels.length; i += 4) {
      if (pixels[i] !== 255) {
        opaque = false
        break
      }
    }
    if (opaque) {
      const rgb = Buffer.alloc((pixels.length / 4) * 3)
      for (let i = 0, j = 0; i < pixels.length; i += 4, j += 3) {
        rgb[j] = pixels[i]
        rgb[j + 1] = pixels[i + 1]
        rgb[j + 2] = pixels[i + 2]
      }
      pixels = rgb
      channels = 3
    }
  }
  const smaller = encodePng({ width: image.width, height: image.height, channels, pixels })
  return smaller.length < png.length ? smaller : png
}

/** Width and height of a PNG, from its header. */
export function pngSize(png) {
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) }
}
