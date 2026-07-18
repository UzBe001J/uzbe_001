-- UzBe DevOps LMS uchun Supabase sozlamasi
-- Supabase dashboard -> SQL Editor -> New query -> shu faylni joylashtirib "Run" bosing.

create table if not exists kv_store (
  key text primary key,
  value text not null,
  updated_at timestamptz default now()
);

-- Bu jadval sayt tomonidan anon (publishable) kalit bilan o'qiladi/yoziladi,
-- shu sababli RLS'ni yoqib, anon rolga to'liq ruxsat beramiz.
alter table kv_store enable row level security;

drop policy if exists "kv_store_select_anon" on kv_store;
create policy "kv_store_select_anon" on kv_store
  for select to anon using (true);

drop policy if exists "kv_store_insert_anon" on kv_store;
create policy "kv_store_insert_anon" on kv_store
  for insert to anon with check (true);

drop policy if exists "kv_store_update_anon" on kv_store;
create policy "kv_store_update_anon" on kv_store
  for update to anon using (true) with check (true);

drop policy if exists "kv_store_delete_anon" on kv_store;
create policy "kv_store_delete_anon" on kv_store
  for delete to anon using (true);
