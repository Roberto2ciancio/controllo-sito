-- Schema e funzione di Controllo Sito, separati da quelli di Bere.
-- File ripetibile: si applica con `supabase db query --linked --file`, mai con `db push`,
-- così le migrazioni di Bere restano coerenti e questo file non tocca le sue tabelle.

create schema if not exists controllo_sito;
grant usage on schema controllo_sito to service_role;

create table if not exists controllo_sito.requests (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  domain text not null,
  created_at timestamptz not null default now()
);
create index if not exists requests_ip_created_idx on controllo_sito.requests (ip_hash, created_at);
create index if not exists requests_domain_created_idx on controllo_sito.requests (domain, created_at);
create index if not exists requests_created_idx on controllo_sito.requests (created_at);
alter table controllo_sito.requests enable row level security;

-- Impronta IP + dominio, senza anagrafica utente: non c'è nulla da proteggere con policy per utente,
-- la riga abilita RLS comunque per difesa in profondità (nessuna policy = nessun accesso diretto).

create or replace function public.controllo_sito_claim(p_ip_hash text, p_domain text)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  ip_count int;
  domain_count int;
  global_count int;
begin
  delete from controllo_sito.requests where created_at < now() - interval '48 hours';

  select count(*) into ip_count from controllo_sito.requests
    where ip_hash = p_ip_hash and created_at > now() - interval '1 hour';
  if ip_count >= 10 then return 'limit-ip'; end if;

  select count(*) into domain_count from controllo_sito.requests
    where domain = p_domain and created_at > now() - interval '1 day';
  if domain_count >= 30 then return 'limit-domain'; end if;

  select count(*) into global_count from controllo_sito.requests
    where created_at > now() - interval '1 day';
  if global_count >= 500 then return 'limit-global'; end if;

  insert into controllo_sito.requests (ip_hash, domain) values (p_ip_hash, p_domain);
  return 'ok';
end;
$$;

revoke execute on function public.controllo_sito_claim(text, text) from public, anon, authenticated;
grant execute on function public.controllo_sito_claim(text, text) to service_role;
