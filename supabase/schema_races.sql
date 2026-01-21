-- =====================================================
-- TURBO GRYWALIZACJA - Rozszerzenie: Misje wyścigowe
-- System wyścigów drużynowych z automatycznym rankingiem
-- =====================================================
-- Uruchom ten skrypt w SQL Editor w panelu Supabase

-- =====================================================
-- ROZSZERZENIE TABELI: missions (dodaj pola wyścigu)
-- =====================================================

-- Czy misja jest wyścigiem (drużyny rywalizują o miejsca)
ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS is_race BOOLEAN DEFAULT FALSE;

-- Kiedy admin wystartował wyścig
ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS race_started_at TIMESTAMPTZ;

-- Punkty za miejsca w wyścigu (JSONB: {"1": 100, "2": 75, "3": 50, ...})
ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS race_points_distribution JSONB DEFAULT '{"1": 100, "2": 75, "3": 50, "4": 25, "5": 10}'::jsonb;

-- Czy wyścig jest aktywny (started but not ended)
ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS race_active BOOLEAN DEFAULT FALSE;

-- Kiedy wyścig został zakończony
ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS race_ended_at TIMESTAMPTZ;

-- =====================================================
-- ROZSZERZENIE TABELI: submissions (dodaj miejsce)
-- =====================================================

-- Miejsce w wyścigu (1, 2, 3, ...)
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS placement INTEGER;

-- Czas od startu wyścigu do zgłoszenia (w ms)
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS race_time_ms INTEGER;

-- Indeks dla szybkiego wyszukiwania miejsc
CREATE INDEX IF NOT EXISTS idx_submissions_placement ON public.submissions(placement);

-- =====================================================
-- FUNKCJA: Rozpocznij wyścig
-- =====================================================
CREATE OR REPLACE FUNCTION start_race(p_mission_id UUID)
RETURNS JSON AS $$
DECLARE
    v_mission RECORD;
BEGIN
    -- Sprawdź czy misja istnieje i jest wyścigiem
    SELECT * INTO v_mission FROM public.missions WHERE id = p_mission_id;

    IF v_mission IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Misja nie istnieje');
    END IF;

    IF NOT v_mission.is_race THEN
        RETURN json_build_object('success', false, 'error', 'Ta misja nie jest wyścigiem');
    END IF;

    IF v_mission.race_active THEN
        RETURN json_build_object('success', false, 'error', 'Wyścig już trwa');
    END IF;

    -- Rozpocznij wyścig
    UPDATE public.missions
    SET
        race_active = TRUE,
        race_started_at = NOW(),
        race_ended_at = NULL,
        status = 'active'
    WHERE id = p_mission_id;

    -- Wyczyść poprzednie zgłoszenia dla tego wyścigu (jeśli były)
    DELETE FROM public.submissions WHERE mission_id = p_mission_id;

    RETURN json_build_object('success', true, 'error', null, 'started_at', NOW());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNKCJA: Zakończ wyścig
-- =====================================================
CREATE OR REPLACE FUNCTION end_race(p_mission_id UUID)
RETURNS JSON AS $$
DECLARE
    v_mission RECORD;
BEGIN
    SELECT * INTO v_mission FROM public.missions WHERE id = p_mission_id;

    IF v_mission IS NULL OR NOT v_mission.is_race THEN
        RETURN json_build_object('success', false, 'error', 'Nieprawidłowa misja wyścigowa');
    END IF;

    IF NOT v_mission.race_active THEN
        RETURN json_build_object('success', false, 'error', 'Wyścig nie jest aktywny');
    END IF;

    -- Zakończ wyścig
    UPDATE public.missions
    SET
        race_active = FALSE,
        race_ended_at = NOW(),
        status = 'inactive'
    WHERE id = p_mission_id;

    RETURN json_build_object('success', true, 'error', null);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNKCJA: Zatwierdź zgłoszenie wyścigu i przyznaj miejsce
-- =====================================================
CREATE OR REPLACE FUNCTION approve_race_submission(
    p_submission_id UUID,
    p_admin_id UUID
)
RETURNS JSON AS $$
DECLARE
    v_submission RECORD;
    v_mission RECORD;
    v_placement INTEGER;
    v_points INTEGER;
    v_race_time INTEGER;
    v_user RECORD;
