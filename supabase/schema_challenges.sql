-- =====================================================
-- TURBO GRYWALIZACJA - Rozszerzenie: Zadania eventowe
-- System wyzwan, wynikow i licytacji
-- =====================================================
-- Uruchom ten skrypt w SQL Editor w panelu Supabase
-- PO uruchomieniu glownego schema.sql

-- =====================================================
-- TABELA: challenges (zadania/wyzwania eventowe)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.challenges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,

    -- Typ zadania
    type TEXT NOT NULL CHECK (type IN (
        'team_timed',        -- Druzyna na czas (cala druzyna, ranking po czasie)
        'individual_timed',  -- Indywidualne na czas (wybrane osoby, TOP N)
        'team_task',         -- Zadanie druzynowe (admin przyznaje punkty)
        'individual_task',   -- Zadanie indywidualne
        'auction'            -- Licytacja
    )),

    -- Tryb punktowania
    points_mode TEXT NOT NULL CHECK (points_mode IN (
        'placement',    -- Punkty za miejsce (1., 2., 3. itd.)
        'top_n',        -- Tylko TOP N dostaje punkty
        'fixed',        -- Stala liczba punktow za wykonanie
        'auction_win'   -- Punkty za wygrana licytacje
    )),

    -- Rozklad punktow - JSONB np. {"1": 100, "2": 75, "3": 50, "4": 25, "5": 10}
    points_distribution JSONB DEFAULT '{"1": 100, "2": 75, "3": 50, "4": 25, "5": 10}'::jsonb,

    -- Dla fixed points_mode - ile punktow
    fixed_points INTEGER DEFAULT 50,

    -- Ile osob z druzyny moze uczestniczyc (NULL = cala druzyna)
    max_participants_per_team INTEGER,

    -- Status zadania
    status TEXT DEFAULT 'pending' CHECK (status IN (
        'pending',    -- Oczekuje na start
        'active',     -- W trakcie
        'scoring',    -- Admin wpisuje wyniki
        'completed'   -- Zakonczone, punkty przyznane
    )),

    -- Kolejnosc wyswietlania
    order_index INTEGER DEFAULT 0,

    -- Czas
    scheduled_start TIMESTAMPTZ,
    scheduled_end TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indeksy
CREATE INDEX IF NOT EXISTS idx_challenges_status ON public.challenges(status);
CREATE INDEX IF NOT EXISTS idx_challenges_type ON public.challenges(type);
CREATE INDEX IF NOT EXISTS idx_challenges_order ON public.challenges(order_index);

-- Trigger dla updated_at
DROP TRIGGER IF EXISTS update_challenges_updated_at ON public.challenges;
CREATE TRIGGER update_challenges_updated_at
    BEFORE UPDATE ON public.challenges
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- TABELA: challenge_results (wyniki zadan)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.challenge_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,

    -- Dla zadan indywidualnych - ktory uzytkownik
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,

    -- Wynik czasowy (w milisekundach)
    time_ms INTEGER,

    -- Wynik liczbowy (np. ilosc punktow w quizie)
    score INTEGER,

    -- Miejsce (obliczane automatycznie lub wpisywane recznie)
    placement INTEGER,

    -- Przyznane punkty (obliczane na podstawie placement i points_distribution)
    points_awarded INTEGER DEFAULT 0,

    -- Notatki admina
    admin_notes TEXT,

    -- Kto wpisal wynik
    recorded_by UUID REFERENCES public.users(id),
    recorded_at TIMESTAMPTZ DEFAULT NOW(),

    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

    -- Unikalne: jedna druzyna/osoba na zadanie
    UNIQUE(challenge_id, team_id, user_id)
);

-- Indeksy
CREATE INDEX IF NOT EXISTS idx_challenge_results_challenge ON public.challenge_results(challenge_id);
CREATE INDEX IF NOT EXISTS idx_challenge_results_team ON public.challenge_results(team_id);
CREATE INDEX IF NOT EXISTS idx_challenge_results_user ON public.challenge_results(user_id);
CREATE INDEX IF NOT EXISTS idx_challenge_results_placement ON public.challenge_results(placement);

