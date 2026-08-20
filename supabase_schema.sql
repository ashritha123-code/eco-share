-- ============================================================
-- EcoShare / EcoCircle Complete Supabase SQL Database Schema
-- Run this script in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/_/sql/new
-- ============================================================

-- 1. Users Table
CREATE TABLE IF NOT EXISTS public.users (
    uid TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    displayName TEXT,
    location TEXT DEFAULT 'Community Center',
    role TEXT DEFAULT 'resident',
    approved BOOLEAN DEFAULT true,
    status TEXT DEFAULT 'approved',
    savedResources JSONB DEFAULT '[]'::jsonb,
    activeSessionId TEXT,
    createdAt TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Resources Table
CREATE TABLE IF NOT EXISTS public.resources (
    resourceId TEXT PRIMARY KEY,
    ownerId TEXT REFERENCES public.users(uid) ON DELETE SET NULL,
    ownerName TEXT,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT DEFAULT 'Other',
    quantity TEXT DEFAULT '1',
    imageUrl TEXT,
    location TEXT DEFAULT 'Community Center',
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    status TEXT DEFAULT 'Available',
    createdAt TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Community Events Table (Fixes 404 PGRST205)
CREATE TABLE IF NOT EXISTS public.events (
    eventId TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    type TEXT DEFAULT 'General',
    date TIMESTAMPTZ,
    location TEXT,
    organizerName TEXT,
    organizerId TEXT,
    description TEXT,
    attendees JSONB DEFAULT '[]'::jsonb,
    createdAt TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Chats Table
CREATE TABLE IF NOT EXISTS public.chats (
    chatId TEXT PRIMARY KEY,
    resourceId TEXT,
    resourceTitle TEXT,
    lastMessage TEXT,
    lastMessageAt TIMESTAMPTZ DEFAULT NOW(),
    lastMessageSenderId TEXT,
    lastMessageSenderName TEXT,
    participants JSONB DEFAULT '[]'::jsonb,
    participantNames JSONB DEFAULT '{}'::jsonb
);

-- 5. Messages Table
CREATE TABLE IF NOT EXISTS public.messages (
    messageId TEXT PRIMARY KEY,
    chatId TEXT REFERENCES public.chats(chatId) ON DELETE CASCADE,
    senderId TEXT NOT NULL,
    senderName TEXT,
    content TEXT NOT NULL,
    createdAt TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Idempotent RLS Policies
DROP POLICY IF EXISTS "Allow public read/write users" ON public.users;
CREATE POLICY "Allow public read/write users" ON public.users FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read/write resources" ON public.resources;
CREATE POLICY "Allow public read/write resources" ON public.resources FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read/write events" ON public.events;
CREATE POLICY "Allow public read/write events" ON public.events FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read/write chats" ON public.chats;
CREATE POLICY "Allow public read/write chats" ON public.chats FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read/write messages" ON public.messages;
CREATE POLICY "Allow public read/write messages" ON public.messages FOR ALL USING (true) WITH CHECK (true);

-- Enable Realtime publication safely (ignores tables already in publication)
DO $$
DECLARE
    tbl text;
    tbls text[] := ARRAY['users', 'resources', 'events', 'chats', 'messages'];
BEGIN
    FOREACH tbl IN ARRAY tbls LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = tbl
        ) THEN
            EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
        END IF;
    END LOOP;
END $$;
