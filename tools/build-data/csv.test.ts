import { describe, expect, it } from 'vitest'
import { parseCsv, parseCsvRecords } from './csv.ts'

describe('parseCsv', () => {
  it('reads plain records, with or without a trailing newline', () => {
    expect(parseCsv('a,b\n1,2\n')).toEqual([['a', 'b'], ['1', '2']])
    expect(parseCsv('a,b\n1,2')).toEqual([['a', 'b'], ['1', '2']])
  })

  it('keeps empty fields, including a trailing one', () => {
    expect(parseCsv('a,,c\n,,\n')).toEqual([['a', '', 'c'], ['', '', '']])
  })

  it('handles quoted fields with commas, doubled quotes and line breaks', () => {
    const text = 'id,text\n1,"Hello, ""world"""\n2,"line one\nline two\r\nline three"\n'
    expect(parseCsv(text)).toEqual([
      ['id', 'text'],
      ['1', 'Hello, "world"'],
      ['2', 'line one\nline two\r\nline three']
    ])
  })

  it('accepts CRLF and lone CR record separators', () => {
    expect(parseCsv('a,b\r\n1,2\r\n')).toEqual([['a', 'b'], ['1', '2']])
    expect(parseCsv('a,b\r1,2')).toEqual([['a', 'b'], ['1', '2']])
  })

  it('strips a UTF-8 byte order mark', () => {
    expect(parseCsv(String.fromCharCode(0xfeff) + 'species_id,n\n1,2\n')[0]).toEqual(['species_id', 'n'])
  })

  it('distinguishes an empty quoted field from no field', () => {
    expect(parseCsv('""\n')).toEqual([['']])
    expect(parseCsv('a,""')).toEqual([['a', '']])
  })

  it('keeps a quote inside an unquoted field as a literal character', () => {
    expect(parseCsv('1,ends with a stray quote."\n2,ok\n')).toEqual([['1', 'ends with a stray quote."'], ['2', 'ok']])
  })

  it('rejects an unterminated quoted field and text after a closing quote', () => {
    expect(() => parseCsv('a,"never closed\n')).toThrow(/unterminated/)
    expect(() => parseCsv('a,"closed"x\n')).toThrow(/closing quote/)
  })
})

describe('parseCsvRecords', () => {
  it('keys each record by the header and skips blank lines', () => {
    expect(parseCsvRecords('id,name\n1,bulbasaur\n\n2,ivysaur\n')).toEqual([
      { id: '1', name: 'bulbasaur' },
      { id: '2', name: 'ivysaur' }
    ])
  })

  it('rejects a record with the wrong number of fields', () => {
    expect(() => parseCsvRecords('id,name\n1\n')).toThrow(/1 fields/)
  })
})
