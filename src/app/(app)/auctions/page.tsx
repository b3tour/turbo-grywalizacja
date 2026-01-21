'use client';

import { useState, useEffect } from 'react';
import { Card, Button, Badge, Input, Modal } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useAuctions, useAuction } from '@/hooks/useAuctions';
import { useAuth } from '@/hooks/useAuth';
import { useTeams } from '@/hooks/useTeams';
import { Auction, AuctionBid, AuctionStatus } from '@/types';
import {
  Gavel,
  Trophy,
  Clock,
  DollarSign,
  ChevronRight,
  Users,
  AlertCircle,
  CheckCircle,
  XCircle,
  TrendingUp,
} from 'lucide-react';

const statusLabels: Record<AuctionStatus, { label: string; variant: 'default' | 'warning' | 'success' | 'danger' | 'turbo'; color: string }> = {
  pending: { label: 'Wkrótce', variant: 'default', color: 'text-dark-400' },
  active: { label: 'Trwa!', variant: 'turbo', color: 'text-turbo-400' },
  ended: { label: 'Zakończona', variant: 'success', color: 'text-green-400' },
  cancelled: { label: 'Anulowana', variant: 'danger', color: 'text-red-400' },
};

export default function AuctionsPage() {
  const { success, error: showError } = useToast();
  const { auctions, loading, placeBid, refresh } = useAuctions();
  const { profile } = useAuth();
  const { teams } = useTeams();

  const [selectedAuction, setSelectedAuction] = useState<Auction | null>(null);
  const [showBidModal, setShowBidModal] = useState(false);
  const [bidAmount, setBidAmount] = useState('');
  const [biddingAuction, setBiddingAuction] = useState<Auction | null>(null);

  // Use real-time hook for selected auction
  const { auction: liveAuction, bids, refresh: refreshAuction } = useAuction(selectedAuction?.id || null);

  // Filter auctions
  const activeAuctions = auctions.filter(a => a.status === 'active');
  const upcomingAuctions = auctions.filter(a => a.status === 'pending');
  const endedAuctions = auctions.filter(a => a.status === 'ended' || a.status === 'cancelled');

  // Get user's team
  const userTeam = teams.find(t => t.id === profile?.team_id);

  const openBidModal = (auction: Auction) => {
    if (!profile?.team_id) {
      showError('Błąd', 'Musisz być przypisany do drużyny, żeby licytować');
      return;
    }
    setBiddingAuction(auction);
    setBidAmount(String(auction.current_price + auction.min_bid_increment));
    setShowBidModal(true);
  };

  const handlePlaceBid = async () => {
    if (!biddingAuction) return;

    const amount = parseInt(bidAmount, 10);
    if (isNaN(amount) || amount <= 0) {
      showError('Błąd', 'Podaj prawidłową kwotę');
      return;
    }

    const minBid = biddingAuction.current_price + biddingAuction.min_bid_increment;
    if (amount < minBid) {
      showError('Błąd', `Minimalna oferta to ${minBid}`);
      return;
    }

    const result = await placeBid(biddingAuction.id, amount);
    if (result.success) {
      success('Oferta złożona!', `Twoja oferta ${amount} została przyjęta`);
      setShowBidModal(false);
      setBiddingAuction(null);
      setBidAmount('');
      // Refresh if viewing this auction
      if (selectedAuction?.id === biddingAuction.id) {
        refreshAuction();
      }
    } else {
      showError('Błąd', result.error || 'Nie udało się złożyć oferty');
    }
  };

  // Detail view
  if (selectedAuction) {
    const auction = liveAuction || selectedAuction;
    const isActive = auction.status === 'active';
    const isWinner = auction.winning_team_id === profile?.team_id;

    return (
      <div className="py-4">
        {/* Back button */}
        <button
          onClick={() => setSelectedAuction(null)}
          className="flex items-center gap-2 text-dark-400 hover:text-white mb-4 transition-colors"
        >
          <ChevronRight className="w-4 h-4 rotate-180" />
          Wróć do listy
        </button>

        {/* Auction header */}
        <Card className={`mb-4 ${isActive ? 'border-turbo-500/50' : ''}`}>
          <div className="flex items-center gap-3 mb-4">
            <div className={`p-3 rounded-xl bg-dark-700 ${statusLabels[auction.status].color}`}>
              <Gavel className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-white">{auction.item_name}</h1>
              <Badge variant={statusLabels[auction.status].variant}>
                {statusLabels[auction.status].label}
              </Badge>
            </div>
          </div>

          {auction.item_description && (
            <p className="text-dark-300 mb-4">{auction.item_description}</p>
          )}

          {/* Current price */}
          <div className={`rounded-xl p-4 mb-4 ${
            isActive ? 'bg-turbo-500/10 border border-turbo-500/30' : 'bg-dark-700'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-dark-400">
                  {isActive ? 'Aktualna cena' : 'Cena końcowa'}
                </p>
                <p className="text-3xl font-bold text-turbo-400">{auction.current_price}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-dark-400">Za wygraną</p>
                <p className="text-xl font-bold text-white flex items-center gap-1">
                  <Trophy className="w-5 h-5 text-yellow-500" />
                  {auction.points_for_win} pkt
                </p>
              </div>
            </div>
          </div>

          {/* Bid button */}
          {isActive && profile?.team_id && (
            <Button fullWidth onClick={() => openBidModal(auction)}>
              <TrendingUp className="w-5 h-5 mr-2" />
              Licytuj (min. {auction.current_price + auction.min_bid_increment})
            </Button>
          )}

          {isActive && !profile?.team_id && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 text-center">
              <AlertCircle className="w-6 h-6 text-yellow-500 mx-auto mb-2" />
              <p className="text-yellow-400">Musisz być przypisany do drużyny, żeby licytować</p>
            </div>
          )}

          {/* Winner announcement */}
          {auction.status === 'ended' && auction.winning_team && (
            <div className={`rounded-xl p-4 ${isWinner ? 'bg-green-500/20 border border-green-500/50' : 'bg-dark-700'}`}>
              <div className="flex items-center gap-3">
                <Trophy className={`w-8 h-8 ${isWinner ? 'text-yellow-500' : 'text-dark-400'}`} />
                <div className="flex-1">
                  <p className="text-sm text-dark-400">Zwycięzca</p>
                  <p className="text-lg font-bold text-white">
                    {(auction.winning_team as any)?.emoji} {(auction.winning_team as any)?.name}
                  </p>
                  {auction.winning_user && (
                    <p className="text-sm text-dark-400">
                      Licytujący: {(auction.winning_user as any)?.nick}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-green-400">{auction.winning_bid}</p>
                  {isWinner && (
                    <p className="text-sm text-green-400 flex items-center gap-1 justify-end">
                      <CheckCircle className="w-4 h-4" />
                      Twoja drużyna!
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* Bids history */}
        <Card>
          <h3 className="font-medium text-white mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-dark-400" />
            Historia ofert ({bids.length})
          </h3>

          {bids.length === 0 ? (
            <div className="text-center py-8 text-dark-400">
              <Gavel className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>Brak ofert</p>
              <p className="text-sm">Bądź pierwszy!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {bids.map((bid, index) => {
                const isMyTeam = bid.team_id === profile?.team_id;
                return (
                  <div
                    key={bid.id}
                    className={`flex items-center gap-3 p-3 rounded-xl ${
                      index === 0 ? 'bg-turbo-500/10 border border-turbo-500/30' :
                      isMyTeam ? 'bg-blue-500/10 border border-blue-500/30' :
                      'bg-dark-800/50'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      index === 0 ? 'bg-turbo-500 text-white' : 'bg-dark-700 text-dark-300'
                    }`}>
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{(bid.team as any)?.emoji}</span>
                        <span className="font-medium text-white truncate">{(bid.team as any)?.name}</span>
                        {isMyTeam && (
                          <Badge variant="turbo" size="sm">Twoja</Badge>
                        )}
                      </div>
                      <span className="text-sm text-dark-400">{(bid.user as any)?.nick}</span>
                    </div>
                    <div className="text-right">
                      <span className={`text-xl font-bold ${index === 0 ? 'text-turbo-400' : 'text-white'}`}>
                        {bid.bid_amount}
                      </span>
                      {bid.is_winning && (
                        <div className="flex items-center gap-1 text-green-400 text-xs justify-end">
                          <Trophy className="w-3 h-3" />
                          Wygrana
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    );
  }

  // List view
  return (
    <div className="py-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center">
          <Gavel className="w-6 h-6 text-orange-500" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Licytacje</h1>
          <p className="text-sm text-dark-400">
            {userTeam ? `Licytujesz jako ${userTeam.emoji} ${userTeam.name}` : 'Przypisz się do drużyny'}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <Card key={i} className="h-24 animate-pulse bg-dark-700" />
          ))}
        </div>
      ) : (
        <>
          {/* Active auctions */}
          {activeAuctions.length > 0 && (
            <div className="mb-6">
              <h2 className="text-sm font-medium text-dark-400 mb-3 flex items-center gap-2">
                <Gavel className="w-4 h-4 text-turbo-500" />
                TRWAJĄCE ({activeAuctions.length})
              </h2>
              <div className="space-y-3">
                {activeAuctions.map(auction => (
                  <Card
                    key={auction.id}
                    hover
                    onClick={() => setSelectedAuction(auction)}
                    className="border-turbo-500/30"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-dark-700 text-orange-400">
                        <Gavel className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-white truncate">{auction.item_name}</p>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-turbo-400 font-bold">{auction.current_price}</span>
                          <span className="text-dark-400">•</span>
                          <span className="text-dark-400">{auction.points_for_win} pkt</span>
                        </div>
                      </div>
                      <Badge variant="turbo">Trwa!</Badge>
                      <ChevronRight className="w-5 h-5 text-dark-400" />
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Upcoming auctions */}
          {upcomingAuctions.length > 0 && (
            <div className="mb-6">
              <h2 className="text-sm font-medium text-dark-400 mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                NADCHODZĄCE ({upcomingAuctions.length})
              </h2>
              <div className="space-y-3">
                {upcomingAuctions.map(auction => (
                  <Card
                    key={auction.id}
                    hover
                    onClick={() => setSelectedAuction(auction)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-dark-700 text-dark-400">
                        <Gavel className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-white truncate">{auction.item_name}</p>
                        <div className="flex items-center gap-2 text-sm text-dark-400">
                          <span>Start: {auction.starting_price}</span>
                          <span>•</span>
                          <span>{auction.points_for_win} pkt</span>
                        </div>
                      </div>
                      <Badge variant="default">Wkrótce</Badge>
                      <ChevronRight className="w-5 h-5 text-dark-400" />
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Ended auctions */}
          {endedAuctions.length > 0 && (
            <div className="mb-6">
              <h2 className="text-sm font-medium text-dark-400 mb-3 flex items-center gap-2">
                <Trophy className="w-4 h-4 text-green-500" />
                ZAKOŃCZONE ({endedAuctions.length})
              </h2>
              <div className="space-y-3">
                {endedAuctions.map(auction => (
                  <Card
                    key={auction.id}
                    hover
                    onClick={() => setSelectedAuction(auction)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-dark-700 text-green-400">
                        <Gavel className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-white truncate">{auction.item_name}</p>
                        {auction.winning_team && (
                          <div className="flex items-center gap-1 text-sm text-dark-400">
                            <Trophy className="w-3 h-3 text-yellow-500" />
                            {(auction.winning_team as any)?.emoji} {(auction.winning_team as any)?.name}
                            <span className="text-turbo-400 font-medium ml-1">{auction.winning_bid}</span>
                          </div>
                        )}
                      </div>
                      <Badge variant={auction.status === 'ended' ? 'success' : 'danger'}>
                        {auction.status === 'ended' ? 'Zakończona' : 'Anulowana'}
                      </Badge>
                      <ChevronRight className="w-5 h-5 text-dark-400" />
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {auctions.length === 0 && (
            <Card className="text-center py-12">
              <Gavel className="w-16 h-16 text-dark-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">Brak licytacji</h3>
              <p className="text-dark-400">Licytacje pojawią się tutaj gdy admin je doda</p>
            </Card>
          )}
        </>
      )}

      {/* Bid Modal */}
      <Modal
        isOpen={showBidModal}
        onClose={() => { setShowBidModal(false); setBiddingAuction(null); }}
        title="Złóż ofertę"
      >
        {biddingAuction && (
          <div className="space-y-4">
            <Card variant="outlined">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-dark-700 text-orange-400">
                  <Gavel className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-white">{biddingAuction.item_name}</p>
                  <p className="text-sm text-dark-400">
                    Aktualna cena: <span className="text-turbo-400 font-bold">{biddingAuction.current_price}</span>
                  </p>
                </div>
              </div>
            </Card>

            <div className="bg-dark-700 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl">{userTeam?.emoji}</span>
                <div>
                  <p className="text-sm text-dark-400">Licytujesz jako</p>
                  <p className="font-medium text-white">{userTeam?.name}</p>
                </div>
              </div>
            </div>

            <Input
              label={`Twoja oferta (min. ${biddingAuction.current_price + biddingAuction.min_bid_increment})`}
              type="number"
              value={bidAmount}
              onChange={e => setBidAmount(e.target.value)}
              min={biddingAuction.current_price + biddingAuction.min_bid_increment}
            />

            <div className="text-sm text-dark-400 bg-dark-800 rounded-lg p-3">
              <p>Minimalne podbicie: <span className="text-white">{biddingAuction.min_bid_increment}</span></p>
              <p>Za wygraną: <span className="text-turbo-400">{biddingAuction.points_for_win} pkt dla drużyny</span></p>
            </div>

            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setShowBidModal(false)} className="flex-1">
                Anuluj
              </Button>
              <Button onClick={handlePlaceBid} className="flex-1">
                <TrendingUp className="w-4 h-4 mr-2" />
                Licytuj {bidAmount}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
