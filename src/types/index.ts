// =====================================================
// TURBO GRYWALIZACJA - Typy TypeScript
// =====================================================

// Typy dla druzyny
export interface Team {
  id: string;
  name: string;
  description?: string;
  color: string;
  emoji: string;
  total_xp: number;
  member_count: number;
  avg_xp_per_member: number;
  order_index: number;
  is_active: boolean;
  created_at: string;
}

// Typy dla uzytkownika
export interface User {
  id: string;
  email: string;
  nick: string;
  phone?: string;
  avatar_url?: string;
  total_xp: number;
  level: number;
  team_id?: string;
  team?: Team;
  created_at: string;
  updated_at: string;
  is_admin: boolean;
  // Pola dla zmiany nicku
  nick_changes_count?: number;
  pending_nick?: string;
  pending_nick_requested_at?: string;
}

// Typy dla poziomu
export interface Level {
  id: number;
  name: string;
  min_xp: number;
  max_xp: number;
  badge_icon: string;
  badge_color: string;
  unlocks_description?: string;
}

// Typy misji
export type MissionType = 'qr_code' | 'photo' | 'quiz' | 'gps' | 'manual';
export type MissionStatus = 'active' | 'inactive' | 'scheduled';

export interface Mission {
  id: string;
  title: string;
  description: string;
  xp_reward: number;
  type: MissionType;
  location_name?: string;
  location_lat?: number;
  location_lng?: number;
  location_radius?: number;
  qr_code_value?: string;
  quiz_data?: QuizData;
  photo_requirements?: string;
  start_date?: string;
  end_date?: string;
  status: MissionStatus;
  required_level: number;
  max_completions?: number;
  created_at: string;
  image_url?: string;
}

// Dane quizu
export type QuizMode = 'classic' | 'speedrun';

export interface QuizData {
  questions: QuizQuestion[];
  passing_score: number;
  time_limit?: number;
  mode?: QuizMode;
}

export interface QuizQuestion {
  id: string;
  question: string;
  answers: QuizAnswer[];
  points: number;
}

export interface QuizAnswer {
  id: string;
  text: string;
  is_correct: boolean;
}

// Zgloszenie wykonania misji
export type SubmissionStatus = 'pending' | 'approved' | 'rejected';

export interface Submission {
  id: string;
  user_id: string;
  mission_id: string;
  status: SubmissionStatus;
  photo_url?: string;
  quiz_score?: number;
  quiz_time_ms?: number;
  gps_lat?: number;
  gps_lng?: number;
  admin_notes?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  created_at: string;
  xp_awarded: number;
  user?: User;
  mission?: Mission;
}

// Leaderboard indywidualny
export interface LeaderboardEntry {
  rank: number;
  user_id: string;
  nick: string;
  avatar_url?: string;
  total_xp: number;
  level: number;
  level_name: string;
  missions_completed: number;
  team_id?: string;
  team?: Team;
}

// Leaderboard druzynowy
export interface TeamLeaderboardEntry {
  rank: number;
  team: Team;
  top_contributors: TeamContributor[];
}

export interface TeamContributor {
  id: string;
  nick: string;
  avatar_url?: string;
  total_xp: number;
  level: number;
}

// Czlonek druzyny
export interface TeamMember {
  id: string;
  nick: string;
  avatar_url?: string;
  total_xp: number;
  level: number;
  missions_completed: number;
  joined_at?: string;
}

// Statystyki druzyny
export interface TeamStats {
  team_id: string;
  total_missions: number;
  total_xp: number;
  avg_xp_per_member: number;
  most_active_member?: TeamContributor;
  rank: number;
}

// Odznaki i achievementy
export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  condition_type: 'xp_total' | 'missions_count' | 'mission_type_count' | 'level' | 'special';
  condition_value: number;
  condition_extra?: string;
  xp_bonus: number;
}

export interface UserAchievement {
  id: string;
  user_id: string;
  achievement_id: string;
  earned_at: string;
  achievement?: Achievement;
}

// Powiadomienia
export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'xp_gain' | 'level_up' | 'achievement' | 'mission_approved' | 'mission_rejected' | 'team_assigned' | 'system';
  read: boolean;
  created_at: string;
  data?: Record<string, unknown>;
}

// Statystyki uzytkownika
export interface UserStats {
  total_xp: number;
  level: number;
  rank: number;
  missions_completed: number;
  missions_pending: number;
  achievements_count: number;
  days_active: number;
  current_streak: number;
  best_streak: number;
  team_rank?: number;
  team_contribution?: number;
}

// Odpowiedzi API
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

// Kontekst geolokalizacji
export interface GeoPosition {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: number;
}

// =====================================================
// ZADANIA EVENTOWE (Challenges)
// =====================================================

// Typ zadania
export type ChallengeType =
  | 'team_timed'        // Druzyna na czas
  | 'individual_timed'  // Indywidualne na czas
  | 'team_task'         // Zadanie druzynowe
  | 'individual_task'   // Zadanie indywidualne
  | 'auction';          // Licytacja

// Tryb punktowania
export type PointsMode =
  | 'placement'    // Punkty za miejsce
  | 'top_n'        // Tylko TOP N dostaje punkty
  | 'fixed'        // Stala liczba punktow
  | 'auction_win'; // Punkty za wygrana licytacje

