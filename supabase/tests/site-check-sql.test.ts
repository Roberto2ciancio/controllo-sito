// @vitest-environment node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'

let db: PGlite

const STUBS = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  grant usage on schema public to authenticated, anon, service_role;
`

const SQL_FILE = join(process.cwd(), 'supabase/site_check.sql')
const readSql = () => readFileSync(SQL_FILE, 'utf8')

beforeAll(async () => {
  db = new PGlite()
  await db.exec(STUBS)
  await db.exec(readSql())
}, 60_000)

beforeEach(async () => {
  await db.exec(`reset role; delete from controllo_sito.requests;`)
})

const claim = async (ip: string, domain: string) =>
  (await db.query<{ controllo_sito_claim: string }>(`select controllo_sito_claim($1, $2)`, [ip, domain])).rows[0].controllo_sito_claim

describe('controllo_sito_claim: limite per IP', () => {
  it("permette le prime 10 richieste in un'ora dallo stesso IP e rifiuta l'undicesima", async () => {
    for (let i = 0; i < 10; i++) {
      expect(await claim('ip-a', `dominio-${i}.it`)).toBe('ok')
    }
    expect(await claim('ip-a', 'altro.it')).toBe('limit-ip')
  })

  it("passata l'ora, il limite torna a ok", async () => {
    for (let i = 0; i < 10; i++) await claim('ip-a', `dominio-${i}.it`)
    expect(await claim('ip-a', 'altro.it')).toBe('limit-ip')
    await db.exec(`update controllo_sito.requests set created_at = now() - interval '2 hours' where ip_hash = 'ip-a'`)
    expect(await claim('ip-a', 'altro.it')).toBe('ok')
  })
})

describe('controllo_sito_claim: limite per dominio', () => {
  it('permette le prime 30 richieste al giorno per lo stesso dominio e rifiuta la 31esima', async () => {
    for (let i = 0; i < 30; i++) {
      expect(await claim(`ip-${i}`, 'esempio.it')).toBe('ok')
    }
    expect(await claim('ip-nuovo', 'esempio.it')).toBe('limit-domain')
  })
})

describe('controllo_sito_claim: limite globale', () => {
  it('rifiuta oltre 500 richieste complessive in un giorno', async () => {
    await db.exec(`
      insert into controllo_sito.requests (ip_hash, domain, created_at)
      select 'ip-' || g, 'dominio-' || g || '.it', now() - interval '1 minute'
      from generate_series(1, 500) g
    `)
    expect(await claim('ip-nuovo', 'nuovo.it')).toBe('limit-global')
  })
})

describe('controllo_sito_claim: pulizia', () => {
  it('cancella le righe più vecchie di 48 ore', async () => {
    await db.exec(`insert into controllo_sito.requests (ip_hash, domain, created_at) values ('vecchio', 'vecchio.it', now() - interval '49 hours')`)
    await claim('ip-nuovo', 'nuovo.it')
    const count = Number((await db.query<{ n: string }>(`select count(*) n from controllo_sito.requests where ip_hash = 'vecchio'`)).rows[0].n)
    expect(count).toBe(0)
  })
})

describe('controllo_sito_claim: permessi', () => {
  it('anon non può chiamarla né leggere la tabella', async () => {
    await db.exec(`set role anon;`)
    await expect(db.query(`select controllo_sito_claim('x', 'y.it')`)).rejects.toThrow(/permission denied/)
    await expect(db.query(`select * from controllo_sito.requests`)).rejects.toThrow(/permission denied|does not exist/)
    await db.exec(`reset role;`)
  })

  it('authenticated non può chiamarla né leggere la tabella', async () => {
    await db.exec(`set role authenticated;`)
    await expect(db.query(`select controllo_sito_claim('x', 'y.it')`)).rejects.toThrow(/permission denied/)
    await expect(db.query(`select * from controllo_sito.requests`)).rejects.toThrow(/permission denied|does not exist/)
    await db.exec(`reset role;`)
  })
})

describe('idempotenza del file', () => {
  it('eseguire il file due volte non dà errori', async () => {
    await expect(db.exec(readSql())).resolves.not.toThrow()
  })
})