-- =====================================================
-- TABELA: auctions (licytacje)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.auctions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    challenge_id UUID REFERENCES public.challenges(id) ON DELETE CASCADE,

    -- Przedmiot licytacji
    item_name TEXT NOT NULL,
    item_description TEXT,
    item_image_url TEXT,

    -- Ceny
    starting_price INTEGER DEFAULT 0 NOT NULL,
    min_bid_increment INTEGER DEFAULT 10 NOT NULL,
    current_price INTEGER DEFAULT 0 NOT NULL,

    -- Zwyciezca
    winning_team_id UUID REFERENCES public.teams(id),
    winning_user_id UUID REFERENCES public.users(id),
    winning_bid INTEGER,

    -- Status
    status TEXT DEFAULT 'pending' CHECK (status IN (
        'pending',   -- Oczekuje
        'active',    -- Trwa licytacja
        'ended',     -- Zakonczona
        'cancelled'  -- Anulowana
    )),

    -- Punkty za wygrana
    points_for_win INTEGER DEFAULT 100,

    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    ended_at TIMESTAMPTZ
);

-- Indeksy
CREATE INDEX IF NOT EXISTS idx_auctions_status ON public.auctions(status);
CREATE INDEX IF NOT EXISTS idx_auctions_challenge ON public.auctions(challenge_id);

