// Build GSM 03.38 AllLockingShift character set as a 128-element array.
// Positions 0x7A–0x7E are undefined in the base standard (filled by
// national-language Single-Shift tables); we leave them as empty slots so
// they correctly fail the GSM-7 check.  Position 0x7F is DELETE.
const GSM7_TABLE = (() => {
  const t = Array(128) as string[]
  const entries: [number, string][] = [
    [0x00, '@'],
    [0x01, '£'],
    [0x02, '$'],
    [0x03, '¥'],
    [0x04, 'è'],
    [0x05, 'é'],
    [0x06, 'ù'],
    [0x07, 'ì'],
    [0x08, 'ò'],
    [0x09, 'Ç'],
    [0x0a, '\n'],
    [0x0b, 'ø'],
    [0x0c, '\r'],
    [0x0d, 'Å'],
    [0x0e, 'å'],
    [0x0f, 'Δ'],
    [0x10, '_'],
    [0x11, 'Φ'],
    [0x12, 'Γ'],
    [0x13, 'Λ'],
    [0x14, 'Ω'],
    [0x15, 'Π'],
    [0x16, 'Ψ'],
    [0x17, 'Σ'],
    [0x18, 'Θ'],
    [0x19, 'Ξ'],
    [0x1a, '\x1B'],
    [0x1b, 'Æ'],
    [0x1c, 'æ'],
    [0x1d, 'ß'],
    [0x1e, 'É'],
    [0x1f, ' '],
    [0x20, '!'],
    [0x21, '"'],
    [0x22, '#'],
    [0x23, '¤'],
    [0x24, '%'],
    [0x25, '&'],
    [0x26, "'"],
    [0x27, '('],
    [0x28, ')'],
    [0x29, '*'],
    [0x2a, '+'],
    [0x2b, ','],
    [0x2c, '-'],
    [0x2d, '.'],
    [0x2e, '/'],
    [0x2f, '0'],
    [0x30, '1'],
    [0x31, '2'],
    [0x32, '3'],
    [0x33, '4'],
    [0x34, '5'],
    [0x35, '6'],
    [0x36, '7'],
    [0x37, '8'],
    [0x38, '9'],
    [0x39, ':'],
    [0x3a, ';'],
    [0x3b, '<'],
    [0x3c, '='],
    [0x3d, '>'],
    [0x3e, '?'],
    [0x3f, '¡'],
    [0x40, 'A'],
    [0x41, 'B'],
    [0x42, 'C'],
    [0x43, 'D'],
    [0x44, 'E'],
    [0x45, 'F'],
    [0x46, 'G'],
    [0x47, 'H'],
    [0x48, 'I'],
    [0x49, 'J'],
    [0x4a, 'K'],
    [0x4b, 'L'],
    [0x4c, 'M'],
    [0x4d, 'N'],
    [0x4e, 'O'],
    [0x4f, 'P'],
    [0x50, 'Q'],
    [0x51, 'R'],
    [0x52, 'S'],
    [0x53, 'T'],
    [0x54, 'U'],
    [0x55, 'V'],
    [0x56, 'W'],
    [0x57, 'X'],
    [0x58, 'Y'],
    [0x59, 'Z'],
    [0x5a, 'Ä'],
    [0x5b, 'ö'],
    [0x5c, 'Ñ'],
    [0x5d, 'Ü'],
    [0x5e, '§'],
    [0x5f, '¿'],
    [0x60, 'a'],
    [0x61, 'b'],
    [0x62, 'c'],
    [0x63, 'd'],
    [0x64, 'e'],
    [0x65, 'f'],
    [0x66, 'g'],
    [0x67, 'h'],
    [0x68, 'i'],
    [0x69, 'j'],
    [0x6a, 'k'],
    [0x6b, 'l'],
    [0x6c, 'm'],
    [0x6d, 'n'],
    [0x6e, 'o'],
    [0x6f, 'p'],
    [0x70, 'q'],
    [0x71, 'r'],
    [0x72, 's'],
    [0x73, 't'],
    [0x74, 'u'],
    [0x75, 'v'],
    [0x76, 'w'],
    [0x77, 'x'],
    [0x78, 'y'],
    [0x79, 'z'],
    [0x7f, '\x7F'],
  ]
  for (const [p, c] of entries) {
    t[p] = c
  }
  return t.join('')
})()

// Extension characters — each consumes 2 GSM-7 code units in the encoded form.
// The escape sentinel (0x1B) is already in GSM7_TABLE at position 0x1A.
const GSM7_EXTENSION = new Set('^{}\\[~]|€')

export type SmsEncoding = 'GSM-7' | 'UCS-2'

export interface EncodingResult {
  encoding: SmsEncoding
  segmentCount: number
}

/**
 * Detect whether a message body can be encoded using GSM-7 or requires UCS-2.
 *
 * GSM-7: each basic char = 1 code unit; each extension char = 2 code units.
 *   Single-segment limit: 160 code units.  Multi-segment: 153 per segment.
 * UCS-2: each char (including emoji) = 1 UTF-16 code unit.
 *   Single-segment limit: 70 chars.  Multi-segment: 67 per segment.
 */
export function detectEncoding(body: string): EncodingResult {
  let effectiveLength = 0

  for (const ch of body) {
    if (GSM7_TABLE.includes(ch)) {
      effectiveLength += 1
    } else if (GSM7_EXTENSION.has(ch)) {
      effectiveLength += 2
    } else {
      // Non-GSM-7 character — fall back to UCS-2
      // UCS-2 uses UTF-16 code units (same as .length on JS string)
      const utf16Len = body.length
      const segmentCount = utf16Len <= 70 ? 1 : Math.ceil(utf16Len / 67)
      return { encoding: 'UCS-2', segmentCount }
    }
  }

  const segmentCount = effectiveLength <= 160 ? 1 : Math.ceil(effectiveLength / 153)
  return { encoding: 'GSM-7', segmentCount }
}
