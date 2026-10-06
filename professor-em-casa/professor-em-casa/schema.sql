-- Professor em Casa: PostgreSQL / Supabase
-- A integridade por família é garantida também no banco (chaves compostas).

create table families (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  family_name text not null default '',
  guardian_name text not null default '',
  terms_accepted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table children (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  name text not null,
  birth_date date not null,
  grade text not null,
  reading_level text not null,
  math_level text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, family_id)
);

create table child_preferences (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null unique,
  family_id uuid not null,
  focus_areas text[] not null default '{}',        -- interesses
  other_languages text[] not null default '{}',
  difficult_subjects text[] not null default '{}',
  preferences text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (child_id, family_id) references children(id, family_id) on delete cascade
);

create table study_sessions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null,
  child_id uuid not null,
  subject text not null,
  topic text not null,
  status text not null default 'active' check (status in ('active','paused','completed')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  unique (id, family_id),
  foreign key (child_id, family_id) references children(id, family_id) on delete cascade
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null,
  session_id uuid not null,
  sender text not null check (sender in ('user','tutor')),
  content text not null,
  created_at timestamptz not null default now(),
  foreign key (session_id, family_id) references study_sessions(id, family_id) on delete cascade
);

-- Estrutura para a etapa de fotos de exercícios (ainda sem upload)
create table temp_images (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null,
  child_id uuid not null,
  session_id uuid not null,
  image_url text,
  storage_path text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '1 day',
  foreign key (child_id, family_id) references children(id, family_id) on delete cascade,
  foreign key (session_id, family_id) references study_sessions(id, family_id) on delete cascade
);

create index on children(family_id);
create index on study_sessions(family_id, started_at desc);
create index on messages(session_id, created_at);

create function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger t_families_upd before update on families for each row execute function set_updated_at();
create trigger t_children_upd before update on children for each row execute function set_updated_at();
create trigger t_prefs_upd before update on child_preferences for each row execute function set_updated_at();

-- Defesa extra no Supabase: RLS ligado e sem políticas = a API pública (anon) não lê nada.
-- O backend conecta como dono do banco e aplica o filtro family_id em toda consulta.
alter table families enable row level security;
alter table children enable row level security;
alter table child_preferences enable row level security;
alter table study_sessions enable row level security;
alter table messages enable row level security;
alter table temp_images enable row level security;