-- =====================================================
-- TABELA: auction_bids (oferty w licytacjach)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.auction_bids (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auction_id UUID NOT NULL REFERENCES public.auctions(id) ON DELETE CASCADE,
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

    -- Kwota oferty
    bid_amount INTEGER NOT NULL,

    -- Czy to zwycieska oferta
    is_winning BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indeksy
CREATE INDEX IF NOT EXISTS idx_auction_bids_auction ON public.auction_bids(auction_id);
CREATE INDEX IF NOT EXISTS idx_auction_bids_team ON public.auction_bids(team_id);
CREATE INDEX IF NOT EXISTS idx_auction_bids_amount ON public.auction_bids(bid_amount DESC);

-- =====================================================
-- WIDOK: challenge_leaderboard (ranking zadan)
-- =====================================================
CREATE OR REPLACE VIEW public.challenge_leaderboard AS
SELECT
    cr.id,
    cr.challenge_id,
    c.title as challenge_title,
    c.type as challenge_type,
    cr.team_id,
    t.name as team_name,
    t.color as team_color,
    t.emoji as team_emoji,
    cr.user_id,
    u.nick as user_nick,
    cr.time_ms,
    cr.score,
    cr.placement,
    cr.points_awarded,
    cr.created_at
FROM public.challenge_results cr
JOIN public.challenges c ON c.id = cr.challenge_id
JOIN public.teams t ON t.id = cr.team_id
LEFT JOIN public.users u ON u.id = cr.user_id
ORDER BY cr.challenge_id, cr.placement ASC NULLS LAST, cr.time_ms ASC NULLS LAST;

-- =====================================================
-- WIDOK: individual_rankings (ranking indywidualny)
-- =====================================================
CREATE OR REPLACE VIEW public.individual_rankings AS
SELECT
    cr.user_id,
    u.nick,
    u.avatar_url,
    t.id as team_id,
    t.name as team_name,
    t.color as team_color,
    t.emoji as team_emoji,
    c.id as challenge_id,
    c.title as challenge_title,
    c.type as challenge_type,
    cr.time_ms,
    cr.score,
    cr.placement,
    cr.points_awarded
FROM public.challenge_results cr
JOIN public.users u ON u.id = cr.user_id
JOIN public.teams t ON t.id = cr.team_id
JOIN public.challenges c ON c.id = cr.challenge_id
WHERE cr.user_id IS NOT NULL
ORDER BY c.id, cr.placement ASC NULLS LAST, cr.time_ms ASC NULLS LAST;

-- =====================================================
-- FUNKCJA: Automatyczne obliczanie miejsc i punktow
-- =====================================================
CREATE OR REPLACE FUNCTION calculate_challenge_placements(p_challenge_id UUID)
RETURNS void AS $$
DECLARE
    v_challenge RECORD;
    v_result RECORD;
    v_placement INTEGER := 0;
    v_last_time INTEGER := NULL;
    v_points INTEGER;
BEGIN
    -- Pobierz dane zadania
    SELECT * INTO v_challenge FROM public.challenges WHERE id = p_challenge_id;

    IF v_challenge IS NULL THEN
        RAISE EXCEPTION 'Challenge not found';
    END IF;

    -- Resetuj miejsca
    UPDATE public.challenge_results SET placement = NULL, points_awarded = 0 WHERE challenge_id = p_challenge_id;

    -- Dla zadan na czas - sortuj po czasie
    IF v_challenge.type IN ('team_timed', 'individual_timed') THEN
        FOR v_result IN
            SELECT id, time_ms
            FROM public.challenge_results
            WHERE challenge_id = p_challenge_id AND time_ms IS NOT NULL
            ORDER BY time_ms ASC
        LOOP
            v_placement := v_placement + 1;

            -- Pobierz punkty za to miejsce
            v_points := COALESCE(
                (v_challenge.points_distribution->>v_placement::text)::integer,
                0
            );

            UPDATE public.challenge_results
            SET placement = v_placement, points_awarded = v_points
            WHERE id = v_result.id;
        END LOOP;
    ELSE
        -- Dla innych zadan - sortuj po score lub po kolejnosci wpisania
        FOR v_result IN
            SELECT id, score
            FROM public.challenge_results
            WHERE challenge_id = p_challenge_id
            ORDER BY score DESC NULLS LAST, created_at ASC
        LOOP
            v_placement := v_placement + 1;

            v_points := COALESCE(
                (v_challenge.points_distribution->>v_placement::text)::integer,
                0
            );

            -- Dla fixed mode - wszyscy dostaja tyle samo
            IF v_challenge.points_mode = 'fixed' THEN
                v_points := v_challenge.fixed_points;
            END IF;

            UPDATE public.challenge_results
            SET placement = v_placement, points_awarded = v_points
            WHERE id = v_result.id;
        END LOOP;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNKCJA: Przyznaj punkty druzynom z zadania
-- =====================================================
CREATE OR REPLACE FUNCTION award_challenge_points(p_challenge_id UUID)
RETURNS void AS $$
DECLARE
    v_result RECORD;
BEGIN
    -- Dla kazdego wyniku dodaj punkty do druzyny
    FOR v_result IN
        SELECT team_id, SUM(points_awarded) as total_points
        FROM public.challenge_results
        WHERE challenge_id = p_challenge_id AND points_awarded > 0
        GROUP BY team_id
    LOOP
        UPDATE public.teams
        SET total_xp = total_xp + v_result.total_points
        WHERE id = v_result.team_id;
    END LOOP;

    -- Oznacz zadanie jako zakonczone
    UPDATE public.challenges SET status = 'completed' WHERE id = p_challenge_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNKCJA: Zakoncz licytacje i przyznaj punkty
-- =====================================================
CREATE OR REPLACE FUNCTION end_auction(p_auction_id UUID)
RETURNS void AS $$
DECLARE
    v_auction RECORD;
    v_winning_bid RECORD;
BEGIN
    -- Pobierz licytacje
    SELECT * INTO v_auction FROM public.auctions WHERE id = p_auction_id;

    IF v_auction IS NULL OR v_auction.status != 'active' THEN
        RAISE EXCEPTION 'Auction not found or not active';
    END IF;

    -- Znajdz najwyzsza oferte
    SELECT * INTO v_winning_bid
    FROM public.auction_bids
    WHERE auction_id = p_auction_id
    ORDER BY bid_amount DESC
    LIMIT 1;

    IF v_winning_bid IS NOT NULL THEN
        -- Oznacz zwycieska oferte
        UPDATE public.auction_bids SET is_winning = TRUE WHERE id = v_winning_bid.id;

        -- Zaktualizuj licytacje
        UPDATE public.auctions SET
            status = 'ended',
            winning_team_id = v_winning_bid.team_id,
            winning_user_id = v_winning_bid.user_id,
            winning_bid = v_winning_bid.bid_amount,
            current_price = v_winning_bid.bid_amount,
            ended_at = NOW()
        WHERE id = p_auction_id;

        -- Przyznaj punkty druzynie
        UPDATE public.teams
        SET total_xp = total_xp + v_auction.points_for_win
        WHERE id = v_winning_bid.team_id;
    ELSE
        -- Brak ofert - anuluj
        UPDATE public.auctions SET status = 'cancelled', ended_at = NOW() WHERE id = p_auction_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

-- Wlacz RLS
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auctions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_bids ENABLE ROW LEVEL SECURITY;

-- Polityki dla challenges
CREATE POLICY "Anyone can view challenges" ON public.challenges
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage challenges" ON public.challenges
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true
    ));

