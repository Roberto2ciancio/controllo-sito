import { describe, expect, it } from 'vitest'
import { isForbiddenIp, normalizeAddress } from './address.ts'

describe('normalizeAddress', () => {
  it.each([
    ['esempio.it', 'esempio.it'],
    ['  WWW.Esempio.IT ', 'www.esempio.it'],
    ['https://esempio.it/pagina?x=1', 'esempio.it'],
    ['esempio.it.', 'esempio.it'],
    ['http://esempio.it:443', 'esempio.it'],
    ['caffè.it', 'xn--caff-8oa.it'],
  ])('%s diventa %s', (input, domain) => {
    expect(normalizeAddress(input)).toEqual({ domain })
  })

  it.each([
    ['', 'empty'],
    ['   ', 'empty'],
    ['non un sito', 'invalid'],
    ['esempio', 'invalid'],
    ['192.168.1.1', 'ip-address'],
    ['[::1]', 'ip-address'],
    ['2130706433', 'ip-address'],
    ['0x7f.1', 'ip-address'],
    ['localhost', 'internal-name'],
    ['server.local', 'internal-name'],
    ['a.internal', 'internal-name'],
    ['https://esempio.it:8080', 'invalid'],
    ['ftp://esempio.it', 'invalid'],
    ['user:pw@esempio.it', 'invalid'],
  ])('rifiuta %j come %s', (input, error) => {
    expect(normalizeAddress(input)).toEqual({ error })
  })
})

describe('isForbiddenIp', () => {
  it.each([
    '127.0.0.1', '10.0.0.1', '172.16.0.1', '192.168.0.1', '169.254.169.254',
    '0.0.0.0', '100.64.0.1', '192.0.2.1', '198.18.0.1', '224.0.0.1', '255.255.255.255',
    '::1', '::', 'fc00::1', 'fe80::1', 'ff02::1',
    '::ffff:127.0.0.1', '::ffff:7f00:1', '64:ff9b::7f00:1', '2001:db8::1',
  ])('vieta %s', (ip) => {
    expect(isForbiddenIp(ip)).toBe(true)
  })

  it.each(['8.8.8.8', '185.199.108.153', '2606:4700:4700::1111'])('permette %s', (ip) => {
    expect(isForbiddenIp(ip)).toBe(false)
  })

  it('un valore che non è un indirizzo IP è vietato', () => {
    expect(isForbiddenIp('boh')).toBe(true)
  })
})
