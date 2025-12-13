-- Daily Logs Table
create table daily_logs (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  date date not null,
  
  -- Movement
  movement_completed boolean default false,
  movement_type text,
  movement_duration integer, -- minutes
  movement_intensity text, -- Light, Moderate, Hard
  movement_notes text,
  
  -- Nutrition
  eating_window_start time,
  eating_window_end time,
  protein_grams integer,
  carbs_grams integer,
  fat_grams integer,
  calories integer,
  
  -- Alcohol
  alcohol_drinks integer default 0,
  alcohol_time time,
  
  -- Subjective Metrics
  sleep_quality integer check (sleep_quality between 1 and 5),
  energy_level integer check (energy_level between 1 and 5),
  motivation_level integer check (motivation_level between 1 and 5),
  stress_level integer check (stress_level between 1 and 5),
  daily_note text,
  
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  unique(user_id, date)
);

-- Body Metrics Table
create table body_metrics (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  date date not null,
  weight numeric(5,2), -- e.g. 180.50
  photo_url text,
  measurements jsonb, -- Flexible storage for waist, chest, etc.
  
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Saved Foods Table
create table saved_foods (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  name text not null,
  protein integer default 0,
  carbs integer default 0,
  fat integer default 0,
  calories integer default 0,
  
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS Policies

-- Daily Logs
alter table daily_logs enable row level security;

create policy "Users can view own daily logs"
  on daily_logs for select
  using ( auth.uid() = user_id );

create policy "Users can insert own daily logs"
  on daily_logs for insert
  with check ( auth.uid() = user_id );

create policy "Users can update own daily logs"
  on daily_logs for update
  using ( auth.uid() = user_id );

create policy "Users can delete own daily logs"
  on daily_logs for delete
  using ( auth.uid() = user_id );

-- Body Metrics
alter table body_metrics enable row level security;

create policy "Users can view own metrics"
  on body_metrics for select
  using ( auth.uid() = user_id );

create policy "Users can insert own metrics"
  on body_metrics for insert
  with check ( auth.uid() = user_id );

create policy "Users can update own metrics"
  on body_metrics for update
  using ( auth.uid() = user_id );

create policy "Users can delete own metrics"
  on body_metrics for delete
  using ( auth.uid() = user_id );

-- Saved Foods
alter table saved_foods enable row level security;

create policy "Users can view own saved foods"
  on saved_foods for select
  using ( auth.uid() = user_id );

create policy "Users can insert own saved foods"
  on saved_foods for insert
  with check ( auth.uid() = user_id );

create policy "Users can update own saved foods"
  on saved_foods for update
  using ( auth.uid() = user_id );

create policy "Users can delete own saved foods"
  on saved_foods for delete
  using ( auth.uid() = user_id );
