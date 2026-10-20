-- =====================================================================
--  ESPACIO QUERIDO · Portal inmobiliario
--  Esquema completo de Supabase (Postgres 15)
--  Ejecutar completo en: Supabase Dashboard → SQL Editor → New query
--  Es idempotente: puedes volver a correrlo sin romper datos.
-- =====================================================================

create extension if not exists "pgcrypto";
create extension if not exists "unaccent" with schema extensions;

-- ---------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------
do $$ begin create type public.user_role as enum ('admin','agent','user');
exception when duplicate_object then null; end $$;

do $$ begin create type public.property_status as enum ('active','draft','finished');
exception when duplicate_object then null; end $$;

do $$ begin create type public.operation_type as enum ('sale','rent');
exception when duplicate_object then null; end $$;

do $$ begin create type public.property_type as enum
  ('casa','departamento','terreno','oficina','local','bodega','otro');
exception when duplicate_object then null; end $$;

do $$ begin create type public.property_source as enum ('manual','easybroker');
exception when duplicate_object then null; end $$;

do $$ begin create type public.lead_status as enum ('new','contacted','qualified','won','lost');
exception when duplicate_object then null; end $$;

do $$ begin create type public.lead_interest as enum
  ('venta','compra','renta','inversion','propiedad','otro');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- UTILIDADES
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create or replace function public.slugify(v text)
returns text language sql stable
set search_path = public, extensions as $$
  select trim(both '-' from regexp_replace(lower(unaccent(coalesce(v, ''))), '[^a-z0-9]+', '-', 'g'));
$$;

-- ---------------------------------------------------------------------
-- PROFILES (1:1 con auth.users)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  full_name   text,
  avatar_url  text,
  phone       text,            -- se muestra en el detalle de propiedad ("Llamada")
  whatsapp    text,            -- 10 dígitos o formato internacional
  title       text,            -- ej. "Asesora inmobiliaria"
  active      boolean not null default true,  -- desactivado = no puede entrar al panel
  role        public.user_role not null default 'user',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Migración desde la versión anterior del esquema
alter table public.profiles add column if not exists phone    text;
alter table public.profiles add column if not exists whatsapp text;
alter table public.profiles add column if not exists title    text;
alter table public.profiles add column if not exists active   boolean not null default true;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and active);
$$;

-- staff = admin o asesor activo (acceso al panel)
create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','agent') and active);
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Impide que un usuario se cambie el rol o se reactive a sí mismo
create or replace function public.protect_profile_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (new.role is distinct from old.role or new.active is distinct from old.active)
     and auth.uid() is not null and not public.is_admin() then
    raise exception 'No tienes permiso para cambiar roles o el estado de la cuenta';
  end if;
  return new;
end $$;

drop trigger if exists trg_profiles_role on public.profiles;
create trigger trg_profiles_role before update on public.profiles
  for each row execute function public.protect_profile_role();

drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- PROPERTIES
-- ---------------------------------------------------------------------
create table if not exists public.properties (
  id               uuid primary key default gen_random_uuid(),
  code             bigint generated always as identity (start with 100001) unique,  -- "ID 123717" público
  agent_id         uuid references public.profiles(id) on delete set null,          -- asesor asignado
  slug             text unique,
  title            text not null,
  description      text,
  status           public.property_status not null default 'draft',
  operation_type   public.operation_type  not null default 'sale',
  property_type    public.property_type   not null default 'casa',
  price            numeric(14,2) not null default 0 check (price >= 0),
  currency         text not null default 'MXN' check (currency in ('MXN','USD')),
  maintenance_fee  numeric(12,2),
  bedrooms         smallint not null default 0,
  bathrooms        smallint not null default 0,
  half_bathrooms   smallint not null default 0,
  parking_spaces   smallint not null default 0,
  construction_m2  numeric(10,2),
  land_m2          numeric(10,2),
  floors           smallint,
  year_built       smallint,
  state            text,
  city             text,
  neighborhood     text,
  address          text,
  postal_code      text,
  latitude         double precision,
  longitude        double precision,
  amenities        text[] not null default '{}',
  cover_image_url  text,
  video_url        text,
  featured         boolean not null default false,
  source           public.property_source not null default 'manual',
  easybroker_id    text unique,
  views_count      integer not null default 0,
  created_by       uuid references auth.users(id) on delete set null default auth.uid(),
  published_at     timestamptz,
  finished_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_properties_status      on public.properties (status);
create index if not exists idx_properties_operation   on public.properties (operation_type, property_type);
create index if not exists idx_properties_price       on public.properties (price);
create index if not exists idx_properties_city        on public.properties (city);
create index if not exists idx_properties_amenities   on public.properties using gin (amenities);
create index if not exists idx_properties_created     on public.properties (created_at desc);

-- Migración desde la versión anterior
alter table public.properties add column if not exists agent_id uuid references public.profiles(id) on delete set null;
alter table public.properties add column if not exists code bigint generated always as identity (start with 100001);
create unique index if not exists idx_properties_code  on public.properties (code);
create index if not exists idx_properties_agent        on public.properties (agent_id);

-- Slugs de ubicación para las URLs por zona (/venta/casas/nuevo-leon/monterrey/cumbres)
alter table public.properties add column if not exists state_slug        text;
alter table public.properties add column if not exists city_slug         text;
alter table public.properties add column if not exists neighborhood_slug text;
create index if not exists idx_properties_slugs on public.properties (state_slug, city_slug, neighborhood_slug);

-- Puede editar la propiedad: admin, o el asesor asignado
create or replace function public.can_edit_property(p_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin()
      or (public.is_staff() and exists (select 1 from public.properties where id = p_id and agent_id = auth.uid()));
$$;

create or replace function public.can_edit_property_text(p_id text)
returns boolean language plpgsql stable security definer set search_path = public as $$
begin
  return public.can_edit_property(p_id::uuid);
exception when others then
  return false;
end $$;

-- Los asesores no pueden reasignar, destacar ni tocar campos de EasyBroker
create or replace function public.properties_guard_agent()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_admin() then
    return new;  -- service role (edge functions) o admin
  end if;
  if tg_op = 'INSERT' then
    new.agent_id      := auth.uid();
    new.featured      := false;
    new.source        := 'manual';
    new.easybroker_id := null;
  else
    new.agent_id      := old.agent_id;
    new.featured      := old.featured;
    new.source        := old.source;
    new.easybroker_id := old.easybroker_id;
  end if;
  return new;
end $$;

drop trigger if exists trg_properties_guard on public.properties;
create trigger trg_properties_guard before insert or update on public.properties
  for each row execute function public.properties_guard_agent();

create or replace function public.properties_before_write()
returns trigger language plpgsql set search_path = public, extensions as $$
begin
  if new.slug is null or new.slug = '' then
    new.slug := public.slugify(new.title) || '-' || substr(replace(new.id::text, '-', ''), 1, 6);
  end if;
  new.state_slug        := nullif(public.slugify(new.state), '');
  new.city_slug         := nullif(public.slugify(new.city), '');
  new.neighborhood_slug := nullif(public.slugify(new.neighborhood), '');
  if new.status = 'active' and new.published_at is null then
    new.published_at := now();
  end if;
  if new.status = 'finished' then
    if tg_op = 'INSERT' or old.status is distinct from 'finished' then
      new.finished_at := now();
    end if;
  else
    new.finished_at := null;
  end if;
  return new;
end $$;

drop trigger if exists trg_properties_before on public.properties;
create trigger trg_properties_before before insert or update on public.properties
  for each row execute function public.properties_before_write();

drop trigger if exists trg_properties_updated on public.properties;
create trigger trg_properties_updated before update on public.properties
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- PROPERTY IMAGES
-- ---------------------------------------------------------------------
create table if not exists public.property_images (
  id            uuid primary key default gen_random_uuid(),
  property_id   uuid not null references public.properties(id) on delete cascade,
  url           text not null,
  storage_path  text,             -- null cuando la imagen viene de EasyBroker (URL externa)
  caption       text,
  position      integer not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists idx_property_images_property on public.property_images (property_id, position);

-- ---------------------------------------------------------------------
-- LEADS
-- ---------------------------------------------------------------------
create table if not exists public.leads (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (char_length(name) between 2 and 120),
  email         text not null check (char_length(email) <= 160),
  phone         text not null check (char_length(phone) <= 20),
  interest      public.lead_interest not null default 'otro',
  message       text check (char_length(message) <= 2000),
  property_id   uuid references public.properties(id) on delete set null,
  source        text not null default 'contact_form',  -- contact_form | property_detail
  status        public.lead_status not null default 'new',
  notes         text,
  session_id    uuid,
  visitor_id    uuid,
  page_url      text,
  referrer      text,
  utm_source    text,
  utm_medium    text,
  utm_campaign  text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_leads_created  on public.leads (created_at desc);
create index if not exists idx_leads_status   on public.leads (status);
create index if not exists idx_leads_property on public.leads (property_id);

alter table public.leads add column if not exists agent_id uuid references public.profiles(id) on delete set null;
create index if not exists idx_leads_agent on public.leads (agent_id);

-- El lead hereda el asesor asignado a la propiedad
create or replace function public.leads_set_agent()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.property_id is not null then
    select agent_id into new.agent_id from public.properties where id = new.property_id;
  end if;
  return new;
end $$;

drop trigger if exists trg_leads_agent on public.leads;
create trigger trg_leads_agent before insert on public.leads
  for each row execute function public.leads_set_agent();

drop trigger if exists trg_leads_updated on public.leads;
create trigger trg_leads_updated before update on public.leads
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- ANALYTICS (sesiones + eventos)
-- ---------------------------------------------------------------------
create table if not exists public.analytics_sessions (
  id                uuid primary key,
  visitor_id        uuid not null,
  started_at        timestamptz not null default now(),
  last_seen_at      timestamptz not null default now(),
  duration_seconds  integer not null default 0,
  page_views        integer not null default 0,
  landing_page      text,
  referrer          text,
  source            text,           -- Directo | Buscadores | Redes sociales | Referidos | Campañas | Pago
  utm_source        text,
  utm_medium        text,
  utm_campaign      text,
  device            text,           -- mobile | tablet | desktop
  browser           text,
  os                text,
  screen            text,
  language          text
);
create index if not exists idx_sessions_started on public.analytics_sessions (started_at desc);
create index if not exists idx_sessions_visitor on public.analytics_sessions (visitor_id);
create index if not exists idx_sessions_last    on public.analytics_sessions (last_seen_at desc);

create table if not exists public.analytics_events (
  id           bigint generated always as identity primary key,
  session_id   uuid not null,
  visitor_id   uuid not null,
  event_type   text not null,
  path         text,
  label        text,
  property_id  uuid references public.properties(id) on delete set null,
  metadata     jsonb not null default '{}',
  created_at   timestamptz not null default now()
);
create index if not exists idx_events_created  on public.analytics_events (created_at desc);
create index if not exists idx_events_type     on public.analytics_events (event_type, created_at desc);
create index if not exists idx_events_property on public.analytics_events (property_id);
create index if not exists idx_events_session  on public.analytics_events (session_id);

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.profiles            enable row level security;
alter table public.properties          enable row level security;
alter table public.property_images     enable row level security;
alter table public.leads               enable row level security;
alter table public.analytics_sessions  enable row level security;
alter table public.analytics_events    enable row level security;

-- profiles: cada quien ve el suyo; el admin ve y edita a todos
drop policy if exists "profiles_select_own"   on public.profiles;
drop policy if exists "profiles_select_staff" on public.profiles;
drop policy if exists "profiles_update_own"   on public.profiles;
drop policy if exists "profiles_admin_all"    on public.profiles;
create policy "profiles_select_own"   on public.profiles for select to authenticated using (id = auth.uid());
create policy "profiles_update_own"   on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles_admin_all"    on public.profiles for all    to authenticated using (public.is_admin()) with check (public.is_admin());

-- properties
--   público: activas y finalizadas
--   admin:   todo
--   asesor:  ve, crea y edita (incl. estado) SOLO las asignadas a él; no puede borrar
drop policy if exists "properties_public_read"   on public.properties;
drop policy if exists "properties_staff_all"     on public.properties;
drop policy if exists "properties_admin_all"     on public.properties;
drop policy if exists "properties_agent_select"  on public.properties;
drop policy if exists "properties_agent_insert"  on public.properties;
drop policy if exists "properties_agent_update"  on public.properties;
create policy "properties_public_read" on public.properties for select to anon, authenticated
  using (status in ('active','finished'));
create policy "properties_admin_all" on public.properties for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "properties_agent_select" on public.properties for select to authenticated
  using (public.is_staff() and agent_id = auth.uid());
create policy "properties_agent_insert" on public.properties for insert to authenticated
  with check (public.is_staff() and agent_id = auth.uid());
create policy "properties_agent_update" on public.properties for update to authenticated
  using (public.is_staff() and agent_id = auth.uid())
  with check (agent_id = auth.uid());

-- property_images
drop policy if exists "images_public_read" on public.property_images;
drop policy if exists "images_staff_all"   on public.property_images;
drop policy if exists "images_editor_all"  on public.property_images;
create policy "images_public_read" on public.property_images for select to anon, authenticated
  using (exists (select 1 from public.properties p where p.id = property_id and p.status in ('active','finished')));
create policy "images_editor_all" on public.property_images for all to authenticated
  using (public.can_edit_property(property_id)) with check (public.can_edit_property(property_id));

-- leads: cualquiera puede crear (formulario público); solo el admin los ve
drop policy if exists "leads_public_insert" on public.leads;
drop policy if exists "leads_staff_select"  on public.leads;
drop policy if exists "leads_staff_update"  on public.leads;
drop policy if exists "leads_staff_delete"  on public.leads;
drop policy if exists "leads_admin_all"     on public.leads;
create policy "leads_public_insert" on public.leads for insert to anon, authenticated
  with check (status = 'new' and notes is null);
create policy "leads_admin_all" on public.leads for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
-- Si activas reCAPTCHA (función submit-lead), quita la inserción pública:
--   drop policy "leads_public_insert" on public.leads;

-- analytics: escritura solo vía RPC; lectura solo admin
drop policy if exists "sessions_staff_read" on public.analytics_sessions;
drop policy if exists "events_staff_read"   on public.analytics_events;
create policy "sessions_staff_read" on public.analytics_sessions for select to authenticated using (public.is_admin());
create policy "events_staff_read"   on public.analytics_events   for select to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------
-- STORAGE: bucket público para fotos de propiedades y de asesores
--   <property_id>/archivo.jpg   → quien pueda editar la propiedad
--   agents/<user_id>/foto.jpg   → el propio asesor o el admin
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('property-images', 'property-images', true, 10485760,
        array['image/jpeg','image/png','image/webp','image/avif'])
on conflict (id) do nothing;

create or replace function public.can_write_storage_path(p_name text)
returns boolean language sql stable security definer set search_path = public, storage as $$
  select public.is_admin()
      or (public.is_staff() and (
            ((storage.foldername(p_name))[1] = 'agents' and (storage.foldername(p_name))[2] = auth.uid()::text)
         or public.can_edit_property_text((storage.foldername(p_name))[1])
      ));
$$;

drop policy if exists "property_images_public_read"  on storage.objects;
drop policy if exists "property_images_staff_insert" on storage.objects;
drop policy if exists "property_images_staff_update" on storage.objects;
drop policy if exists "property_images_staff_delete" on storage.objects;
create policy "property_images_public_read"  on storage.objects for select using (bucket_id = 'property-images');
create policy "property_images_staff_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'property-images' and public.can_write_storage_path(name));
create policy "property_images_staff_update" on storage.objects for update to authenticated
  using (bucket_id = 'property-images' and public.can_write_storage_path(name));
create policy "property_images_staff_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'property-images' and public.can_write_storage_path(name));

-- ---------------------------------------------------------------------
-- RPC: TRACKING (llamadas desde el sitio público con la anon key)
-- ---------------------------------------------------------------------
create or replace function public.classify_source(p_referrer text, p_utm_source text, p_utm_medium text)
returns text language sql immutable as $$
  select case
    when lower(coalesce(p_utm_medium,'')) in ('cpc','ppc','paid','paid_social','ads') then 'Pago'
    when coalesce(p_utm_source,'') <> '' then 'Campañas'
    when coalesce(p_referrer,'') = '' then 'Directo'
    when p_referrer ~* '(google|bing|yahoo|duckduckgo|ecosia|yandex)\.' then 'Buscadores'
    when p_referrer ~* '(facebook|instagram|fb\.|t\.co|twitter|x\.com|linkedin|tiktok|youtube|pinterest|whatsapp)' then 'Redes sociales'
    else 'Referidos'
  end;
$$;

create or replace function public.track_session_start(
  p_session_id uuid, p_visitor_id uuid, p_landing_page text, p_referrer text,
  p_utm_source text, p_utm_medium text, p_utm_campaign text,
  p_device text, p_browser text, p_os text, p_screen text, p_language text
) returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.analytics_sessions
    (id, visitor_id, landing_page, referrer, source, utm_source, utm_medium, utm_campaign,
     device, browser, os, screen, language)
  values
    (p_session_id, p_visitor_id, left(p_landing_page, 500), left(p_referrer, 500),
     public.classify_source(p_referrer, p_utm_source, p_utm_medium),
     left(p_utm_source, 120), left(p_utm_medium, 120), left(p_utm_campaign, 120),
     left(p_device, 20), left(p_browser, 40), left(p_os, 40), left(p_screen, 20), left(p_language, 20))
  on conflict (id) do update set last_seen_at = now();
end $$;

create or replace function public.track_event(
  p_session_id uuid, p_visitor_id uuid, p_event_type text, p_path text,
  p_label text default null, p_property_id uuid default null, p_metadata jsonb default '{}'
) returns void language plpgsql security definer set search_path = public as $$
begin
  if p_event_type not in ('page_view','property_view','click','cta_click','whatsapp_click',
                          'phone_click','email_click','search','lead_submit','share','gallery_open') then
    raise exception 'event_type inválido';
  end if;

  insert into public.analytics_events (session_id, visitor_id, event_type, path, label, property_id, metadata)
  values (p_session_id, p_visitor_id, p_event_type, left(p_path, 500), left(p_label, 200),
          p_property_id, coalesce(p_metadata, '{}'::jsonb));

  update public.analytics_sessions
     set last_seen_at = now(),
         page_views = page_views + case when p_event_type = 'page_view' then 1 else 0 end
   where id = p_session_id;

  if p_event_type = 'property_view' and p_property_id is not null then
    update public.properties set views_count = views_count + 1 where id = p_property_id;
  end if;
end $$;

-- Latido cada ~15 s mientras la pestaña está visible → tiempo de permanencia
create or replace function public.track_heartbeat(p_session_id uuid, p_seconds integer)
returns void language sql security definer set search_path = public as $$
  update public.analytics_sessions
     set duration_seconds = duration_seconds + least(greatest(coalesce(p_seconds,0), 0), 60),
         last_seen_at = now()
   where id = p_session_id;
$$;

grant execute on function public.track_session_start(uuid,uuid,text,text,text,text,text,text,text,text,text,text) to anon, authenticated;
grant execute on function public.track_event(uuid,uuid,text,text,text,uuid,jsonb) to anon, authenticated;
grant execute on function public.track_heartbeat(uuid,integer) to anon, authenticated;

-- ---------------------------------------------------------------------
-- RPC: ubicaciones para autocompletar el buscador
-- ---------------------------------------------------------------------
create or replace function public.get_property_locations()
returns table (label text, kind text) language sql stable as $$
  select distinct neighborhood, 'colonia' from public.properties where status = 'active' and coalesce(neighborhood,'') <> ''
  union
  select distinct city, 'ciudad' from public.properties where status = 'active' and coalesce(city,'') <> ''
  union
  select distinct state, 'estado' from public.properties where status = 'active' and coalesce(state,'') <> ''
  order by 1;
$$;
grant execute on function public.get_property_locations() to anon, authenticated;

-- Rellena los slugs de ubicación de propiedades existentes (el trigger los mantiene después)
update public.properties
   set state = state
 where (state is not null and state_slug is null)
    or (city is not null and city_slug is null)
    or (neighborhood is not null and neighborhood_slug is null);

-- Estado → municipio → colonia con slugs y número de propiedades activas (buscador y URLs por zona)
drop function if exists public.get_location_tree();
create or replace function public.get_location_tree()
returns table (state text, state_slug text, city text, city_slug text, neighborhood text, neighborhood_slug text, total bigint)
language sql stable as $$
  select min(trim(state)), state_slug, min(trim(city)), city_slug, min(nullif(trim(neighborhood), '')), neighborhood_slug, count(*)
  from public.properties
  where status = 'active' and state_slug is not null and city_slug is not null
  group by state_slug, city_slug, neighborhood_slug
  order by 1, 3, 5;
$$;
grant execute on function public.get_location_tree() to anon, authenticated;

create index if not exists idx_properties_location on public.properties (state, city, neighborhood);
create index if not exists idx_properties_land     on public.properties (land_m2);
create index if not exists idx_properties_constr   on public.properties (construction_m2);

-- ---------------------------------------------------------------------
-- RPC: DASHBOARD (solo staff)
-- ---------------------------------------------------------------------
create or replace function public.get_dashboard_stats(
  p_from timestamptz, p_to timestamptz, p_tz text default 'America/Mexico_City'
) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'No autorizado';
  end if;

  with
  s as (select * from public.analytics_sessions where started_at >= p_from and started_at < p_to),
  e as (select * from public.analytics_events   where created_at >= p_from and created_at < p_to),
  l as (select * from public.leads              where created_at >= p_from and created_at < p_to)
  select jsonb_build_object(
    'totals', jsonb_build_object(
      'sessions',       (select count(*) from s),
      'visitors',       (select count(distinct visitor_id) from s),
      'page_views',     (select count(*) from e where event_type = 'page_view'),
      'property_views', (select count(*) from e where event_type = 'property_view'),
      'avg_duration',   (select coalesce(round(avg(duration_seconds)), 0) from s),
      'bounce_rate',    (select coalesce(round(100.0 * count(*) filter (where page_views <= 1) / nullif(count(*), 0), 1), 0) from s),
      'leads',          (select count(*) from l),
      'clicks',         (select count(*) from e where event_type in ('click','cta_click','whatsapp_click','phone_click','email_click','share','gallery_open')),
      'searches',       (select count(*) from e where event_type = 'search'),
      'active_now',     (select count(*) from public.analytics_sessions where last_seen_at > now() - interval '5 minutes')
    ),
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'date', d.day, 'sessions', coalesce(ss.c, 0), 'page_views', coalesce(pv.c, 0), 'leads', coalesce(ll.c, 0)
             ) order by d.day), '[]'::jsonb)
      from (select generate_series((p_from at time zone p_tz)::date, ((p_to - interval '1 second') at time zone p_tz)::date, interval '1 day')::date as day) d
      left join (select (started_at at time zone p_tz)::date as day, count(*) c from s group by 1) ss on ss.day = d.day
      left join (select (created_at at time zone p_tz)::date as day, count(*) c from e where event_type = 'page_view' group by 1) pv on pv.day = d.day
      left join (select (created_at at time zone p_tz)::date as day, count(*) c from l group by 1) ll on ll.day = d.day
    ),
    'top_pages', (
      select coalesce(jsonb_agg(x order by x.views desc), '[]'::jsonb) from (
        select path, count(*) as views, count(distinct session_id) as sessions
        from e where event_type = 'page_view' group by path order by views desc limit 10) x
    ),
    'top_properties', (
      select coalesce(jsonb_agg(x order by x.views desc), '[]'::jsonb) from (
        select p.id, p.title, p.slug, p.cover_image_url, count(*) as views,
               (select count(*) from l where l.property_id = p.id) as leads
        from e join public.properties p on p.id = e.property_id
        where e.event_type = 'property_view'
        group by p.id order by views desc limit 8) x
    ),
    'sources', (
      select coalesce(jsonb_agg(x order by x.sessions desc), '[]'::jsonb) from (
        select coalesce(source, 'Directo') as name, count(*) as sessions from s group by 1) x
    ),
    'devices', (
      select coalesce(jsonb_agg(x order by x.sessions desc), '[]'::jsonb) from (
        select coalesce(device, 'desktop') as name, count(*) as sessions from s group by 1) x
    ),
    'clicks_by_type', (
      select coalesce(jsonb_agg(x order by x.total desc), '[]'::jsonb) from (
        select event_type as name, count(*) as total from e
        where event_type not in ('page_view','property_view','search','lead_submit') group by 1) x
    ),
    'top_clicks', (
      select coalesce(jsonb_agg(x order by x.total desc), '[]'::jsonb) from (
        select coalesce(label, event_type) as label, event_type, count(*) as total from e
        where event_type in ('click','cta_click','whatsapp_click','phone_click','email_click','share')
        group by 1, 2 order by total desc limit 10) x
    ),
    'top_searches', (
      select coalesce(jsonb_agg(x order by x.total desc), '[]'::jsonb) from (
        select lower(metadata->>'q') as term, count(*) as total from e
        where event_type = 'search' and coalesce(metadata->>'q','') <> ''
        group by 1 order by total desc limit 10) x
    ),
    'leads_by_interest', (
      select coalesce(jsonb_agg(x order by x.total desc), '[]'::jsonb) from (
        select interest::text as name, count(*) as total from l group by 1) x
    ),
    'leads_by_status', (
      select coalesce(jsonb_agg(x order by x.total desc), '[]'::jsonb) from (
        select status::text as name, count(*) as total from l group by 1) x
    ),
    'leads_by_agent', (
      select coalesce(jsonb_agg(x order by x.total desc), '[]'::jsonb) from (
        select coalesce(pr.full_name, 'Sin asignar') as name, count(*) as total
        from l left join public.profiles pr on pr.id = l.agent_id group by 1) x
    ),
    'leads_by_source', (
      select coalesce(jsonb_agg(x order by x.total desc), '[]'::jsonb) from (
        select coalesce(ss.source, 'Directo') as name, count(*) as total
        from l left join public.analytics_sessions ss on ss.id = l.session_id group by 1) x
    )
  ) into v_result;

  return v_result;
