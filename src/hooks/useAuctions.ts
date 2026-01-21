'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Auction,
  AuctionBid,
  CreateAuctionInput,
  AuctionStatus,
} from '@/types';
import { useAuth } from './useAuth';

interface UseAuctionsReturn {
  auctions: Auction[];
  loading: boolean;
  error: string | null;
  // CRUD
  createAuction: (input: CreateAuctionInput) => Promise<{ success: boolean; error: string | null }>;
  updateAuction: (id: string, updates: Partial<Auction>) => Promise<{ success: boolean; error: string | null }>;
  deleteAuction: (id: string) => Promise<{ success: boolean; error: string | null }>;
  // Status
  startAuction: (id: string) => Promise<{ success: boolean; error: string | null }>;
  endAuction: (id: string) => Promise<{ success: boolean; error: string | null }>;
  cancelAuction: (id: string) => Promise<{ success: boolean; error: string | null }>;
  // Oferty
  placeBid: (auctionId: string, amount: number) => Promise<{ success: boolean; error: string | null }>;
  getBids: (auctionId: string) => Promise<AuctionBid[]>;
  // Odswiezanie
  refresh: () => Promise<void>;
}

export function useAuctions(): UseAuctionsReturn {
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, profile } = useAuth();

  // Pobierz wszystkie licytacje
  const fetchAuctions = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('auctions')
        .select(`
          *,
          winning_team:teams!auctions_winning_team_id_fkey(id, name, color, emoji),
          winning_user:users!auctions_winning_user_id_fkey(id, nick, avatar_url)
        `)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setAuctions(data || []);
      setError(null);
    } catch (e) {
      console.error('Error fetching auctions:', e);
      setError('Nie udało się pobrać licytacji');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAuctions();
  }, [fetchAuctions]);

  // Utworz nowa licytacje
  const createAuction = async (input: CreateAuctionInput) => {
    try {
      const { error: insertError } = await supabase
        .from('auctions')
        .insert({
          item_name: input.item_name,
          item_description: input.item_description,
          item_image_url: input.item_image_url,
          starting_price: input.starting_price || 0,
          min_bid_increment: input.min_bid_increment || 10,
          points_for_win: input.points_for_win || 100,
          current_price: input.starting_price || 0,
        });

      if (insertError) throw insertError;
      await fetchAuctions();
      return { success: true, error: null };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Błąd tworzenia licytacji';
      return { success: false, error: message };
    }
  };

  // Aktualizuj licytacje
  const updateAuction = async (id: string, updates: Partial<Auction>) => {
    try {
      const { error: updateError } = await supabase
        .from('auctions')
        .update(updates)
        .eq('id', id);

      if (updateError) throw updateError;
      await fetchAuctions();
      return { success: true, error: null };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Błąd aktualizacji licytacji';
      return { success: false, error: message };
    }
  };

  // Usun licytacje
  const deleteAuction = async (id: string) => {
    try {
      const { error: deleteError } = await supabase
        .from('auctions')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;
      await fetchAuctions();
      return { success: true, error: null };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Błąd usuwania licytacji';
      return { success: false, error: message };
    }
  };

  // Rozpocznij licytacje
  const startAuction = async (id: string) => {
    return updateAuction(id, { status: 'active' as AuctionStatus });
  };

  // Zakoncz licytacje (przez funkcje SQL)
  const endAuction = async (id: string) => {
    try {
      const { error: rpcError } = await supabase
        .rpc('end_auction', { p_auction_id: id });

      if (rpcError) throw rpcError;
      await fetchAuctions();
      return { success: true, error: null };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Błąd kończenia licytacji';
      return { success: false, error: message };
    }
  };

  // Anuluj licytacje
  const cancelAuction = async (id: string) => {
    return updateAuction(id, { status: 'cancelled' as AuctionStatus });
  };

  // Zloz oferte
  const placeBid = async (auctionId: string, amount: number) => {
    if (!user || !profile?.team_id) {
      return { success: false, error: 'Musisz być zalogowany i przypisany do drużyny' };
    }

    try {
      // Sprawdz czy licytacja jest aktywna
      const auction = auctions.find(a => a.id === auctionId);
      if (!auction) {
        return { success: false, error: 'Licytacja nie istnieje' };
      }
      if (auction.status !== 'active') {
        return { success: false, error: 'Licytacja nie jest aktywna' };
      }

      // Sprawdz minimalna oferte
      const minBid = auction.current_price + auction.min_bid_increment;
      if (amount < minBid) {
        return { success: false, error: `Minimalna oferta to ${minBid}` };
      }

      // Dodaj oferte
      const { error: insertError } = await supabase
        .from('auction_bids')
        .insert({
          auction_id: auctionId,
          team_id: profile.team_id,
          user_id: user.id,
          bid_amount: amount,
        });

      if (insertError) throw insertError;

      // Zaktualizuj aktualna cene
      await supabase
        .from('auctions')
        .update({ current_price: amount })
        .eq('id', auctionId);

      await fetchAuctions();
      return { success: true, error: null };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Błąd składania oferty';
      return { success: false, error: message };
    }
  };

  // Pobierz oferty licytacji
  const getBids = async (auctionId: string): Promise<AuctionBid[]> => {
    try {
      const { data, error: fetchError } = await supabase
        .from('auction_bids')
        .select(`
          *,
          team:teams(id, name, color, emoji),
          user:users(id, nick, avatar_url)
        `)
        .eq('auction_id', auctionId)
        .order('bid_amount', { ascending: false });

      if (fetchError) throw fetchError;
      return data || [];
    } catch (e) {
      console.error('Error fetching bids:', e);
      return [];
    }
  };

  return {
    auctions,
    loading,
    error,
    createAuction,
    updateAuction,
    deleteAuction,
    startAuction,
    endAuction,
    cancelAuction,
    placeBid,
    getBids,
    refresh: fetchAuctions,
  };
}

