import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Level } from '@/types';

// Łączenie klas Tailwind
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Definicja poziomów
export const LEVELS: Level[] = [
  { id: 1, name: 'Nowicjusz', min_xp: 0, max_xp: 200, badge_icon: '🌱', badge_color: '#94a3b8' },
  { id: 2, name: 'Street Racer', min_xp: 201, max_xp: 500, badge_icon: '🏎️', badge_color: '#22c55e' },
  { id: 3, name: 'Road Warrior', min_xp: 501, max_xp: 1000, badge_icon: '⚡', badge_color: '#3b82f6' },
  { id: 4, name: 'Turbo Pilot', min_xp: 1001, max_xp: 2000, badge_icon: '🚀', badge_color: '#8b5cf6' },
  { id: 5, name: 'Speed Demon', min_xp: 2001, max_xp: 3500, badge_icon: '👹', badge_color: '#ec4899' },
  { id: 6, name: 'Racing Elite', min_xp: 3501, max_xp: 5000, badge_icon: '🏆', badge_color: '#f59e0b' },
  { id: 7, name: 'Velocity Master', min_xp: 5001, max_xp: 7000, badge_icon: '💎', badge_color: '#06b6d4' },
  { id: 8, name: 'Turbo Champion', min_xp: 7001, max_xp: 9000, badge_icon: '👑', badge_color: '#eab308' },
  { id: 9, name: 'Grand Master', min_xp: 9001, max_xp: 12000, badge_icon: '🌟', badge_color: '#f97316' },
  { id: 10, name: 'Turbo Legenda', min_xp: 12001, max_xp: Infinity, badge_icon: '🔥', badge_color: '#ef4444', unlocks_description: 'Gwarantowane miejsce w finale!' },
];

// Oblicz poziom na podstawie XP
export function calculateLevel(xp: number): Level {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].min_xp) {
      return LEVELS[i];
    }
  }
  return LEVELS[0];
}

// Oblicz postęp do następnego poziomu (procent)
export function calculateLevelProgress(xp: number): number {
  const currentLevel = calculateLevel(xp);
  const currentLevelIndex = LEVELS.findIndex(l => l.id === currentLevel.id);

  if (currentLevelIndex === LEVELS.length - 1) {
    return 100; // Maksymalny poziom
  }

  const nextLevel = LEVELS[currentLevelIndex + 1];
  const xpInCurrentLevel = xp - currentLevel.min_xp;
  const xpNeededForNextLevel = nextLevel.min_xp - currentLevel.min_xp;

  return Math.min(100, Math.round((xpInCurrentLevel / xpNeededForNextLevel) * 100));
}

// XP potrzebne do następnego poziomu
export function xpToNextLevel(xp: number): number {
  const currentLevel = calculateLevel(xp);
  const currentLevelIndex = LEVELS.findIndex(l => l.id === currentLevel.id);

  if (currentLevelIndex === LEVELS.length - 1) {
    return 0; // Maksymalny poziom
  }

  const nextLevel = LEVELS[currentLevelIndex + 1];
  return nextLevel.min_xp - xp;
}

// Formatowanie liczby z separatorami tysięcy
export function formatNumber(num: number): string {
  return num.toLocaleString('pl-PL');
}

// Formatowanie daty
export function formatDate(date: string | Date): string {
  const d = new Date(date);
  return d.toLocaleDateString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

// Formatowanie daty i czasu
export function formatDateTime(date: string | Date): string {
  const d = new Date(date);
  return d.toLocaleDateString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Czas względny (np. "2 godziny temu")
export function timeAgo(date: string | Date): string {
  const d = new Date(date);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - d.getTime()) / 1000);

  const intervals = [
    { label: 'rok', seconds: 31536000 },
    { label: 'miesiąc', seconds: 2592000 },
    { label: 'dzień', seconds: 86400 },
    { label: 'godzina', seconds: 3600 },
    { label: 'minuta', seconds: 60 },
  ];

  for (const interval of intervals) {
    const count = Math.floor(seconds / interval.seconds);
    if (count >= 1) {
      // Prosta wersja bez pełnej odmiany
      return `${count} ${interval.label}${count > 1 ? getPolishPlural(count, interval.label) : ''} temu`;
    }
  }

  return 'przed chwilą';
}

// Polska odmiana liczebników
function getPolishPlural(count: number, word: string): string {
  const plurals: Record<string, string> = {
    'rok': count === 1 ? '' : (count < 5 ? 'i' : 'ów'),
    'miesiąc': count === 1 ? '' : (count < 5 ? 'e' : 'ęcy'),
    'dzień': count === 1 ? '' : (count < 5 ? 'i' : 'i'),
    'godzina': count === 1 ? '' : (count < 5 ? 'y' : ''),
    'minuta': count === 1 ? '' : (count < 5 ? 'y' : ''),
  };
  return plurals[word] || '';
}

// Oblicz odległość między dwoma punktami GPS (w metrach)
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371e3; // Promień Ziemi w metrach
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// Sprawdź czy użytkownik jest w zasięgu lokalizacji
export function isWithinRadius(
  userLat: number,
  userLng: number,
  targetLat: number,
  targetLng: number,
  radiusMeters: number
): boolean {
  const distance = calculateDistance(userLat, userLng, targetLat, targetLng);
  return distance <= radiusMeters;
}

// Generuj losowy kod QR
export function generateQRCode(): string {
  return `TC-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
}

// Walidacja email
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Walidacja numeru telefonu (polski format)
export function isValidPhone(phone: string): boolean {
  const phoneRegex = /^(\+48)?[\s-]?(\d{3})[\s-]?(\d{3})[\s-]?(\d{3})$/;
  return phoneRegex.test(phone.replace(/\s/g, ''));
}

// Walidacja nicku
export function isValidNick(nick: string): boolean {
  if (nick.length < 3 || nick.length > 20) return false;
  const nickRegex = /^[a-zA-Z0-9_-]+$/;
  return nickRegex.test(nick);
}

// Skróć tekst z wielokropkiem
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

// Ikony dla typów misji
export const missionTypeIcons: Record<string, string> = {
  qr_code: '📱',
  photo: '📸',
  quiz: '❓',
  gps: '📍',
  manual: '✋',
};

// Nazwy typów misji
export const missionTypeNames: Record<string, string> = {
  qr_code: 'Skanowanie QR',
  photo: 'Zdjęcie',
  quiz: 'Quiz',
  gps: 'Lokalizacja GPS',
  manual: 'Zadanie ręczne',
};
