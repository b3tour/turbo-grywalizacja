'use client';

import { useState, useEffect } from 'react';
import { Card, Button, Badge, Input, Modal, AlertDialog } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useAuctions, useAuction } from '@/hooks/useAuctions';
import { Auction, AuctionBid, AuctionStatus } from '@/types';
import {
  Gavel,
  Plus,
  Edit2,
  Trash2,
  Play,
  Square,
  Trophy,
  Users,
  Clock,
  DollarSign,
  AlertCircle,
} from 'lucide-react';

const statusLabels: Record<AuctionStatus, { label: string; variant: 'default' | 'warning' | 'success' | 'danger' | 'turbo' }> = {
  pending: { label: 'Oczekuje', variant: 'default' },
  active: { label: 'Trwa', variant: 'turbo' },
  ended: { label: 'Zakończona', variant: 'success' },
  cancelled: { label: 'Anulowana', variant: 'danger' },
};

export default function AuctionsAdmin() {
  const { success, error: showError } = useToast();
  const { auctions, loading, createAuction, updateAuction, deleteAuction, startAuction, endAuction, cancelAuction, getBids, refresh } = useAuctions();

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBidsModal, setShowBidsModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedAuction, setSelectedAuction] = useState<Auction | null>(null);
  const [auctionToDelete, setAuctionToDelete] = useState<Auction | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Bids state
  const [bids, setBids] = useState<AuctionBid[]>([]);
  const [loadingBids, setLoadingBids] = useState(false);

  // Form state
  const [form, setForm] = useState({
    item_name: '',
    item_description: '',
    starting_price: 0,
    min_bid_increment: 10,
    points_for_win: 100,
  });

  const resetForm = () => {
    setForm({
      item_name: '',
      item_description: '',
      starting_price: 0,
      min_bid_increment: 10,
      points_for_win: 100,
    });
    setIsEditing(false);
    setSelectedAuction(null);
  };

  const openCreate = () => {
    resetForm();
    setShowCreateModal(true);
  };

  const openEdit = (auction: Auction) => {
    setForm({
      item_name: auction.item_name,
      item_description: auction.item_description || '',
      starting_price: auction.starting_price,
      min_bid_increment: auction.min_bid_increment,
      points_for_win: auction.points_for_win,
    });
    setSelectedAuction(auction);
    setIsEditing(true);
    setShowCreateModal(true);
  };

  const handleSave = async () => {
    if (!form.item_name.trim()) {
      showError('Błąd', 'Podaj nazwę przedmiotu');
      return;
    }

    let result;
    if (isEditing && selectedAuction) {
      result = await updateAuction(selectedAuction.id, {
        item_name: form.item_name,
        item_description: form.item_description || undefined,
        starting_price: form.starting_price,
        min_bid_increment: form.min_bid_increment,
        points_for_win: form.points_for_win,
      });
    } else {
      result = await createAuction(form);
    }

    if (result.success) {
      success(isEditing ? 'Zapisano!' : 'Utworzono!', isEditing ? 'Licytacja została zaktualizowana' : 'Nowa licytacja została dodana');
      setShowCreateModal(false);
      resetForm();
    } else {
      showError('Błąd', result.error || 'Coś poszło nie tak');
    }
  };

  const handleDelete = async () => {
    if (!auctionToDelete) return;
    const result = await deleteAuction(auctionToDelete.id);
    if (result.success) {
      success('Usunięto!', 'Licytacja została usunięta');
      setShowDeleteDialog(false);
      setAuctionToDelete(null);
    } else {
      showError('Błąd', result.error || 'Nie udało się usunąć');
    }
  };

  const handleStart = async (auction: Auction) => {
    const result = await startAuction(auction.id);
    if (result.success) {
      success('Rozpoczęto!', 'Licytacja jest teraz aktywna');
    } else {
      showError('Błąd', result.error || 'Nie udało się rozpocząć');
    }
  };

  const handleEnd = async (auction: Auction) => {
    const result = await endAuction(auction.id);
    if (result.success) {
      success('Zakończono!', 'Licytacja została zakończona i punkty przyznane');
    } else {
      showError('Błąd', result.error || 'Nie udało się zakończyć');
    }
  };

  const handleCancel = async (auction: Auction) => {
    const result = await cancelAuction(auction.id);
    if (result.success) {
      success('Anulowano', 'Licytacja została anulowana');
    } else {
      showError('Błąd', result.error || 'Nie udało się anulować');
    }
  };

  const openBids = async (auction: Auction) => {
    setSelectedAuction(auction);
    setShowBidsModal(true);
    setLoadingBids(true);
    const bidsData = await getBids(auction.id);
    setBids(bidsData);
    setLoadingBids(false);
  };

  const refreshBids = async () => {
    if (!selectedAuction) return;
    setLoadingBids(true);
    const bidsData = await getBids(selectedAuction.id);
    setBids(bidsData);
    setLoadingBids(false);
  };

  // Auto-refresh bids when modal is open
  useEffect(() => {
    if (showBidsModal && selectedAuction?.status === 'active') {
      const interval = setInterval(refreshBids, 3000);
      return () => clearInterval(interval);
    }
  }, [showBidsModal, selectedAuction]);

  return (
    <div className="space-y-4">
      <Button fullWidth onClick={openCreate}>
        <Plus className="w-5 h-5 mr-2" />
        Dodaj nową licytację
      </Button>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <Card key={i} className="h-24 animate-pulse bg-dark-700" />
          ))}
        </div>
      ) : auctions.length === 0 ? (
        <Card className="text-center py-8">
          <Gavel className="w-12 h-12 text-dark-600 mx-auto mb-3" />
          <p className="text-dark-400">Brak licytacji</p>
          <p className="text-sm text-dark-500">Dodaj pierwszą licytację powyżej</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {auctions.map(auction => (
            <Card key={auction.id}>
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-dark-700 text-orange-400">
                  <Gavel className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white truncate">{auction.item_name}</p>
                  <div className="flex items-center gap-3 text-sm text-dark-400">
                    <span className="flex items-center gap-1">
                      <DollarSign className="w-3 h-3" />
                      Start: {auction.starting_price}
                    </span>
                    <span className="flex items-center gap-1">
                      <Trophy className="w-3 h-3" />
                      {auction.points_for_win} pkt
                    </span>
                  </div>
                </div>
                <Badge variant={statusLabels[auction.status].variant}>
                  {statusLabels[auction.status].label}
                </Badge>
              </div>

              {auction.item_description && (
                <p className="text-sm text-dark-300 mb-3 line-clamp-2">{auction.item_description}</p>
              )}

              {/* Current price / Winner */}
              {auction.status === 'active' && (
                <div className="bg-turbo-500/10 border border-turbo-500/30 rounded-lg p-3 mb-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-dark-400">Aktualna cena:</span>
                    <span className="text-xl font-bold text-turbo-400">{auction.current_price}</span>
                  </div>
                </div>
              )}

              {auction.status === 'ended' && auction.winning_team && (
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 mb-3">
                  <div className="flex items-center gap-3">
                    <Trophy className="w-5 h-5 text-yellow-500" />
                    <div className="flex-1">
                      <p className="text-sm text-dark-400">Zwycięzca:</p>
                      <p className="font-medium text-white">
                        {(auction.winning_team as any)?.emoji} {(auction.winning_team as any)?.name}
                        {auction.winning_user && ` (${(auction.winning_user as any)?.nick})`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-dark-400">Kwota:</p>
                      <p className="font-bold text-green-400">{auction.winning_bid}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap gap-2 pt-3 border-t border-dark-700">
                {auction.status === 'pending' && (
                  <>
                    <Button size="sm" onClick={() => handleStart(auction)}>
                      <Play className="w-4 h-4 mr-1" />
                      Rozpocznij
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => openEdit(auction)}>
                      <Edit2 className="w-4 h-4 mr-1" />
                      Edytuj
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => { setAuctionToDelete(auction); setShowDeleteDialog(true); }}>
                      <Trash2 className="w-4 h-4 mr-1" />
                      Usuń
                    </Button>
                  </>
                )}

                {auction.status === 'active' && (
                  <>
                    <Button size="sm" onClick={() => openBids(auction)}>
                      <Users className="w-4 h-4 mr-1" />
                      Oferty
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => handleEnd(auction)}>
                      <Square className="w-4 h-4 mr-1" />
                      Zakończ
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => handleCancel(auction)}>
                      <AlertCircle className="w-4 h-4 mr-1" />
                      Anuluj
                    </Button>
                  </>
                )}

                {(auction.status === 'ended' || auction.status === 'cancelled') && (
                  <Button size="sm" variant="secondary" onClick={() => openBids(auction)}>
                    <Clock className="w-4 h-4 mr-1" />
                    Historia
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => { setShowCreateModal(false); resetForm(); }}
        title={isEditing ? 'Edytuj licytację' : 'Nowa licytacja'}
        size="lg"
      >
        <div className="space-y-4">
          <Input
            label="Nazwa przedmiotu *"
            value={form.item_name}
            onChange={e => setForm(prev => ({ ...prev, item_name: e.target.value }))}
            placeholder="np. Złoty puchar"
          />

          <div>
            <label className="block text-sm font-medium text-dark-200 mb-1.5">Opis</label>
            <textarea
              value={form.item_description}
              onChange={e => setForm(prev => ({ ...prev, item_description: e.target.value }))}
              placeholder="Opisz przedmiot licytacji..."
              className="w-full bg-dark-800 border border-dark-600 rounded-xl px-4 py-2.5 text-white placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-turbo-500 min-h-[80px] resize-none"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Input
              label="Cena startowa"
              type="number"
              value={form.starting_price}
              onChange={e => setForm(prev => ({ ...prev, starting_price: parseInt(e.target.value) || 0 }))}
              min={0}
            />
            <Input
              label="Min. podbicie"
              type="number"
              value={form.min_bid_increment}
              onChange={e => setForm(prev => ({ ...prev, min_bid_increment: parseInt(e.target.value) || 1 }))}
              min={1}
            />
            <Input
              label="Punkty za wygraną"
              type="number"
              value={form.points_for_win}
              onChange={e => setForm(prev => ({ ...prev, points_for_win: parseInt(e.target.value) || 0 }))}
              min={0}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button variant="secondary" onClick={() => { setShowCreateModal(false); resetForm(); }} className="flex-1">
              Anuluj
            </Button>
            <Button onClick={handleSave} className="flex-1">
              {isEditing ? 'Zapisz zmiany' : 'Utwórz licytację'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Bids Modal */}
      <Modal
        isOpen={showBidsModal}
        onClose={() => { setShowBidsModal(false); setSelectedAuction(null); setBids([]); }}
        title={`Oferty: ${selectedAuction?.item_name || ''}`}
        size="lg"
      >
        {selectedAuction && (
          <div className="space-y-4">
            {/* Current status */}
            <Card variant="outlined">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-xs text-dark-400">Status</p>
                  <Badge variant={statusLabels[selectedAuction.status].variant}>
                    {statusLabels[selectedAuction.status].label}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-dark-400">Aktualna cena</p>
                  <p className="text-xl font-bold text-turbo-400">{selectedAuction.current_price}</p>
                </div>
                <div>
                  <p className="text-xs text-dark-400">Ofert</p>
                  <p className="text-xl font-bold text-white">{bids.length}</p>
                </div>
              </div>
            </Card>

            {/* Bids list */}
            <div>
              <h4 className="font-medium text-white mb-2">Historia ofert</h4>
              {loadingBids ? (
                <div className="text-center py-4 text-dark-400">Ładowanie...</div>
              ) : bids.length === 0 ? (
                <Card variant="outlined" className="text-center py-4">
                  <p className="text-dark-400">Brak ofert</p>
                </Card>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {bids.map((bid, index) => (
                    <Card
                      key={bid.id}
                      variant="outlined"
                      padding="sm"
                      className={bid.is_winning ? 'border-green-500 bg-green-500/10' : ''}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                          index === 0 ? 'bg-yellow-500 text-black' : 'bg-dark-700 text-dark-300'
                        }`}>
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{(bid.team as any)?.emoji}</span>
                            <span className="font-medium text-white">{(bid.team as any)?.name}</span>
                            <span className="text-sm text-dark-400">({(bid.user as any)?.nick})</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`text-xl font-bold ${bid.is_winning ? 'text-green-400' : 'text-white'}`}>
                            {bid.bid_amount}
                          </span>
                          {bid.is_winning && (
                            <div className="flex items-center gap-1 text-green-400 text-xs">
                              <Trophy className="w-3 h-3" />
                              Zwycięzca
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {selectedAuction.status === 'active' && (
              <div className="flex gap-3">
                <Button variant="secondary" onClick={() => handleEnd(selectedAuction)} className="flex-1">
                  <Square className="w-4 h-4 mr-1" />
                  Zakończ licytację
                </Button>
              </div>
            )}

            <Button variant="secondary" fullWidth onClick={() => { setShowBidsModal(false); setSelectedAuction(null); }}>
              Zamknij
            </Button>
          </div>
        )}
      </Modal>

      {/* Delete dialog */}
      <AlertDialog
        isOpen={showDeleteDialog}
        onClose={() => { setShowDeleteDialog(false); setAuctionToDelete(null); }}
        onConfirm={handleDelete}
        title="Usuń licytację"
        message={`Czy na pewno chcesz usunąć licytację "${auctionToDelete?.item_name}"?`}
        confirmText="Usuń"
        cancelText="Anuluj"
        variant="danger"
      />
    </div>
  );
}
