create table if not exists public.user_library_sync (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_library_sync enable row level security;

drop policy if exists "Users can read their own library sync" on public.user_library_sync;
create policy "Users can read their own library sync"
on public.user_library_sync
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own library sync" on public.user_library_sync;
create policy "Users can insert their own library sync"
on public.user_library_sync
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own library sync" on public.user_library_sync;
create policy "Users can update their own library sync"
on public.user_library_sync
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own library sync" on public.user_library_sync;
create policy "Users can delete their own library sync"
on public.user_library_sync
for delete
to authenticated
using (auth.uid() = user_id);

revoke all on public.user_library_sync from anon;
grant select, insert, update, delete on public.user_library_sync to authenticated;
