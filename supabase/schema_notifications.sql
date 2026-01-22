-- =====================================================
-- TURBO GRYWALIZACJA - System powiadomień/ogłoszeń
-- =====================================================

-- Tabela ogłoszeń (wysyłane przez admina)
CREATE TABLE IF NOT EXISTS public.announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(20) DEFAULT 'info', -- info, warning, success, urgent
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ, -- opcjonalne wygaśnięcie
    is_active BOOLEAN DEFAULT TRUE
);

-- Tabela przeczytanych ogłoszeń przez użytkowników
CREATE TABLE IF NOT EXISTS public.announcement_reads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    announcement_id UUID REFERENCES public.announcements(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    read_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(announcement_id, user_id)
);

-- Indeksy
CREATE INDEX IF NOT EXISTS idx_announcements_active ON public.announcements(is_active, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcement_reads_user ON public.announcement_reads(user_id);

-- RLS dla announcements
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Wszyscy mogą czytać aktywne ogłoszenia
CREATE POLICY "Anyone can read active announcements" ON public.announcements
    FOR SELECT USING (is_active = true);

-- Tylko admini mogą tworzyć/edytować ogłoszenia
CREATE POLICY "Admins can manage announcements" ON public.announcements
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true)
    );

-- RLS dla announcement_reads
ALTER TABLE public.announcement_reads ENABLE ROW LEVEL SECURITY;

-- Użytkownicy mogą zarządzać swoimi odczytami
CREATE POLICY "Users can manage their reads" ON public.announcement_reads
    FOR ALL USING (user_id = auth.uid());

-- Widok nieprzeczytanych ogłoszeń dla użytkownika
CREATE OR REPLACE VIEW public.unread_announcements AS
SELECT
    a.*,
    CASE WHEN ar.id IS NOT NULL THEN true ELSE false END as is_read
FROM public.announcements a
LEFT JOIN public.announcement_reads ar ON ar.announcement_id = a.id AND ar.user_id = auth.uid()
WHERE a.is_active = true
AND (a.expires_at IS NULL OR a.expires_at > NOW())
ORDER BY a.created_at DESC;

-- Funkcja do oznaczania ogłoszenia jako przeczytane
CREATE OR REPLACE FUNCTION mark_announcement_read(p_announcement_id UUID)
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.announcement_reads (announcement_id, user_id)
    VALUES (p_announcement_id, auth.uid())
    ON CONFLICT (announcement_id, user_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Uprawnienia
GRANT SELECT ON public.announcements TO authenticated;
GRANT SELECT ON public.unread_announcements TO authenticated;
GRANT ALL ON public.announcement_reads TO authenticated;
GRANT EXECUTE ON FUNCTION mark_announcement_read(UUID) TO authenticated;
