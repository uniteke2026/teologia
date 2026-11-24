-- UNITEKE Connect: isolated tables; safe to run once (and rerun).
begin;
create table if not exists public.connect_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists public.connect_businesses (
  id uuid primary key default gen_random_uuid(),
  student text not null check (char_length(student) between 2 and 120),
  name text not null check (char_length(name) between 2 and 100),
  category text not null check (category in ('Alimentação','Beleza e estética','Comércio','Construção e reformas','Educação','Eventos','Moda e acessórios','Saúde e bem-estar','Serviços profissionais','Tecnologia','Transporte','Outros')),
  description text not null default '' check (char_length(description)<=280),
  whatsapp text not null check (whatsapp ~ '^55[1-9][0-9]{9,10}$'),
  instagram text not null default '' check (instagram ~ '^[A-Za-z0-9_.]{0,30}$'),
  banner_path text not null unique,
  active boolean not null default true,
  consent_at timestamptz not null default now(),
  consent_version text not null default '2026-11-v1',
  created_at timestamptz not null default now()
);
create unique index if not exists connect_unique_business on public.connect_businesses(lower(name),whatsapp);
create index if not exists connect_businesses_catalog on public.connect_businesses(active,created_at desc);
create table if not exists public.connect_reports (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.connect_businesses(id) on delete cascade,
  reason text not null check (char_length(reason) between 3 and 500),
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists public.connect_limits (
  scope text not null, bucket timestamptz not null, hits integer not null default 1,
  primary key(scope,bucket)
);
alter table public.connect_admins enable row level security;
alter table public.connect_businesses enable row level security;
alter table public.connect_reports enable row level security;
alter table public.connect_limits enable row level security;
revoke all on public.connect_admins, public.connect_businesses, public.connect_reports, public.connect_limits from public,anon,authenticated;
grant select,insert,update,delete on public.connect_admins, public.connect_businesses, public.connect_reports, public.connect_limits to service_role;
-- Rate limits are atomic, including concurrent requests. Only backend can invoke.
create or replace function public.connect_take_limit(p_scope text,p_period text,p_max integer)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare b timestamptz; n integer;
begin
 if p_period not in ('hour','day') or p_max < 1 then return false; end if;
 b := date_trunc(p_period,now());
 insert into public.connect_limits(scope,bucket,hits) values(p_scope,b,1)
 on conflict(scope,bucket) do update set hits=public.connect_limits.hits+1
 where public.connect_limits.hits < p_max returning hits into n;
 return n is not null;
end; $$;
revoke all on function public.connect_take_limit(text,text,integer) from public,anon,authenticated;
grant execute on function public.connect_take_limit(text,text,integer) to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('connect-banners','connect-banners',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=5242880,allowed_mime_types=excluded.allowed_mime_types;
-- Restrictive rules prevent inherited broad permissive storage policies from exposing this bucket.
drop policy if exists connect_deny_client_banners on storage.objects;
create policy connect_deny_client_banners on storage.objects as restrictive for all to anon,authenticated
using (bucket_id <> 'connect-banners') with check (bucket_id <> 'connect-banners');
commit;
