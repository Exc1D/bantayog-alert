interface BlockSpec {
  count: number
  totalCodewords: number
  dataCodewords: number
}

type Matrix = boolean[][]

const LOW_ERROR_CORRECTION_BLOCKS: readonly (readonly BlockSpec[] | null)[] = [
  null,
  [{ count: 1, totalCodewords: 26, dataCodewords: 19 }],
  [{ count: 1, totalCodewords: 44, dataCodewords: 34 }],
  [{ count: 1, totalCodewords: 70, dataCodewords: 55 }],
  [{ count: 1, totalCodewords: 100, dataCodewords: 80 }],
  [{ count: 1, totalCodewords: 134, dataCodewords: 108 }],
  [{ count: 2, totalCodewords: 86, dataCodewords: 68 }],
  [{ count: 2, totalCodewords: 98, dataCodewords: 78 }],
  [{ count: 2, totalCodewords: 121, dataCodewords: 97 }],
  [{ count: 2, totalCodewords: 146, dataCodewords: 116 }],
  [
    { count: 2, totalCodewords: 86, dataCodewords: 68 },
    { count: 2, totalCodewords: 87, dataCodewords: 69 },
  ],
]

const ALIGNMENT_PATTERN_POSITIONS: readonly (readonly number[])[] = [
  [],
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
]

function getItem<T>(items: readonly T[], index: number, label: string): T {
  const item = items[index]
  if (item === undefined) {
    throw new Error(`Missing ${label} at index ${String(index)}.`)
  }
  return item
}

function getMatrixCell(matrix: Matrix, x: number, y: number): boolean {
  return getItem(getItem(matrix, y, 'QR row'), x, 'QR module')
}

function setMatrixCell(matrix: Matrix, x: number, y: number, value: boolean) {
  const row = getItem(matrix, y, 'QR row')
  row[x] = value
}

function appendBits(target: boolean[], value: number, length: number) {
  for (let bit = length - 1; bit >= 0; bit -= 1) {
    target.push(((value >>> bit) & 1) !== 0)
  }
}

function multiplyInGaloisField(left: number, right: number) {
  let x = left
  let y = right
  let result = 0

  for (let bit = 0; bit < 8; bit += 1) {
    if ((y & 1) !== 0) result ^= x
    const carry = (x & 0x80) !== 0
    x = (x << 1) & 0xff
    if (carry) x ^= 0x1d
    y >>>= 1
  }

  return result
}

function createReedSolomonDivisor(degree: number) {
  const divisor = Array<number>(degree).fill(0)
  divisor[degree - 1] = 1
  let root = 1

  for (let index = 0; index < degree; index += 1) {
    for (let coefficient = 0; coefficient < divisor.length; coefficient += 1) {
      const current = getItem(divisor, coefficient, 'Reed-Solomon coefficient')
      const next =
        coefficient + 1 < divisor.length
          ? getItem(divisor, coefficient + 1, 'Reed-Solomon coefficient')
          : 0
      divisor[coefficient] = multiplyInGaloisField(current, root) ^ next
    }
    root = multiplyInGaloisField(root, 0x02)
  }

  return divisor
}

function createReedSolomonRemainder(data: number[], divisor: number[]) {
  const remainder = Array<number>(divisor.length).fill(0)

  for (const byte of data) {
    const factor = byte ^ getItem(remainder, 0, 'Reed-Solomon remainder')
    remainder.shift()
    remainder.push(0)
    for (let index = 0; index < remainder.length; index += 1) {
      const current = getItem(remainder, index, 'Reed-Solomon remainder')
      const coefficient = getItem(divisor, index, 'Reed-Solomon divisor')
      remainder[index] = current ^ multiplyInGaloisField(coefficient, factor)
    }
  }

  return remainder
}

function expandBlockSpecs(version: number) {
  const specs = getItem(LOW_ERROR_CORRECTION_BLOCKS, version, 'QR block specification')
  if (!specs) {
    throw new Error(`Unsupported QR code version: ${String(version)}`)
  }

  return specs.flatMap((spec) => Array.from({ length: spec.count }, () => spec))
}

function getDataCapacity(version: number) {
  return expandBlockSpecs(version).reduce((sum, block) => sum + block.dataCodewords, 0)
}

function chooseVersion(byteLength: number) {
  for (let version = 1; version <= 10; version += 1) {
    const characterCountBits = version <= 9 ? 8 : 16
    const requiredBits = 4 + characterCountBits + byteLength * 8
    if (requiredBits <= getDataCapacity(version) * 8) return version
  }

  throw new Error('Authenticator setup data is too long to encode as a QR code.')
}

