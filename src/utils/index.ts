export function truncateString(
  value: string,
  maxLength: number,
  ellipsis = '…'
): string {
  if (!value) return ''
  
  if (maxLength <= 0) return ''

  if (value.length <= maxLength) {
    return value
  }

  if (!ellipsis) {
    return value.slice(0, maxLength)
  }

  if (ellipsis.length >= maxLength) {
    return value.slice(0, maxLength)
  }

  return value.slice(0, maxLength - ellipsis.length) + ellipsis
}