BEGIN
    -- Pobierz zgłoszenie
    SELECT * INTO v_submission FROM public.submissions WHERE id = p_submission_id;

    IF v_submission IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Zgłoszenie nie istnieje');
    END IF;

    IF v_submission.status = 'approved' THEN
        RETURN json_build_object('success', false, 'error', 'Zgłoszenie już zatwierdzone');
    END IF;

    -- Pobierz misję
    SELECT * INTO v_mission FROM public.missions WHERE id = v_submission.mission_id;

    IF NOT v_mission.is_race THEN
        RETURN json_build_object('success', false, 'error', 'To nie jest misja wyścigowa');
    END IF;

    -- Oblicz miejsce (ile już zatwierdzonych + 1)
    SELECT COUNT(*) + 1 INTO v_placement
    FROM public.submissions
    WHERE mission_id = v_submission.mission_id
    AND status = 'approved';

    -- Oblicz czas od startu wyścigu
    IF v_mission.race_started_at IS NOT NULL THEN
        v_race_time := EXTRACT(EPOCH FROM (v_submission.created_at - v_mission.race_started_at)) * 1000;
    END IF;

    -- Pobierz punkty za to miejsce
    v_points := COALESCE(
        (v_mission.race_points_distribution->>v_placement::text)::integer,
        0
    );

    -- Zaktualizuj zgłoszenie
    UPDATE public.submissions
    SET
        status = 'approved',
        placement = v_placement,
        race_time_ms = v_race_time,
        xp_awarded = v_points,
        reviewed_by = p_admin_id,
        reviewed_at = NOW()
    WHERE id = p_submission_id;

    -- Dodaj XP użytkownikowi
    IF v_points > 0 THEN
        -- Pobierz użytkownika żeby zaktualizować XP drużyny
        SELECT * INTO v_user FROM public.users WHERE id = v_submission.user_id;

        UPDATE public.users
        SET total_xp = total_xp + v_points,
            level = calculate_level(total_xp + v_points)
        WHERE id = v_submission.user_id;

        -- Zaktualizuj XP drużyny
        IF v_user.team_id IS NOT NULL THEN
            UPDATE public.teams
            SET total_xp = total_xp + v_points
            WHERE id = v_user.team_id;
        END IF;
    END IF;

    RETURN json_build_object(
        'success', true,
        'error', null,
        'placement', v_placement,
        'points', v_points,
        'race_time_ms', v_race_time
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- WIDOK: Ranking wyścigu
-- =====================================================
CREATE OR REPLACE VIEW public.race_leaderboard AS
SELECT
    s.id as submission_id,
    s.mission_id,
    m.title as mission_title,
    s.user_id,
    u.nick as user_nick,
    u.avatar_url,
    u.team_id,
    t.name as team_name,
    t.color as team_color,
    t.emoji as team_emoji,
    s.placement,
    s.race_time_ms,
    s.xp_awarded as points_awarded,
    s.status,
    s.created_at as submitted_at,
    m.race_started_at
FROM public.submissions s
JOIN public.missions m ON m.id = s.mission_id
JOIN public.users u ON u.id = s.user_id
LEFT JOIN public.teams t ON t.id = u.team_id
WHERE m.is_race = TRUE
ORDER BY s.mission_id, s.placement ASC NULLS LAST, s.created_at ASC;

-- =====================================================
-- UPRAWNIENIA
-- =====================================================
GRANT EXECUTE ON FUNCTION start_race(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION end_race(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION approve_race_submission(UUID, UUID) TO authenticated;

-- =====================================================
-- GOTOWE!
-- =====================================================
-- Teraz możesz:
-- 1. Tworzyć misje z is_race = true
-- 2. Startować wyścig funkcją start_race()
-- 3. Gracze wysyłają zgłoszenia normalnie
-- 4. Admin zatwierdza funkcją approve_race_submission()
-- 5. System automatycznie liczy miejsca i punkty
