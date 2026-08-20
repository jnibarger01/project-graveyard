create table if not exists graveyard_settings (
  user_id text primary key,
  humor_enabled boolean not null default true,
  github_username text,
  last_imported_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists graveyard_repos (
  id text not null,
  user_id text not null,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists graveyard_repos_user_idx on graveyard_repos (user_id);