-- Polityki dla challenge_results
CREATE POLICY "Anyone can view challenge results" ON public.challenge_results
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage challenge results" ON public.challenge_results
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true
    ));

-- Polityki dla auctions
CREATE POLICY "Anyone can view auctions" ON public.auctions
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage auctions" ON public.auctions
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true
    ));

-- Polityki dla auction_bids
CREATE POLICY "Anyone can view auction bids" ON public.auction_bids
    FOR SELECT USING (true);

CREATE POLICY "Users can create bids for their team" ON public.auction_bids
    FOR INSERT WITH CHECK (
        user_id = auth.uid() AND
        team_id = (SELECT team_id FROM public.users WHERE id = auth.uid())
    );

CREATE POLICY "Admins can manage auction bids" ON public.auction_bids
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true
    ));

-- =====================================================
-- PRZYKLADOWE DANE
-- =====================================================

-- Przykladowe zadania
INSERT INTO public.challenges (title, description, type, points_mode, points_distribution, order_index, status) VALUES
('Wyscig rowerowy', 'Kazda druzyna deleguje jednego zawodnika do wyscigu rowerowego. Mierzymy czas okrazenia.', 'individual_timed', 'top_n', '{"1": 150, "2": 100, "3": 75, "4": 50, "5": 25}', 1, 'pending'),
('Sztafeta druzynowa', 'Cala druzyna bierze udzial w sztafecie. Liczy sie laczny czas druzyny.', 'team_timed', 'placement', '{"1": 200, "2": 150, "3": 100, "4": 75, "5": 50}', 2, 'pending'),
('Quiz wiedzy', 'Przedstawiciel druzyny odpowiada na pytania. Punkty za poprawne odpowiedzi.', 'individual_task', 'placement', '{"1": 100, "2": 75, "3": 50, "4": 25, "5": 10}', 3, 'pending'),
('Budowanie wiezy', 'Druzyny buduja wieze z dostepnych materialow. Admin ocenia i przyznaje miejsca.', 'team_task', 'placement', '{"1": 150, "2": 100, "3": 75, "4": 50, "5": 25}', 4, 'pending')
ON CONFLICT DO NOTHING;

-- Przykladowa licytacja
INSERT INTO public.auctions (item_name, item_description, starting_price, min_bid_increment, points_for_win, status) VALUES
('Zloty puchar', 'Ekskluzywny zloty puchar dla zwycieskiej druzyny + bonus 200 punktow!', 50, 10, 200, 'pending'),
('Dodatkowe 30 minut przerwy', 'Druzyna wygrywa dodatkowa przerwe + 100 punktow', 30, 5, 100, 'pending')
ON CONFLICT DO NOTHING;

-- =====================================================
-- GOTOWE!
-- =====================================================
-- Po uruchomieniu tego skryptu masz:
-- 1. System zadan/wyzwan z roznymi typami
-- 2. Wyniki z automatycznym rankingiem
-- 3. System licytacji z historia ofert
-- 4. Funkcje do obliczania miejsc i przyznawania punktow
