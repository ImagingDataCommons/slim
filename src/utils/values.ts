import * as dmv from 'dicom-microscopy-viewer'

function parseName (value: dmv.metadata.PersonName|null|undefined): string {
  if (typeof value === 'object' && value !== null && value !== undefined) {
    if (value.Alphabetic !== undefined) {
      return value.Alphabetic.split('^').join(' ')
    }
    return ''
  }
  return ''
}

function parseDate (value: string|null|undefined): string {
  if (value !== null && value !== undefined) {
    const year = value.substring(0, 4)
    const month = value.substring(4, 6)
    const day = value.substring(6, 8)
    return `${year}-${month}-${day}`
  }
  return ''
}

function parseTime (value: string|null|undefined): string {
  if (value !== null && value !== undefined) {
    const hours = value.substring(0, 2)
    const minutes = value.substring(2, 4)
    const seconds = value.substring(4, 6)
    return `${hours}:${minutes}:${seconds}`
  }
  return ''
}

function parseDateTime (value: string|null|undefined): string {
  if (value !== null && value !== undefined) {
    const year = value.substring(0, 4)
    const month = value.substring(4, 6)
    const day = value.substring(6, 8)
    const hours = value.substring(8, 10)
    const minutes = value.substring(10, 12)
    const seconds = value.substring(12, 14)
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
  }
  return ''
}

function parseSex (value: string|null|undefined): string {
  const lut: { [key: string]: string } = {
    F: 'Female',
    M: 'Male',
    O: 'Other'
  }
  if (value !== null && value !== undefined) {
    return lut[value]
  }
  return ''
}

export { parseDate, parseDateTime, parseName, parseSex, parseTime }
