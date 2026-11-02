import net from 'node:net'

export type AddressResult =
  | { domain: string }
  | { error: 'empty' | 'invalid' | 'ip-address' | 'internal-name' }

const INTERNAL_SUFFIXES = ['.local', '.internal', '.localhost', '.lan', '.home', '.intranet']

function stripBrackets(hostname: string): string {
  return hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname
}

function isLiteralIp(hostname: string): boolean {
  return net.isIP(stripBrackets(hostname)) !== 0
}

/**
 * Normalizza un indirizzo scritto dall'utente nel dominio su cui eseguire il controllo.
 *
 * Il parser URL del motore (WHATWG) già risolve, per uno schema "speciale" come http,
 * le notazioni IPv4 alternative (decimale, esadecimale, parziale) nella forma puntata
 * standard: è per questo che un valore come "2130706433" o "0x7f.1" diventa "127.0.0.1"
 * prima ancora di arrivare a isLiteralIp.
 */
export function normalizeAddress(input: string): AddressResult {
  const trimmed = input.trim()
  if (trimmed === '') return { error: 'empty' }

  const hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)
  const candidate = hasScheme ? trimmed : `http://${trimmed}`

  let url: URL
  try {
    url = new URL(candidate)
  } catch {
    return { error: 'invalid' }
  }

  if (hasScheme && url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { error: 'invalid' }
  }
  if (url.username !== '' || url.password !== '') {
    return { error: 'invalid' }
  }
  if (url.port !== '' && url.port !== '80' && url.port !== '443') {
    return { error: 'invalid' }
  }

  let hostname = url.hostname
  if (hostname === '') return { error: 'invalid' }

  if (isLiteralIp(hostname)) return { error: 'ip-address' }

  if (hostname.endsWith('.')) hostname = hostname.slice(0, -1)
  if (hostname === '') return { error: 'invalid' }
  hostname = hostname.toLowerCase()

  if (!hostname.includes('.')) {
    return hostname === 'localhost' ? { error: 'internal-name' } : { error: 'invalid' }
  }
  if (INTERNAL_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) {
    return { error: 'internal-name' }
  }

  return { domain: hostname }
}

function toBytesV4(ip: string): number[] {
  return ip.split('.').map(Number)
}

function toBytesV6(ip: string): number[] {
  let address = ip
  const lastColon = address.lastIndexOf(':')
  const tail = address.slice(lastColon + 1)
  if (tail.includes('.')) {
    const v4 = toBytesV4(tail)
    const hex = ((v4[0] << 8) | v4[1]).toString(16) + ':' + ((v4[2] << 8) | v4[3]).toString(16)
    address = address.slice(0, lastColon + 1) + hex
  }

  let head: string[]
  let tailParts: string[]
  let hasCompression: boolean
  if (address.includes('::')) {
    const [headStr, tailStr] = address.split('::')
    head = headStr ? headStr.split(':').filter(Boolean) : []
    tailParts = tailStr ? tailStr.split(':').filter(Boolean) : []
    hasCompression = true
  } else {
    head = address.split(':').filter(Boolean)
    tailParts = []
    hasCompression = false
  }

  const groups = [...head]
  if (hasCompression) {
    const missing = 8 - head.length - tailParts.length
    for (let i = 0; i < missing; i++) groups.push('0')
    groups.push(...tailParts)
  }

  const bytes: number[] = []
  for (const group of groups) {
    const n = parseInt(group, 16)
    bytes.push((n >> 8) & 0xff, n & 0xff)
  }
  return bytes
}

function isForbiddenV4(bytes: number[]): boolean {
  const [a, b] = bytes
  if (a === 0) return true // 0.0.0.0/8
  if (a === 10) return true // 10.0.0.0/8
  if (a === 100 && b >= 64 && b <= 127) return true // 100.64.0.0/10 (CGNAT)
  if (a === 127) return true // 127.0.0.0/8 (loopback)
  if (a === 169 && b === 254) return true // 169.254.0.0/16 (link-local)
  if (a === 172 && b >= 16 && b <= 31) return true // 172.16.0.0/12
  if (a === 192 && b === 0 && bytes[2] === 2) return true // 192.0.2.0/24 (documentazione)
  if (a === 192 && b === 168) return true // 192.168.0.0/16
  if (a === 198 && (b === 18 || b === 19)) return true // 198.18.0.0/15 (benchmark)
  if (a >= 224) return true // 224.0.0.0/4 multicast + 240.0.0.0/4 riservato + broadcast
  return false
}

const NAT64_PREFIX = [0x00, 0x64, 0xff, 0x9b, 0, 0, 0, 0, 0, 0, 0, 0]

function isForbiddenV6(bytes: number[]): boolean {
  // IPv4 incapsulato in IPv6 mappato (::ffff:0:0/96) o nel prefisso NAT64 (64:ff9b::/96):
  // si giudica l'indirizzo IPv4 vero che trasportano.
  if (bytes.slice(0, 10).every((n) => n === 0) && bytes[10] === 0xff && bytes[11] === 0xff) {
    return isForbiddenV4(bytes.slice(12))
  }
  if (NAT64_PREFIX.every((n, i) => bytes[i] === n)) {
    return isForbiddenV4(bytes.slice(12))
  }

  if (bytes.every((n) => n === 0)) return true // :: (non specificato)
  if (bytes.slice(0, 15).every((n) => n === 0) && bytes[15] === 1) return true // ::1 (loopback)
  if ((bytes[0] & 0xfe) === 0xfc) return true // fc00::/7 (unique local)
  if (bytes[0] === 0xfe && (bytes[1] & 0xc0) === 0x80) return true // fe80::/10 (link-local)
  if (bytes[0] === 0xff) return true // ff00::/8 (multicast)
  if (bytes[0] === 0x20 && bytes[1] === 0x01 && bytes[2] === 0x0d && bytes[3] === 0xb8) return true // 2001:db8::/32 (documentazione)

  return false
}

export function isForbiddenIp(ip: string): boolean {
  const family = net.isIP(ip)
  if (family === 4) return isForbiddenV4(toBytesV4(ip))
  if (family === 6) return isForbiddenV6(toBytesV6(ip))
  return true // non è un indirizzo IP valido: si rifiuta per sicurezza
}
