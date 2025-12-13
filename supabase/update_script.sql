-- 1. Fix Body Metrics Table (Add Unique Constraint)
ALTER TABLE body_metrics 
ADD CONSTRAINT body_metrics_user_id_date_key UNIQUE (user_id, date);

-- 2. Create User Settings Table
create table if not exists user_settings (
  user_id uuid references auth.users not null primary key,
  target_weight numeric(5,2),
  target_calories integer,
  target_protein integer,
  
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Enable RLS for User Settings
alter table user_settings enable row level security;

-- 4. Add Policies for User Settings (Drop first to avoid errors)
drop policy if exists "Users can view own settings" on user_settings;
create policy "Users can view own settings"
  on user_settings for select
  using ( auth.uid() = user_id );

drop policy if exists "Users can insert own settings" on user_settings;
create policy "Users can insert own settings"
  on user_settings for insert
  with check ( auth.uid() = user_id );

drop policy if exists "Users can update own settings" on user_settings;
create policy "Users can update own settings"
  on user_settings for update
  using ( auth.uid() = user_id );

drop policy if exists "Users can delete own settings" on user_settings;
create policy "Users can delete own settings"
  on user_settings for delete
  using ( auth.uid() = user_id );
