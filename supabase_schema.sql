-- ============================================================
-- CAR CARE CONNECT — SUPABASE SCHEMA
-- Run this entire file in Supabase SQL Editor
-- ============================================================

create extension if not exists "uuid-ossp";

-- PROFILES
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('customer','provider','driver','admin')),
  first_name text not null,
  last_name text not null,
  phone text,
  avatar_url text,
  is_active boolean default true,
  is_verified boolean default false,
  business_name text,
  business_address text,
  business_license text,
  business_description text,
  business_hours jsonb,
  vehicle_model text,
  vehicle_color text,
  vehicle_plate text,
  vehicle_year int,
  drivers_license text,
  is_online boolean default false,
  current_lat double precision,
  current_lng double precision,
  stripe_account_id text,
  bank_account_name text,
  bank_account_number text,
  bank_name text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- VEHICLES
create table public.vehicles (
  id uuid primary key default uuid_generate_v4(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  make text not null,
  model text not null,
  year int not null,
  color text,
  license_plate text not null,
  is_default boolean default false,
  image_url text,
  created_at timestamptz default now()
);

-- SERVICES
create table public.services (
  id uuid primary key default uuid_generate_v4(),
  provider_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  category text not null check (category in (
    'Oil Change','Brake Repair','Tire Service','Engine Repair',
    'AC Repair','Transmission','Detailing','Maintenance','Electrical','Body Repair'
  )),
  price numeric(10,2) not null,
  discounted_price numeric(10,2),
  duration_minutes int not null default 60,
  is_active boolean default true,
  image_url text,
  tags text[],
  requirements text[],
  inclusions text[],
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- BOOKINGS
create table public.bookings (
  id uuid primary key default uuid_generate_v4(),
  booking_number text unique not null default 'BK-' || upper(substring(uuid_generate_v4()::text, 1, 8)),
  customer_id uuid not null references public.profiles(id),
  provider_id uuid not null references public.profiles(id),
  service_id uuid not null references public.services(id),
  service_name text not null,
  vehicle_id uuid references public.vehicles(id),
  booking_date date not null,
  booking_time time not null,
  total_amount numeric(10,2) not null,
  status text not null default 'pending' check (status in ('pending','confirmed','in_progress','completed','cancelled')),
  payment_status text not null default 'pending' check (payment_status in ('pending','paid','refunded')),
  payment_method text check (payment_method in ('stripe','cash','mpesa')),
  is_concierge boolean default false,
  pickup_address text,
  driver_id uuid references public.profiles(id),
  notes text,
  promo_code text,
  discount_amount numeric(10,2) default 0,
  platform_commission numeric(10,2),
  provider_earnings numeric(10,2),
  driver_earnings numeric(10,2),
  stripe_payment_intent text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- REVIEWS
create table public.reviews (
  id uuid primary key default uuid_generate_v4(),
  booking_id uuid not null references public.bookings(id),
  customer_id uuid not null references public.profiles(id),
  provider_id uuid references public.profiles(id),
  driver_id uuid references public.profiles(id),
  provider_rating int check (provider_rating between 1 and 5),
  driver_rating int check (driver_rating between 1 and 5),
  comment text,
  provider_reply text,
  is_hidden boolean default false,
  created_at timestamptz default now()
);

-- LOYALTY POINTS
create table public.loyalty_points (
  id uuid primary key default uuid_generate_v4(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  points int not null,
  action text not null check (action in ('earned','redeemed')),
  description text,
  booking_id uuid references public.bookings(id),
  created_at timestamptz default now()
);

-- PROMO CODES
create table public.promo_codes (
  id uuid primary key default uuid_generate_v4(),
  code text unique not null,
  discount_type text not null check (discount_type in ('percentage','fixed')),
  discount_value numeric(10,2) not null,
  minimum_purchase numeric(10,2) default 0,
  max_uses int,
  uses_count int default 0,
  expires_at timestamptz,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- NOTIFICATIONS
create table public.notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  message text not null,
  type text default 'info' check (type in ('info','success','warning','error')),
  is_read boolean default false,
  booking_id uuid references public.bookings(id),
  created_at timestamptz default now()
);

-- PAYOUT REQUESTS
create table public.payout_requests (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id),
  amount numeric(10,2) not null,
  status text default 'pending' check (status in ('pending','approved','rejected','paid')),
  bank_account_name text,
  bank_account_number text,
  bank_name text,
  admin_note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- REFUND REQUESTS
create table public.refund_requests (
  id uuid primary key default uuid_generate_v4(),
  booking_id uuid not null references public.bookings(id),
  customer_id uuid not null references public.profiles(id),
  reason text not null,
  status text default 'pending' check (status in ('pending','approved','rejected')),
  amount numeric(10,2) not null,
  admin_note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- TRIGGERS
create or replace function update_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

create trigger trg_profiles_updated before update on profiles for each row execute function update_updated_at();
create trigger trg_services_updated before update on services for each row execute function update_updated_at();
create trigger trg_bookings_updated before update on bookings for each row execute function update_updated_at();

-- AUTO-CREATE PROFILE ON SIGNUP
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, role, first_name, last_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'customer'),
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', ''),
    coalesce(new.raw_user_meta_data->>'phone', null)
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ROW LEVEL SECURITY
alter table profiles enable row level security;
alter table vehicles enable row level security;
alter table services enable row level security;
alter table bookings enable row level security;
alter table reviews enable row level security;
alter table loyalty_points enable row level security;
alter table promo_codes enable row level security;
alter table notifications enable row level security;
alter table payout_requests enable row level security;
alter table refund_requests enable row level security;

create policy "profiles_select" on profiles for select using (auth.uid() = id or exists (select 1 from profiles where id = auth.uid() and role = 'admin'));
create policy "profiles_update" on profiles for update using (auth.uid() = id);
create policy "vehicles_all" on vehicles for all using (customer_id = auth.uid());
create policy "services_read" on services for select using (is_active = true or provider_id = auth.uid());
create policy "services_write" on services for all using (provider_id = auth.uid());
create policy "bookings_select" on bookings for select using (customer_id = auth.uid() or provider_id = auth.uid() or driver_id = auth.uid() or exists (select 1 from profiles where id = auth.uid() and role = 'admin'));
create policy "bookings_insert" on bookings for insert with check (customer_id = auth.uid());
create policy "bookings_update" on bookings for update using (customer_id = auth.uid() or provider_id = auth.uid() or driver_id = auth.uid() or exists (select 1 from profiles where id = auth.uid() and role = 'admin'));
create policy "notifs_all" on notifications for all using (user_id = auth.uid());
create policy "loyalty_all" on loyalty_points for all using (customer_id = auth.uid());
create policy "promos_read" on promo_codes for select using (is_active = true);
create policy "promos_write" on promo_codes for all using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));
create policy "reviews_read" on reviews for select using (is_hidden = false);
create policy "reviews_insert" on reviews for insert with check (customer_id = auth.uid());
create policy "reviews_update" on reviews for update using (provider_id = auth.uid() or exists (select 1 from profiles where id = auth.uid() and role = 'admin'));
create policy "payouts_all" on payout_requests for all using (user_id = auth.uid() or exists (select 1 from profiles where id = auth.uid() and role = 'admin'));
create policy "refunds_all" on refund_requests for all using (customer_id = auth.uid() or exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

-- REALTIME
alter publication supabase_realtime add table bookings;
alter publication supabase_realtime add table notifications;
alter publication supabase_realtime add table profiles;

-- SEED
insert into promo_codes (code, discount_type, discount_value, minimum_purchase, max_uses, expires_at)
values ('WELCOME20', 'percentage', 20, 30, 100, now() + interval '90 days');
