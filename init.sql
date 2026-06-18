-- ===== Bitki Profilleri =====
CREATE TABLE IF NOT EXISTS plant_profiles (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(100) NOT NULL,
    temp_min        NUMERIC(5,2) NOT NULL,
    temp_max        NUMERIC(5,2) NOT NULL,
    humidity_min    NUMERIC(5,2) NOT NULL,
    humidity_max    NUMERIC(5,2) NOT NULL,
    soil_min        INTEGER      NOT NULL CHECK (soil_min BETWEEN 0 AND 100),
    soil_max        INTEGER      NOT NULL CHECK (soil_max BETWEEN 0 AND 100),
    light_min       NUMERIC(8,2) NOT NULL,
    light_max       NUMERIC(8,2) NOT NULL,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ===== Otomasyon Kurallari =====
CREATE TABLE IF NOT EXISTS automation_rules (
    id          SERIAL PRIMARY KEY,
    device_id   VARCHAR(50) NOT NULL UNIQUE,
    profile_id  INTEGER     NOT NULL REFERENCES plant_profiles(id) ON DELETE RESTRICT,
    active      BOOLEAN     NOT NULL DEFAULT FALSE,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ===== Sensor Verileri =====
CREATE TABLE IF NOT EXISTS sensor_data (
    id              BIGSERIAL PRIMARY KEY,
    device_id       VARCHAR(50) NOT NULL,
    temperature     NUMERIC(5,2),
    humidity        NUMERIC(5,2),
    soil            INTEGER CHECK (soil BETWEEN 0 AND 100),
    light_lux       NUMERIC(8,2),
    flow_lpm        NUMERIC(6,2),
    recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sensor_data_device_time ON sensor_data (device_id, recorded_at DESC);

-- ===== Baslangic verisi (seed) =====
INSERT INTO plant_profiles
    (name, temp_min, temp_max, humidity_min, humidity_max, soil_min, soil_max, light_min, light_max)
SELECT 'Genel Sera Bitkisi', 15, 30, 40, 80, 30, 70, 200, 2000
WHERE NOT EXISTS (SELECT 1 FROM plant_profiles WHERE name = 'Genel Sera Bitkisi');

INSERT INTO automation_rules (device_id, profile_id, active)
SELECT 'sera_001', id, FALSE
FROM plant_profiles
WHERE name = 'Genel Sera Bitkisi'
ON CONFLICT (device_id) DO NOTHING;