function createDataCodewords(value: string, version: number) {
  const bytes = Array.from(new TextEncoder().encode(value))
  const capacityBits = getDataCapacity(version) * 8
  const bits: boolean[] = []

  appendBits(bits, 0b0100, 4)
  appendBits(bits, bytes.length, version <= 9 ? 8 : 16)
  for (const byte of bytes) appendBits(bits, byte, 8)

  appendBits(bits, 0, Math.min(4, capacityBits - bits.length))
  while (bits.length % 8 !== 0) bits.push(false)

  const result: number[] = []
  for (let index = 0; index < bits.length; index += 8) {
    let byte = 0
    for (let bit = 0; bit < 8; bit += 1) {
      byte = (byte << 1) | (getItem(bits, index + bit, 'QR data bit') ? 1 : 0)
    }
    result.push(byte)
  }

  const padding = [0xec, 0x11] as const
  let paddingIndex = 0
  while (result.length < getDataCapacity(version)) {
    result.push(getItem(padding, paddingIndex % padding.length, 'QR padding byte'))
    paddingIndex += 1
  }

  return result
}

function addErrorCorrection(dataCodewords: number[], version: number) {
  const specs = expandBlockSpecs(version)
  const blocks: number[][] = []
  const errorCorrectionBlocks: number[][] = []
  let offset = 0

  for (const spec of specs) {
    const block = dataCodewords.slice(offset, offset + spec.dataCodewords)
    offset += spec.dataCodewords
    const degree = spec.totalCodewords - spec.dataCodewords
    blocks.push(block)
    errorCorrectionBlocks.push(createReedSolomonRemainder(block, createReedSolomonDivisor(degree)))
  }

  const result: number[] = []
  const longestDataBlock = Math.max(...blocks.map((block) => block.length))
  const longestErrorBlock = Math.max(...errorCorrectionBlocks.map((block) => block.length))

  for (let index = 0; index < longestDataBlock; index += 1) {
    for (const block of blocks) {
      if (index < block.length) result.push(getItem(block, index, 'QR data codeword'))
    }
  }

  for (let index = 0; index < longestErrorBlock; index += 1) {
    for (const block of errorCorrectionBlocks) {
      if (index < block.length) {
        result.push(getItem(block, index, 'QR error-correction codeword'))
      }
    }
  }

  return result
}

function calculateFormatBits(mask: number) {
  const data = (0b01 << 3) | mask
  let remainder = data
  for (let index = 0; index < 10; index += 1) {
    remainder = (remainder << 1) ^ (((remainder >>> 9) & 1) * 0x537)
  }
  return ((data << 10) | remainder) ^ 0x5412
}

function calculateVersionBits(version: number) {
  let remainder = version
  for (let index = 0; index < 12; index += 1) {
    remainder = (remainder << 1) ^ (((remainder >>> 11) & 1) * 0x1f25)
  }
  return (version << 12) | remainder
}

function shouldInvert(mask: number, x: number, y: number) {
  switch (mask) {
    case 0:
      return (x + y) % 2 === 0
    case 1:
      return y % 2 === 0
    case 2:
      return x % 3 === 0
    case 3:
      return (x + y) % 3 === 0
    case 4:
      return (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0
    case 5:
      return ((x * y) % 2) + ((x * y) % 3) === 0
    case 6:
      return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0
    case 7:
      return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0
    default:
      throw new Error(`Invalid QR code mask: ${String(mask)}`)
  }
}

// fallow-ignore-next-line complexity -- QR matrix placement mirrors the specification and is covered by enrollment regression tests.
function buildMatrix(version: number, codewords: number[], mask: number) {
  const size = version * 4 + 17
  const modules = Array.from({ length: size }, () => Array<boolean>(size).fill(false))
  const isFunction = Array.from({ length: size }, () => Array<boolean>(size).fill(false))

  const setFunction = (x: number, y: number, dark: boolean) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return
    setMatrixCell(modules, x, y, dark)
    setMatrixCell(isFunction, x, y, true)
  }

  for (let index = 0; index < size; index += 1) {
    setFunction(6, index, index % 2 === 0)
    setFunction(index, 6, index % 2 === 0)
  }

  const drawFinderPattern = (centerX: number, centerY: number) => {
    for (let offsetY = -4; offsetY <= 4; offsetY += 1) {
      for (let offsetX = -4; offsetX <= 4; offsetX += 1) {
        const distance = Math.max(Math.abs(offsetX), Math.abs(offsetY))
        setFunction(centerX + offsetX, centerY + offsetY, distance !== 2 && distance !== 4)
      }
    }
  }

  drawFinderPattern(3, 3)
  drawFinderPattern(size - 4, 3)
  drawFinderPattern(3, size - 4)

  const alignmentPositions = getItem(ALIGNMENT_PATTERN_POSITIONS, version, 'QR alignment positions')
  for (const centerY of alignmentPositions) {
    for (const centerX of alignmentPositions) {
      if (getMatrixCell(isFunction, centerX, centerY)) continue
      for (let offsetY = -2; offsetY <= 2; offsetY += 1) {
        for (let offsetX = -2; offsetX <= 2; offsetX += 1) {
          const distance = Math.max(Math.abs(offsetX), Math.abs(offsetY))
          setFunction(centerX + offsetX, centerY + offsetY, distance !== 1)
        }
      }
    }
  }

  const formatBits = calculateFormatBits(mask)
  for (let index = 0; index <= 5; index += 1) {
    setFunction(8, index, ((formatBits >>> index) & 1) !== 0)
  }
  setFunction(8, 7, ((formatBits >>> 6) & 1) !== 0)
  setFunction(8, 8, ((formatBits >>> 7) & 1) !== 0)
  setFunction(7, 8, ((formatBits >>> 8) & 1) !== 0)
  for (let index = 9; index < 15; index += 1) {
    setFunction(14 - index, 8, ((formatBits >>> index) & 1) !== 0)
  }
  for (let index = 0; index < 8; index += 1) {
    setFunction(size - 1 - index, 8, ((formatBits >>> index) & 1) !== 0)
  }
  for (let index = 8; index < 15; index += 1) {
    setFunction(8, size - 15 + index, ((formatBits >>> index) & 1) !== 0)
  }
  setFunction(8, size - 8, true)

  if (version >= 7) {
    const versionBits = calculateVersionBits(version)
    for (let index = 0; index < 18; index += 1) {
      const dark = ((versionBits >>> index) & 1) !== 0
      const first = size - 11 + (index % 3)
      const second = Math.floor(index / 3)
      setFunction(first, second, dark)
      setFunction(second, first, dark)
    }
  }

  const dataBits = codewords.flatMap((codeword) =>
    Array.from({ length: 8 }, (_, index) => ((codeword >>> (7 - index)) & 1) !== 0),
  )
  let dataIndex = 0

  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5
    for (let vertical = 0; vertical < size; vertical += 1) {
      const upward = ((right + 1) & 2) === 0
      const y = upward ? size - 1 - vertical : vertical
      for (let column = 0; column < 2; column += 1) {
        const x = right - column
        if (getMatrixCell(isFunction, x, y)) continue
        let dark = dataIndex < dataBits.length ? getItem(dataBits, dataIndex, 'QR data bit') : false
        dataIndex += 1
        if (shouldInvert(mask, x, y)) dark = !dark
        setMatrixCell(modules, x, y, dark)
      }
    }
  }

  return modules
}

