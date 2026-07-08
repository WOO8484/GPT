/**
 * zip-reader.js
 *
 * 외부 CDN이나 서버 없이, 브라우저 안에서 표준 ZIP 파일을 읽기 위한 최소 구현체.
 * PKZIP 포맷의 중앙 디렉터리(End/Central Directory)와 로컬 파일 헤더를 직접 해석하고,
 * DEFLATE(RFC 1951) 압축 해제 알고리즘을 순수 JS로 구현한다.
 *
 * 지원 범위:
 * - 압축 방식: 0(저장, Stored), 8(Deflate)
 * - 여러 파일/폴더가 섞인 일반적인 ZIP 구조
 *
 * 지원하지 않는 범위(해당 항목은 항목 자체를 건너뛴다):
 * - 암호화된 ZIP
 * - ZIP64(초대형 ZIP)
 * - Deflate64, BZIP2, LZMA 등 그 외 압축 방식
 *
 * 출처/라이선스: 외부 라이브러리를 가져온 것이 아니라, 공개된 ZIP 포맷 규격과
 * DEFLATE(RFC 1951) 알고리즘 명세를 바탕으로 이번 작업에서 직접 작성한 코드다.
 */
const MiniZip = (() => {
  "use strict";

  // ---- DEFLATE(RFC 1951) 상수 ----
  const LENGTH_BASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
  const LENGTH_EXTRA = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
  const DIST_BASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
  const DIST_EXTRA = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
  const CL_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

  class BitReader {
    constructor(bytes, byteOffset) {
      this.bytes = bytes;
      this.pos = byteOffset;
      this.bitBuf = 0;
      this.bitCount = 0;
    }
    readBit() {
      if (this.bitCount === 0) {
        this.bitBuf = this.bytes[this.pos++];
        this.bitCount = 8;
      }
      const bit = this.bitBuf & 1;
      this.bitBuf >>= 1;
      this.bitCount--;
      return bit;
    }
    readBits(n) {
      let value = 0;
      for (let i = 0; i < n; i++) {
        value |= this.readBit() << i;
      }
      return value >>> 0;
    }
    alignToByte() {
      this.bitBuf = 0;
      this.bitCount = 0;
    }
  }

  function buildHuffman(codeLengths) {
    let maxBits = 0;
    for (const len of codeLengths) if (len > maxBits) maxBits = len;
    const blCount = new Array(maxBits + 1).fill(0);
    for (const len of codeLengths) if (len > 0) blCount[len]++;
    const nextCode = new Array(maxBits + 1).fill(0);
    let code = 0;
    for (let bits = 1; bits <= maxBits; bits++) {
      code = (code + blCount[bits - 1]) << 1;
      nextCode[bits] = code;
    }
    const map = new Map();
    for (let n = 0; n < codeLengths.length; n++) {
      const len = codeLengths[n];
      if (len > 0) {
        map.set(len + ":" + nextCode[len], n);
        nextCode[len]++;
      }
    }
    return { map, maxBits };
  }

  function decodeSymbol(reader, table) {
    let code = 0;
    for (let len = 1; len <= table.maxBits; len++) {
      code = (code << 1) | reader.readBit();
      const sym = table.map.get(len + ":" + code);
      if (sym !== undefined) return sym;
    }
    throw new Error("DEFLATE 허프만 코드 해석 실패");
  }

  function inflateRaw(input, startOffset, expectedSize) {
    let out = new Uint8Array(expectedSize > 0 ? expectedSize : Math.max(64, (input.length - startOffset) * 3));
    let outPos = 0;

    function ensureCapacity(extra) {
      if (outPos + extra <= out.length) return;
      let newLen = out.length * 2;
      while (newLen < outPos + extra) newLen *= 2;
      const grown = new Uint8Array(newLen);
      grown.set(out.subarray(0, outPos));
      out = grown;
    }

    const reader = new BitReader(input, startOffset);
    let bfinal = 0;
    do {
      bfinal = reader.readBit();
      const btype = reader.readBits(2);

      if (btype === 0) {
        reader.alignToByte();
        const len = input[reader.pos] | (input[reader.pos + 1] << 8);
        reader.pos += 4;
        ensureCapacity(len);
        out.set(input.subarray(reader.pos, reader.pos + len), outPos);
        outPos += len;
        reader.pos += len;
      } else if (btype === 1 || btype === 2) {
        let litTable, distTable;
        if (btype === 1) {
          const litLengths = new Array(288);
          for (let i = 0; i <= 143; i++) litLengths[i] = 8;
          for (let i = 144; i <= 255; i++) litLengths[i] = 9;
          for (let i = 256; i <= 279; i++) litLengths[i] = 7;
          for (let i = 280; i <= 287; i++) litLengths[i] = 8;
          const distLengths = new Array(30).fill(5);
          litTable = buildHuffman(litLengths);
          distTable = buildHuffman(distLengths);
        } else {
          const hlit = reader.readBits(5) + 257;
          const hdist = reader.readBits(5) + 1;
          const hclen = reader.readBits(4) + 4;
          const clLengths = new Array(19).fill(0);
          for (let i = 0; i < hclen; i++) clLengths[CL_ORDER[i]] = reader.readBits(3);
          const clTable = buildHuffman(clLengths);

          const lengths = [];
          while (lengths.length < hlit + hdist) {
            const sym = decodeSymbol(reader, clTable);
            if (sym <= 15) {
              lengths.push(sym);
            } else if (sym === 16) {
              const repeat = reader.readBits(2) + 3;
              const prev = lengths[lengths.length - 1];
              for (let r = 0; r < repeat; r++) lengths.push(prev);
            } else if (sym === 17) {
              const repeat = reader.readBits(3) + 3;
              for (let r = 0; r < repeat; r++) lengths.push(0);
            } else {
              const repeat = reader.readBits(7) + 11;
              for (let r = 0; r < repeat; r++) lengths.push(0);
            }
          }
          litTable = buildHuffman(lengths.slice(0, hlit));
          distTable = buildHuffman(lengths.slice(hlit, hlit + hdist));
        }

        for (;;) {
          const sym = decodeSymbol(reader, litTable);
          if (sym < 256) {
            ensureCapacity(1);
            out[outPos++] = sym;
          } else if (sym === 256) {
            break;
          } else {
            const lengthIndex = sym - 257;
            const length = LENGTH_BASE[lengthIndex] + reader.readBits(LENGTH_EXTRA[lengthIndex]);
            const distSym = decodeSymbol(reader, distTable);
            const distance = DIST_BASE[distSym] + reader.readBits(DIST_EXTRA[distSym]);
            ensureCapacity(length);
            let copyFrom = outPos - distance;
            for (let i = 0; i < length; i++) {
              out[outPos] = out[copyFrom];
              outPos++;
              copyFrom++;
            }
          }
        }
      } else {
        throw new Error("지원하지 않는 DEFLATE 블록 형식");
      }
    } while (bfinal === 0);

    return out.subarray(0, outPos);
  }

  // ---- ZIP 구조 파싱 ----

  function readUint32LE(bytes, offset) {
    return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
  }
  function readUint16LE(bytes, offset) {
    return bytes[offset] | (bytes[offset + 1] << 8);
  }

  function findEndOfCentralDirectory(bytes) {
    const EOCD_SIG = 0x06054b50;
    const minPos = Math.max(0, bytes.length - 22 - 65535);
    for (let i = bytes.length - 22; i >= minPos; i--) {
      if (readUint32LE(bytes, i) === EOCD_SIG) return i;
    }
    throw new Error("ZIP 종료 레코드(EOCD)를 찾을 수 없습니다");
  }

  async function load(arrayBuffer) {
    const bytes = new Uint8Array(arrayBuffer);
    const eocdOffset = findEndOfCentralDirectory(bytes);
    const totalEntries = readUint16LE(bytes, eocdOffset + 10);
    const centralDirOffset = readUint32LE(bytes, eocdOffset + 16);

    const CENTRAL_SIG = 0x02014b50;
    const LOCAL_SIG = 0x04034b50;

    const headers = [];
    let offset = centralDirOffset;
    for (let i = 0; i < totalEntries; i++) {
      if (readUint32LE(bytes, offset) !== CENTRAL_SIG) break;
      const compressionMethod = readUint16LE(bytes, offset + 10);
      const compressedSize = readUint32LE(bytes, offset + 20);
      const uncompressedSize = readUint32LE(bytes, offset + 24);
      const fileNameLength = readUint16LE(bytes, offset + 28);
      const extraFieldLength = readUint16LE(bytes, offset + 30);
      const fileCommentLength = readUint16LE(bytes, offset + 32);
      const localHeaderOffset = readUint32LE(bytes, offset + 42);
      const nameBytes = bytes.subarray(offset + 46, offset + 46 + fileNameLength);
      const name = new TextDecoder("utf-8").decode(nameBytes);

      headers.push({ name, compressionMethod, compressedSize, uncompressedSize, localHeaderOffset });
      offset += 46 + fileNameLength + extraFieldLength + fileCommentLength;
    }

    const results = [];
    for (const header of headers) {
      const isDirectory = header.name.endsWith("/");
      let dataBytes = new Uint8Array(0);

      if (!isDirectory && header.compressedSize > 0) {
        const lOffset = header.localHeaderOffset;
        if (readUint32LE(bytes, lOffset) !== LOCAL_SIG) {
          continue; // 손상된 항목은 건너뛴다
        }
        const localNameLength = readUint16LE(bytes, lOffset + 26);
        const localExtraLength = readUint16LE(bytes, lOffset + 28);
        const dataStart = lOffset + 30 + localNameLength + localExtraLength;

        if (header.compressionMethod === 0) {
          dataBytes = bytes.subarray(dataStart, dataStart + header.compressedSize);
        } else if (header.compressionMethod === 8) {
          try {
            dataBytes = inflateRaw(bytes, dataStart, header.uncompressedSize);
          } catch (error) {
            continue; // 압축 해제 실패 항목은 건너뛴다
          }
        } else {
          continue; // 지원하지 않는 압축 방식
        }
      }

      results.push({ name: header.name, isDirectory, dataBytes });
    }

    return results;
  }

  function bytesToBase64(bytes) {
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, chunk);
    }
    return btoa(binary);
  }

  function bytesToText(bytes) {
    return new TextDecoder("utf-8").decode(bytes);
  }

  return { load, bytesToBase64, bytesToText };
})();

if (typeof window !== "undefined") {
  window.MiniZip = MiniZip;
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = MiniZip;
}
