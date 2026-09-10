-- Powerball PWA server-side data model
-- Run this in the Supabase SQL Editor after creating a project.

create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  drawing_date date not null,
  label text not null check (char_length(trim(label)) between 1 and 40),
  numbers integer[] not null check (
    cardinality(numbers) = 5
    and numbers <@ array[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69]
  ),
  powerball integer not null check (powerball between 1 and 26),
  double_play boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tickets_user_drawing_label_unique unique (user_id, drawing_date, label)
);

create index if not exists tickets_user_drawing_date_idx
  on public.tickets (user_id, drawing_date desc);

alter table public.tickets enable row level security;

drop policy if exists "Users can view their own tickets" on public.tickets;
create policy "Users can view their own tickets"
  on public.tickets for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can create their own tickets" on public.tickets;
create policy "Users can create their own tickets"
  on public.tickets for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own tickets" on public.tickets;
create policy "Users can update their own tickets"
  on public.tickets for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own tickets" on public.tickets;
create policy "Users can delete their own tickets"
  on public.tickets for delete
  to authenticated
  using (auth.uid() = user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tickets_set_updated_at on public.tickets;
create trigger tickets_set_updated_at
before update on public.tickets
for each row execute function public.set_updated_at();
