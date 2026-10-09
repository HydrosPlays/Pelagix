/**
 * RFC 4180 CSV reader: quoted fields, doubled quotes, embedded line breaks, CRLF or LF records,
 * optional UTF-8 BOM, optional trailing newline. One leniency, as in most readers: a quote inside
 * an unquoted field is kept as a literal character (PokeAPI's flavor text has such a row).
 */
import { fail } from './util.ts'

export function parseCsv(text: string, source = 'csv'): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let i = text.charCodeAt(0) === 0xfeff ? 1 : 0
  const n = text.length
  let quoted = false
  let fieldStarted = false

  const endField = (): void => {
    row.push(field)
    field = ''
    fieldStarted = false
  }
  const endRow = (): void => {
    endField()
    rows.push(row)
    row = []
  }

  while (i < n) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
        } else {
          quoted = false
          i++
          const next = text[i]
          if (next !== undefined && next !== ',' && next !== '\n' && next !== '\r') {
            fail(`${source}: unexpected character after a closing quote at offset ${i}`)
          }
        }
      } else {
        field += ch
        i++
      }
      continue
    }
    if (ch === '"' && !fieldStarted) {
      quoted = true
      fieldStarted = true
      i++
    } else if (ch === ',') {
      endField()
      i++
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      i++
      endRow()
    } else {
      field += ch
      fieldStarted = true
      i++
    }
  }
  if (quoted) fail(`${source}: unterminated quoted field`)
  // A final record without a trailing newline.
  if (field !== '' || fieldStarted || row.length > 0) endRow()
  return rows
}

export type CsvRecord = Record<string, string>

/** Parses a CSV with a header row into objects keyed by column name. */
export function parseCsvRecords(text: string, source = 'csv'): CsvRecord[] {
  const rows = parseCsv(text, source)
  const header = rows[0]
  if (!header || header.length === 0) fail(`${source}: empty file`)
  const out: CsvRecord[] = []
  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r]
    if (cells.length === 1 && cells[0] === '') continue
    if (cells.length !== header.length) {
      fail(`${source}: record ${r + 1} has ${cells.length} fields, the header has ${header.length}`)
    }
    const rec: CsvRecord = {}
    for (let c = 0; c < header.length; c++) rec[header[c]] = cells[c]
    out.push(rec)
  }
  return out
}
