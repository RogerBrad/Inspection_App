-- Supabase schema for Inspection_ReactNatvie
-- Run this in the SQL editor of your Supabase project.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. User profiles used by LoginScreen and DebugScreen
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
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

-- Sample seed data for quick testing
INSERT INTO public.user_profiles (id, email, full_name, role, phone, metadata)
VALUES (
    'demo-tech',
    'tech@example.com',
    'Demo Technician',
    'technician',
    '+1-555-0100',
    '{"team":"field"}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.rental_agreements (id, status, agreement_data)
VALUES (
    'AGREEMENT-001',
    'Active',
    '{
        "assetDetails": {
            "assetName": "Ford Transit",
            "vin": "1HGCM82633A004352",
            "serialNumber": "SER-1001"
        },
        "assetCategory": "motor_vehicle",
        "parties": {
            "lesseeName": "Demo Lessee"
        },
        "endOfRental": {
            "inspectionDate": "2026-07-10"
        },
        "inspectionWorkflow": {
            "status": "Allocated",
            "technicianId": "demo-tech",
            "technicianName": "Demo Technician",
            "technicianEmail": "tech@example.com",
            "allocatedAt": 1751568000000,
            "nextInspectionDate": "2026-07-10"
        }
    }'::jsonb
)
ON CONFLICT (id) DO NOTHING;