// Hook do pojedynczej licytacji z real-time updates
export function useAuction(auctionId: string | null) {
  const [auction, setAuction] = useState<Auction | null>(null);
  const [bids, setBids] = useState<AuctionBid[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAuction = useCallback(async () => {
    if (!auctionId) {
      setAuction(null);
      setBids([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Pobierz licytacje
      const { data: auctionData, error: auctionError } = await supabase
        .from('auctions')
        .select(`
          *,
          winning_team:teams!auctions_winning_team_id_fkey(id, name, color, emoji),
          winning_user:users!auctions_winning_user_id_fkey(id, nick, avatar_url)
        `)
        .eq('id', auctionId)
        .single();

      if (auctionError) throw auctionError;
      setAuction(auctionData);

      // Pobierz oferty
      const { data: bidsData, error: bidsError } = await supabase
        .from('auction_bids')
        .select(`
          *,
          team:teams(id, name, color, emoji),
          user:users(id, nick, avatar_url)
        `)
        .eq('auction_id', auctionId)
        .order('bid_amount', { ascending: false });

      if (bidsError) throw bidsError;
      setBids(bidsData || []);

      setError(null);
    } catch (e) {
      console.error('Error fetching auction:', e);
      setError('Nie udało się pobrać licytacji');
    } finally {
      setLoading(false);
    }
  }, [auctionId]);

  useEffect(() => {
    fetchAuction();

    // Real-time subscription dla ofert
    if (auctionId) {
      const subscription = supabase
        .channel(`auction-${auctionId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'auction_bids',
            filter: `auction_id=eq.${auctionId}`,
          },
          () => {
            fetchAuction();
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'auctions',
            filter: `id=eq.${auctionId}`,
          },
          () => {
            fetchAuction();
          }
        )
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [auctionId, fetchAuction]);

  return {
    auction,
    bids,
    loading,
    error,
    refresh: fetchAuction,
  };
}
