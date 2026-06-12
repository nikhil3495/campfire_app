-- ==========================================
-- CAMPFIRE - DATABASE MIGRATION SCHEMA (POSTGRESQL)
-- ==========================================

-- Enable UUID generation extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    phone VARCHAR(20) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE,
    email_verified BOOLEAN DEFAULT FALSE,
    is_premium BOOLEAN DEFAULT FALSE,
    subscription_type VARCHAR(20) DEFAULT 'free',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. COLLEGES TABLE
CREATE TABLE IF NOT EXISTS colleges (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    domain VARCHAR(100) UNIQUE, -- e.g., 'college.edu'
    city VARCHAR(100) NOT NULL
);

-- 3. PROFILES TABLE
CREATE TABLE IF NOT EXISTS profiles (
    id SERIAL PRIMARY KEY,
    user_id INT UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    age INT NOT NULL,
    gender VARCHAR(20) NOT NULL, -- 'male', 'female', 'non-binary'
    preference VARCHAR(20) NOT NULL, -- 'male', 'female', 'everyone'
    college_id INT REFERENCES colleges(id),
    course VARCHAR(100),
    grad_year INT,
    bio TEXT,
    prompts JSONB, -- Array of Hinge prompt answer objects: [{"question": "...", "answer": "..."}]
    interests VARCHAR(50)[], -- Array of selected interests
    image_url VARCHAR(255) DEFAULT '/assets/user_placeholder.png',
    image_urls VARCHAR(255)[],
    codename VARCHAR(50) DEFAULT 'Golden Griffin',
    aadhaar_number VARCHAR(12),
    student_id_card VARCHAR(255),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    is_onboarded BOOLEAN DEFAULT FALSE
);

-- 4. BLIND DATE QUEUE TABLE
CREATE TABLE IF NOT EXISTS blind_date_queue (
    id SERIAL PRIMARY KEY,
    user_id INT UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. BLIND DATES (MATCHES) TABLE
CREATE TABLE IF NOT EXISTS blind_dates (
    id SERIAL PRIMARY KEY,
    user1_id INT REFERENCES users(id) ON DELETE CASCADE,
    user2_id INT REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'blind', -- 'blind', 'revealed', 'ended'
    user1_reveal BOOLEAN DEFAULT FALSE,
    user2_reveal BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_pairing UNIQUE(user1_id, user2_id),
    CONSTRAINT check_users_differ CHECK (user1_id <> user2_id)
);

-- 6. MESSAGES TABLE
CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    blind_date_id INT REFERENCES blind_dates(id) ON DELETE CASCADE,
    sender_id INT REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    msg_type VARCHAR(10) DEFAULT 'text',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- SAFE MIGRATION UPDATES FOR EXISTING TABLES
-- ==========================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_type VARCHAR(20) DEFAULT 'free';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS image_urls VARCHAR(255)[];
ALTER TABLE messages ADD COLUMN IF NOT EXISTS msg_type VARCHAR(10) DEFAULT 'text';

-- ==========================================
-- INDEXES & PERFORMANCE OPTIMIZATIONS
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_college_id ON profiles(college_id);
CREATE INDEX IF NOT EXISTS idx_blind_date_queue_user ON blind_date_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_blind_dates_pairing ON blind_dates(user1_id, user2_id);
CREATE INDEX IF NOT EXISTS idx_messages_date ON messages(blind_date_id);

-- ==========================================
-- SEED INITIAL DATA
-- ==========================================
INSERT INTO colleges (name, domain, city) VALUES 
('Stanford University', 'stanford.edu', 'Stanford'),
('UC Berkeley', 'berkeley.edu', 'Berkeley'),
('MIT', 'mit.edu', 'Cambridge'),
('Harvard University', 'harvard.edu', 'Cambridge')
ON CONFLICT (domain) DO NOTHING;
