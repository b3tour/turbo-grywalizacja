# Turbo Grywalizacja - Instrukcja Wdrozenia

Kompletny przewodnik uruchomienia aplikacji grywalizacyjnej Turbo Grywalizacja (tryb druzynowy).

---

## O aplikacji

**Turbo Grywalizacja** to wersja druzynowa systemu grywalizacji. Uzytkownicy rywalizuja w 5 druzynach:
- Turbo Racers (czerwony)
- Speed Demons (niebieski)
- Power Squad (zielony)
- Nitro Force (pomaranczowy)
- Thunder Team (fioletowy)

**WAZNE:** Ta aplikacja wymaga OSOBNEGO projektu Supabase (nie tego samego co Turbo Challenge).

---

## Spis tresci

1. [Wymagania wstepne](#1-wymagania-wstepne)
2. [Konfiguracja Supabase](#2-konfiguracja-supabase)
3. [Konfiguracja projektu lokalnie](#3-konfiguracja-projektu-lokalnie)
4. [Deployment na Vercel](#4-deployment-na-vercel)
5. [Pierwsze uruchomienie](#5-pierwsze-uruchomienie)
6. [Zarzadzanie druzynami](#6-zarzadzanie-druzynami)

---

## 1. Wymagania wstepne

### Potrzebne konta (wszystkie darmowe):
- **Supabase** - https://supabase.com (baza danych + autoryzacja)
- **Vercel** - https://vercel.com (hosting)
- **GitHub** - https://github.com (repozytorium kodu)
- **Google Cloud Console** - https://console.cloud.google.com (logowanie Google)

### Oprogramowanie na komputerze:
- **Node.js** (wersja 18+) - https://nodejs.org
- **Git** - https://git-scm.com
- **Edytor kodu** (np. VS Code) - https://code.visualstudio.com

---

## 2. Konfiguracja Supabase

### Krok 2.1: Utworz NOWY projekt

1. Wejdz na https://supabase.com i zaloguj sie
2. Kliknij **"New Project"**
3. Wypelnij:
   - **Name**: `turbo-grywalizacja`
   - **Database Password**: wygeneruj silne haslo (zapisz je!)
   - **Region**: `Central EU (Frankfurt)` - najblizej Polski
4. Kliknij **"Create new project"** i poczekaj ~2 minuty

### Krok 2.2: Uruchom schemat bazy danych

1. W panelu Supabase przejdz do **SQL Editor** (ikona w lewym menu)
2. Kliknij **"New query"**
3. Skopiuj cala zawartosc pliku `supabase/schema.sql`
4. Wklej do edytora SQL
5. Kliknij **"Run"** (zielony przycisk)
6. Powinny pojawic sie zielone znaczniki sukcesu

**WAZNE:** Schemat automatycznie utworzy 5 domyslnych druzyn!

### Krok 2.3: Skonfiguruj Storage (dla zdjec)

1. Przejdz do **Storage** w lewym menu
2. Kliknij **"New bucket"**
3. Wypelnij:
   - **Name**: `mission-photos`
   - **Public bucket**: TAK (zaznacz)
4. Kliknij **"Create bucket"**

### Krok 2.4: Wlacz autoryzacje Email i Google

1. Przejdz do **Authentication** -> **Providers**
2. Wlacz **Email**
3. Wlacz **Google** i skonfiguruj OAuth w Google Cloud Console

### Krok 2.5: Zapisz dane dostepowe

Przejdz do **Settings** -> **API** i zapisz:
- **Project URL** (np. `https://abcdefgh.supabase.co`)
- **anon/public key** (dlugi klucz zaczynajacy sie od `eyJ...`)

---

## 3. Konfiguracja projektu lokalnie

### Krok 3.1: Otworz terminal w folderze projektu

```bash
cd "C:\Users\WORK\Desktop\Aplikacja Turbo\turbo-grywalizacja"
```

### Krok 3.2: Utworz plik zmiennych srodowiskowych

Skopiuj przykladowy plik:
```bash
copy .env.local.example .env.local
```

### Krok 3.3: Edytuj .env.local

Otworz plik `.env.local` w edytorze i wypelnij:

```env
NEXT_PUBLIC_SUPABASE_URL=https://TWOJ-PROJEKT-GRYWALIZACJA.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=Turbo Grywalizacja
```

### Krok 3.4: Zainstaluj zaleznosci

```bash
npm install
```

### Krok 3.5: Uruchom lokalnie (test)

```bash
npm run dev
```

Otworz http://localhost:3000 w przegladarce.

---

## 4. Deployment na Vercel

### Krok 4.1: Przeslij kod na GitHub

1. Utworz nowe repozytorium na GitHub (prywatne): `turbo-grywalizacja`
2. W terminalu:

```bash
git init
git add .
git commit -m "Initial commit - Turbo Grywalizacja"
git branch -M main
git remote add origin https://github.com/TWOJ-USERNAME/turbo-grywalizacja.git
git push -u origin main
```

### Krok 4.2: Polacz z Vercel

1. Wejdz na https://vercel.com i zaloguj sie przez GitHub
2. Kliknij **"Add New..."** -> **"Project"**
3. Wybierz repozytorium `turbo-grywalizacja`

### Krok 4.3: Dodaj zmienne srodowiskowe

| Name | Value |
|------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://twoj-projekt-grywalizacja.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` (twoj klucz) |
| `NEXT_PUBLIC_APP_URL` | `https://turbo-grywalizacja.vercel.app` |
| `NEXT_PUBLIC_APP_NAME` | `Turbo Grywalizacja` |

### Krok 4.4: Deploy

1. Kliknij **"Deploy"**
2. Po zakonczeniu otrzymasz URL: `turbo-grywalizacja.vercel.app`

### Krok 4.5: Zaktualizuj Supabase

1. W Supabase przejdz do **Authentication** -> **URL Configuration**
2. Dodaj URL Vercel do **Redirect URLs**:
   - `https://turbo-grywalizacja.vercel.app/auth/callback`

---

## 5. Pierwsze uruchomienie

### Krok 5.1: Utworz konto admina

1. Wejdz na strone aplikacji
2. Zarejestruj sie normalnie (Google lub Email)
3. Wybierz nick

### Krok 5.2: Nadaj uprawnienia admina

1. W Supabase przejdz do **Table Editor** -> **users**
2. Znajdz swoje konto
3. Zmien `is_admin` z `false` na `true`
4. Zapisz

### Krok 5.3: Odswiez aplikacje

1. Wyloguj sie i zaloguj ponownie
2. Powinienes widziec link do **Panelu Admina** w menu

---

## 6. Zarzadzanie druzynami

### Przypisywanie uzytkownikow do druzyn

1. Wejdz w **Panel Admina** -> **Druzyny**
2. Wybierz druzyne
3. Kliknij **"Przypisz uzytkownika"**
4. Wybierz uzytkownika z listy

### Zmiana druzyny uzytkownika

1. W **Panel Admina** -> **Druzyny**
2. Znajdz uzytkownika
3. Kliknij **"Zmien druzyne"**
4. Wybierz nowa druzyne

### Ranking druzynowy

Ranking druzyn aktualizuje sie automatycznie na podstawie sumy XP wszystkich czlonkow druzyny.

---

## Roznice od Turbo Challenge

| Funkcja | Turbo Challenge | Turbo Grywalizacja |
|---------|-----------------|-------------------|
| Typ rywalizacji | Indywidualna | Druzynowa |
| Ranking glowny | Ranking XP graczy | Ranking druzyn |
| Przypisanie | Brak | Admin przypisuje do druzyny |
| Nawigacja | 4 zakladki | 5 zakladek (+ Druzyny) |

---

**Powodzenia z Turbo Grywalizacja!**
