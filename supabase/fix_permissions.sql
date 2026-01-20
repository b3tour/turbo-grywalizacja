-- =====================================================
-- NAPRAW UPRAWNIENIA - Uruchom w SQL Editor Supabase
-- =====================================================

-- 1. Wyłącz RLS na tabeli users
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

-- 2. Nadaj uprawnienia do tabeli users
GRANT SELECT, INSERT, UPDATE ON public.users TO anon;
GRANT SELECT, INSERT, UPDATE ON public.users TO authenticated;
GRANT ALL ON public.users TO service_role;

-- 3. Nadaj uprawnienia do sekwencji
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- 4. Utwórz funkcję RPC do sprawdzania nicka (obejście)
CREATE OR REPLACE FUNCTION check_nick_available(p_nick TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN NOT EXISTS (SELECT 1 FROM public.users WHERE nick = p_nick);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Utwórz funkcję RPC do pobierania profilu
CREATE OR REPLACE FUNCTION get_user_profile(p_user_id UUID)
RETURNS TABLE (
    id UUID,
    email TEXT,
    nick TEXT,
    phone TEXT,
    avatar_url TEXT,
    total_xp INTEGER,
    level INTEGER,
    class TEXT,
    is_admin BOOLEAN,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY SELECT
        u.id, u.email, u.nick, u.phone, u.avatar_url,
        u.total_xp, u.level, u.class, u.is_admin,
        u.created_at, u.updated_at
    FROM public.users u
    WHERE u.id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Utwórz funkcję RPC do tworzenia profilu
CREATE OR REPLACE FUNCTION create_user_profile(
    p_id UUID,
    p_email TEXT,
    p_nick TEXT,
    p_phone TEXT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    email TEXT,
    nick TEXT,
    phone TEXT,
    avatar_url TEXT,
    total_xp INTEGER,
    level INTEGER,
    class TEXT,
    is_admin BOOLEAN,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
) AS $$
BEGIN
    INSERT INTO public.users (id, email, nick, phone, total_xp, level, class, is_admin)
    VALUES (p_id, p_email, p_nick, p_phone, 0, 1, 'solo', false);

    RETURN QUERY SELECT
        u.id, u.email, u.nick, u.phone, u.avatar_url,
        u.total_xp, u.level, u.class, u.is_admin,
        u.created_at, u.updated_at
    FROM public.users u
    WHERE u.id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Nadaj uprawnienia do wywołania funkcji
GRANT EXECUTE ON FUNCTION check_nick_available(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_user_profile(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION create_user_profile(UUID, TEXT, TEXT, TEXT) TO anon, authenticated;
