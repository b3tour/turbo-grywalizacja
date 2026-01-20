-- =====================================================
-- AKTUALIZACJA: Limity zmiany nicku
-- Uruchom w SQL Editor Supabase
-- =====================================================

-- 1. Dodaj kolumny do śledzenia zmian nicku
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS nick_changes_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS pending_nick TEXT,
ADD COLUMN IF NOT EXISTS pending_nick_requested_at TIMESTAMPTZ;

-- 2. Funkcja do zmiany nicku z limitem
CREATE OR REPLACE FUNCTION request_nick_change(
    p_user_id UUID,
    p_new_nick TEXT
)
RETURNS TABLE (
    success BOOLEAN,
    message TEXT,
    requires_approval BOOLEAN
) AS $$
DECLARE
    v_current_changes INTEGER;
    v_nick_exists BOOLEAN;
BEGIN
    -- Sprawdź czy nick jest zajęty
    SELECT EXISTS(SELECT 1 FROM public.users WHERE nick = p_new_nick AND id != p_user_id) INTO v_nick_exists;

    IF v_nick_exists THEN
        RETURN QUERY SELECT false, 'Ten nick jest już zajęty'::TEXT, false;
        RETURN;
    END IF;

    -- Pobierz liczbę dotychczasowych zmian
    SELECT COALESCE(nick_changes_count, 0) INTO v_current_changes
    FROM public.users WHERE id = p_user_id;

    IF v_current_changes < 2 THEN
        -- Darmowa zmiana - od razu aktualizuj
        UPDATE public.users
        SET nick = p_new_nick,
            nick_changes_count = v_current_changes + 1,
            updated_at = NOW()
        WHERE id = p_user_id;

        RETURN QUERY SELECT true,
            ('Nick zmieniony. Pozostało darmowych zmian: ' || (1 - v_current_changes)::TEXT)::TEXT,
            false;
    ELSE
        -- Wymaga akceptacji admina
        UPDATE public.users
        SET pending_nick = p_new_nick,
            pending_nick_requested_at = NOW()
        WHERE id = p_user_id;

        RETURN QUERY SELECT true,
            'Prośba o zmianę nicku została wysłana do administratora'::TEXT,
            true;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Funkcja dla admina do zatwierdzania zmian nicku
CREATE OR REPLACE FUNCTION approve_nick_change(
    p_user_id UUID,
    p_approved BOOLEAN
)
RETURNS BOOLEAN AS $$
DECLARE
    v_pending_nick TEXT;
BEGIN
    SELECT pending_nick INTO v_pending_nick FROM public.users WHERE id = p_user_id;

    IF v_pending_nick IS NULL THEN
        RETURN false;
    END IF;

    IF p_approved THEN
        UPDATE public.users
        SET nick = pending_nick,
            nick_changes_count = nick_changes_count + 1,
            pending_nick = NULL,
            pending_nick_requested_at = NULL,
            updated_at = NOW()
        WHERE id = p_user_id;
    ELSE
        UPDATE public.users
        SET pending_nick = NULL,
            pending_nick_requested_at = NULL
        WHERE id = p_user_id;
    END IF;

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Nadaj uprawnienia
GRANT EXECUTE ON FUNCTION request_nick_change(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION approve_nick_change(UUID, BOOLEAN) TO authenticated;