end $$;
grant execute on function public.get_dashboard_stats(timestamptz, timestamptz, text) to authenticated;

-- ---------------------------------------------------------------------
-- RPC: ASESORES
-- ---------------------------------------------------------------------
-- Datos públicos del asesor para el detalle de propiedad (sin correo)
create or replace function public.get_public_agent(p_agent_id uuid)
returns table (id uuid, full_name text, avatar_url text, phone text, whatsapp text, title text, properties_count bigint)
language sql stable security definer set search_path = public as $$
  select pr.id, pr.full_name, pr.avatar_url, pr.phone, pr.whatsapp, pr.title,
         (select count(*) from public.properties p where p.agent_id = pr.id and p.status = 'active')
  from public.profiles pr
  where pr.id = p_agent_id and pr.role in ('admin','agent') and pr.active;
$$;
grant execute on function public.get_public_agent(uuid) to anon, authenticated;

-- Listado de asesores con métricas (solo admin)
create or replace function public.get_agents_overview()
returns table (
  id uuid, email text, full_name text, avatar_url text, phone text, whatsapp text, title text,
  role public.user_role, active boolean, created_at timestamptz, last_sign_in_at timestamptz,
  active_count bigint, draft_count bigint, finished_count bigint, leads_count bigint
) language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'No autorizado';
  end if;
  return query
  select pr.id, pr.email, pr.full_name, pr.avatar_url, pr.phone, pr.whatsapp, pr.title,
         pr.role, pr.active, pr.created_at, u.last_sign_in_at,
         count(p.id) filter (where p.status = 'active'),
         count(p.id) filter (where p.status = 'draft'),
         count(p.id) filter (where p.status = 'finished'),
         (select count(*) from public.leads l where l.agent_id = pr.id)
  from public.profiles pr
  left join auth.users u on u.id = pr.id
  left join public.properties p on p.agent_id = pr.id
  where pr.role in ('admin','agent')
  group by pr.id, u.last_sign_in_at
  order by pr.active desc, pr.full_name;
end $$;
grant execute on function public.get_agents_overview() to authenticated;

-- =====================================================================
-- CREAR TU PRIMER ADMINISTRADOR
-- 1) Supabase → Authentication → Users → "Add user" (correo + contraseña,
--    marca "Auto Confirm User").
-- 2) Ejecuta (cambia el correo):
--    update public.profiles set role = 'admin' where email = 'admin@espacioquerido.mx';
-- =====================================================================
