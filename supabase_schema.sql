-- Supabase schema for Inspection_ReactNatvie
-- Run this in the SQL editor of your Supabase project.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. User profiles used by LoginScreen and DebugScreen
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    first_name TEXT,
    surname TEXT,
    role TEXT DEFAULT 'technician',
    phone TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Rental agreements with inspection workflow state
CREATE TABLE IF NOT EXISTS public.rental_agreements (
    id TEXT PRIMARY KEY,
    status TEXT NOT NULL DEFAULT 'Draft',
    agreement_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Vehicle photo records used by the photo comparison flow
CREATE TABLE IF NOT EXISTS public.vehicle_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vin TEXT,
    registration_number TEXT,
    photo_url TEXT NOT NULL,
    angle TEXT NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Inspection configuration templates for the different asset categories
CREATE TABLE IF NOT EXISTS public.inspection_configs (
    id TEXT PRIMARY KEY,
    category TEXT UNIQUE NOT NULL,
    inspection_types JSONB NOT NULL DEFAULT '[]'::jsonb,
    areas JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Completed inspections saved from the app
CREATE TABLE IF NOT EXISTS public.inspections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id TEXT NOT NULL,
    asset_category TEXT NOT NULL,
    inspection_type_id TEXT NOT NULL,
    inspection_type_label TEXT NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    results JSONB NOT NULL DEFAULT '[]'::jsonb,
    odometer TEXT,
    summary JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure user_profiles has the expected columns if the table already existed
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS surname TEXT;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'technician';
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL;

-- Make sure email has a unique constraint if we just added it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'user_profiles_email_key'
    ) THEN
        ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_email_key UNIQUE (email);
    END IF;
END $$;

-- Drop NOT NULL constraint on company_id if it exists to allow seed inserts
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'user_profiles' 
          AND column_name = 'company_id'
    ) THEN
        ALTER TABLE public.user_profiles ALTER COLUMN company_id DROP NOT NULL;
    END IF;
END $$;

-- Drop NOT NULL constraint on company_id in rental_agreements if it exists to allow seed inserts
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'rental_agreements' 
          AND column_name = 'company_id'
    ) THEN
        ALTER TABLE public.rental_agreements ALTER COLUMN company_id DROP NOT NULL;
    END IF;
END $$;

-- Drop NOT NULL constraint on lessee_customer_id in rental_agreements if it exists to allow seed inserts
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'rental_agreements' 
          AND column_name = 'lessee_customer_id'
    ) THEN
        ALTER TABLE public.rental_agreements ALTER COLUMN lessee_customer_id DROP NOT NULL;
    END IF;
END $$;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles (email);
CREATE INDEX IF NOT EXISTS idx_rental_agreements_status ON public.rental_agreements (status);
CREATE INDEX IF NOT EXISTS idx_rental_agreements_agreement_data_gin ON public.rental_agreements USING gin (agreement_data);
CREATE INDEX IF NOT EXISTS idx_vehicle_photos_vin ON public.vehicle_photos (vin);
CREATE INDEX IF NOT EXISTS idx_inspections_asset_id ON public.inspections (asset_id);
CREATE INDEX IF NOT EXISTS idx_inspections_asset_category ON public.inspections (asset_category);

-- Enable RLS and allow the app to read/write via the anon key
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rental_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspection_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspections ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to prevent errors on re-run
DROP POLICY IF EXISTS user_profiles_policy ON public.user_profiles;
DROP POLICY IF EXISTS rental_agreements_policy ON public.rental_agreements;
DROP POLICY IF EXISTS vehicle_photos_policy ON public.vehicle_photos;
DROP POLICY IF EXISTS inspection_configs_policy ON public.inspection_configs;
DROP POLICY IF EXISTS inspections_policy ON public.inspections;

CREATE POLICY user_profiles_policy ON public.user_profiles
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY rental_agreements_policy ON public.rental_agreements
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY vehicle_photos_policy ON public.vehicle_photos
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY inspection_configs_policy ON public.inspection_configs
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY inspections_policy ON public.inspections
    FOR ALL USING (true) WITH CHECK (true);

-- Seed default inspection configuration data
INSERT INTO public.inspection_configs (id, category, inspection_types, areas)
VALUES (
    'motor_vehicle',
    'motor_vehicle',
    '[
        {
            "id": "road_worthy",
            "label": "Road Worthy Inspection",
            "items": [
                {"label": "Tires", "subItems": ["Front Left Tread", "Front Right Tread", "Rear Left Tread", "Rear Right Tread", "Spare Wheel Condition"]},
                {"label": "Brakes", "subItems": ["Pad Thickness", "Disc Surface", "Brake Lines", "Fluid Level", "Handbrake tension"]},
                {"label": "Lights", "subItems": ["Headlights", "Indicators", "Brake Lights", "Reverse Lights", "Fog Lights"]}
            ]
        },
        {
            "id": "full_inspection",
            "label": "Full Inspection",
            "items": [
                {"label": "Fluid Levels", "subItems": ["Engine Oil", "Coolant", "Windshield Wash", "Brake Fluid", "Transmission Fluid"]},
                {"label": "Battery", "subItems": ["Voltage Check", "Terminal Corrosion", "Mounting", "Age check"]}
            ]
        }
    ]'::jsonb,
    '["Front", "Rear", "Left", "Right", "Interior", "Engine"]'::jsonb
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.inspection_configs (id, category, inspection_types, areas)
VALUES (
    'refrigeration',
    'refrigeration',
    '[
        {
            "id": "grv_inspection",
            "label": "GRV Inspection",
            "items": [
                {"label": "Verification", "subItems": ["Model Match", "Serial Number Scan", "Voltage Rating", "Phase check"]},
                {"label": "Physical", "subItems": ["Dents/Scratches", "Paint Finish", "Gasket Condition", "Packaging integrity"]}
            ]
        },
        {
            "id": "pre_delivery",
            "label": "Pre Delivery Inspection",
            "items": [
                {"label": "Performance", "subItems": ["Temperature Drop", "Thermostat Cycle", "Fan Speed", "Defrost system"]},
                {"label": "Electronics", "subItems": ["Display Panel", "Interior Light", "Alarm system", "Remote Control"]}
            ]
        }
    ]'::jsonb,
    '["Compressor", "Condenser", "Evaporator", "Control Panel", "Door Seals"]'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- Default configurations seeded above are complete.
-- No sample testing records are seeded here to prevent foreign key and multi-tenant constraint violations.