function countRunPenalty(line: readonly boolean[]) {
  if (line.length === 0) return 0

  let penalty = 0
  let runColor = getItem(line, 0, 'QR penalty module')
  let runLength = 1

  for (let index = 1; index < line.length; index += 1) {
    const value = getItem(line, index, 'QR penalty module')
    if (value === runColor) {
      runLength += 1
      if (runLength === 5) penalty += 3
      else if (runLength > 5) penalty += 1
    } else {
      runColor = value
      runLength = 1
    }
  }

  return penalty
}

function countFinderLikePatterns(line: readonly boolean[]) {
  const patterns: readonly (readonly boolean[])[] = [
    [false, false, false, false, true, false, true, true, true, false, true],
    [true, false, true, true, true, false, true, false, false, false, false],
  ]
  let penalty = 0

  for (let start = 0; start <= line.length - 11; start += 1) {
    for (const pattern of patterns) {
      if (
        pattern.every(
          (value, offset) => getItem(line, start + offset, 'QR penalty module') === value,
        )
      ) {
        penalty += 40
        break
      }
    }
  }

  return penalty
}

function scoreMatrix(matrix: Matrix) {
  const size = matrix.length
  let penalty = 0

  for (const row of matrix) {
    penalty += countRunPenalty(row)
    penalty += countFinderLikePatterns(row)
  }

  for (let x = 0; x < size; x += 1) {
    const column = matrix.map((row) => getItem(row, x, 'QR module'))
    penalty += countRunPenalty(column)
    penalty += countFinderLikePatterns(column)
  }

  for (let y = 0; y < size - 1; y += 1) {
    for (let x = 0; x < size - 1; x += 1) {
      const value = getMatrixCell(matrix, x, y)
      if (
        getMatrixCell(matrix, x + 1, y) === value &&
        getMatrixCell(matrix, x, y + 1) === value &&
        getMatrixCell(matrix, x + 1, y + 1) === value
      ) {
        penalty += 3
      }
    }
  }

  const darkModules = matrix.reduce(
    (count, row) => count + row.filter((module) => module).length,
    0,
  )
  const totalModules = size * size
  penalty += Math.floor(Math.abs(darkModules * 20 - totalModules * 10) / totalModules) * 10

  return penalty
}

export function createQrCodeMatrix(value: string) {
  const byteLength = new TextEncoder().encode(value).length
  const version = chooseVersion(byteLength)
  const dataCodewords = createDataCodewords(value, version)
  const codewords = addErrorCorrection(dataCodewords, version)

  let bestMatrix = buildMatrix(version, codewords, 0)
  let bestScore = scoreMatrix(bestMatrix)

  for (let mask = 1; mask < 8; mask += 1) {
    const candidate = buildMatrix(version, codewords, mask)
    const score = scoreMatrix(candidate)
    if (score < bestScore) {
      bestMatrix = candidate
      bestScore = score
    }
  }

  return bestMatrix
}