// Status zadania
export type ChallengeStatus = 'pending' | 'active' | 'scoring' | 'completed';

// Rozklad punktow (miejsce -> punkty)
export type PointsDistribution = Record<string, number>;

// Zadanie/wyzwanie eventowe
export interface Challenge {
  id: string;
  title: string;
  description?: string;
  type: ChallengeType;
  points_mode: PointsMode;
  points_distribution: PointsDistribution;
  fixed_points?: number;
  max_participants_per_team?: number;
  status: ChallengeStatus;
  order_index: number;
  scheduled_start?: string;
  scheduled_end?: string;
  created_at: string;
  updated_at: string;
}

// Wynik zadania
export interface ChallengeResult {
  id: string;
  challenge_id: string;
  team_id: string;
  user_id?: string;
  time_ms?: number;
  score?: number;
  placement?: number;
  points_awarded: number;
  admin_notes?: string;
  recorded_by?: string;
  recorded_at?: string;
  created_at: string;
  // Relacje
  challenge?: Challenge;
  team?: Team;
  user?: User;
}

// Widok rankingu zadania
export interface ChallengeLeaderboardEntry {
  id: string;
  challenge_id: string;
  challenge_title: string;
  challenge_type: ChallengeType;
  team_id: string;
  team_name: string;
  team_color: string;
  team_emoji: string;
  user_id?: string;
  user_nick?: string;
  time_ms?: number;
  score?: number;
  placement?: number;
  points_awarded: number;
  created_at: string;
}

// Widok rankingu indywidualnego
export interface IndividualRankingEntry {
  user_id: string;
  nick: string;
  avatar_url?: string;
  team_id: string;
  team_name: string;
  team_color: string;
  team_emoji: string;
  challenge_id: string;
  challenge_title: string;
  challenge_type: ChallengeType;
  time_ms?: number;
  score?: number;
  placement?: number;
  points_awarded: number;
}

// =====================================================
// LICYTACJE (Auctions)
// =====================================================

// Status licytacji
export type AuctionStatus = 'pending' | 'active' | 'ended' | 'cancelled';

// Licytacja
export interface Auction {
  id: string;
  challenge_id?: string;
  item_name: string;
  item_description?: string;
  item_image_url?: string;
  starting_price: number;
  min_bid_increment: number;
  current_price: number;
  winning_team_id?: string;
  winning_user_id?: string;
  winning_bid?: number;
  status: AuctionStatus;
  points_for_win: number;
  created_at: string;
  ended_at?: string;
  // Relacje
  winning_team?: Team;
  winning_user?: User;
}

// Oferta w licytacji
export interface AuctionBid {
  id: string;
  auction_id: string;
  team_id: string;
  user_id: string;
  bid_amount: number;
  is_winning: boolean;
  created_at: string;
  // Relacje
  team?: Team;
  user?: User;
}

// Formularz tworzenia zadania
export interface CreateChallengeInput {
  title: string;
  description?: string;
  type: ChallengeType;
  points_mode: PointsMode;
  points_distribution?: PointsDistribution;
  fixed_points?: number;
  max_participants_per_team?: number;
  order_index?: number;
  scheduled_start?: string;
  scheduled_end?: string;
}

// Formularz dodawania wyniku
export interface AddChallengeResultInput {
  challenge_id: string;
  team_id: string;
  user_id?: string;
  time_ms?: number;
  score?: number;
  admin_notes?: string;
}

// Formularz tworzenia licytacji
export interface CreateAuctionInput {
  item_name: string;
  item_description?: string;
  item_image_url?: string;
  starting_price?: number;
  min_bid_increment?: number;
  points_for_win?: number;
}

// Formularz skladania oferty
export interface PlaceBidInput {
  auction_id: string;
  bid_amount: number;
}

// Formatowanie czasu (ms -> mm:ss.ms)
export function formatTime(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const milliseconds = ms % 1000;

  if (minutes > 0) {
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0').slice(0, 2)}`;
  }
  return `${seconds}.${milliseconds.toString().padStart(3, '0').slice(0, 2)}s`;
}

// Parsowanie czasu (mm:ss.ms -> ms)
export function parseTime(timeStr: string): number | null {
  // Formaty: "1:23.45", "1:23", "45.67", "45"
  const parts = timeStr.replace(',', '.').split(':');

  try {
    if (parts.length === 2) {
      // mm:ss lub mm:ss.ms
      const minutes = parseInt(parts[0], 10);
      const secondsParts = parts[1].split('.');
      const seconds = parseInt(secondsParts[0], 10);
      const ms = secondsParts[1] ? parseInt(secondsParts[1].padEnd(3, '0').slice(0, 3), 10) : 0;
      return minutes * 60000 + seconds * 1000 + ms;
    } else {
      // ss lub ss.ms
      const secondsParts = parts[0].split('.');
      const seconds = parseInt(secondsParts[0], 10);
      const ms = secondsParts[1] ? parseInt(secondsParts[1].padEnd(3, '0').slice(0, 3), 10) : 0;
      return seconds * 1000 + ms;
    }
  } catch {
    return null;
  }
}
