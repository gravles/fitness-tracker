-- Create favorite_foods table
create table if not exists favorite_foods (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  name text not null,
  calories numeric,
  protein numeric,
  carbs numeric,
  fat numeric,
  portion_estimate text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table favorite_foods enable row level security;

-- Create policies
create policy "Users can view their own favorites"
  on favorite_foods for select
  using (auth.uid() = user_id);

create policy "Users can insert their own favorites"
  on favorite_foods for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own favorites"
  on favorite_foods for delete
  using (auth.uid() = user_id);
