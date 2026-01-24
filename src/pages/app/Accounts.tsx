import { useState } from 'react';
import { useTradingAccounts, TradingAccount } from '@/hooks/useTradingAccounts';
import { DraggableHedgeMap, HedgeRelationship } from '@/components/dashboard/DraggableHedgeMap';
import { AddAccountModal } from '@/components/dashboard/AddAccountModal';
import { AccountDetailsModal } from '@/components/dashboard/AccountDetailsModal';
import { useToast } from '@/hooks/use-toast';

// Local storage key for relationships
const RELATIONSHIPS_KEY = 'hedge_edge_relationships';

const getStoredRelationships = (): HedgeRelationship[] => {
  try {
    const stored = localStorage.getItem(RELATIONSHIPS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const saveRelationships = (relationships: HedgeRelationship[]) => {
  localStorage.setItem(RELATIONSHIPS_KEY, JSON.stringify(relationships));
};

const Accounts = () => {
  const { accounts, loading, createAccount, deleteAccount, syncAccountFromMT5 } = useTradingAccounts();
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [relationships, setRelationships] = useState<HedgeRelationship[]>(getStoredRelationships);
  const [selectedAccount, setSelectedAccount] = useState<TradingAccount | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const { toast } = useToast();

  const handleAccountClick = (account: TradingAccount) => {
    setSelectedAccount(account);
    setDetailsModalOpen(true);
  };

  const handleCreateRelationship = (sourceId: string, targetId: string, logic: HedgeRelationship['logic'] = 'mirror', offsetPercentage: number = 100) => {
    // Check if relationship already exists
    const exists = relationships.some(
      r => (r.sourceId === sourceId && r.targetId === targetId) ||
           (r.sourceId === targetId && r.targetId === sourceId)
    );

    if (exists) {
      toast({
        title: 'Relationship exists ⚠️',
        description: 'These accounts are already linked.',
        variant: 'destructive',
      });
      return;
    }

    const newRelationship: HedgeRelationship = {
      id: crypto.randomUUID(),
      sourceId,
      targetId,
      offsetPercentage,
      logic,
      isActive: true,
    };

    const updated = [...relationships, newRelationship];
    setRelationships(updated);
    saveRelationships(updated);
  };

  const handleUpdateRelationship = (id: string, updates: Partial<HedgeRelationship>) => {
    const updated = relationships.map(r => 
      r.id === id ? { ...r, ...updates } : r
    );
    setRelationships(updated);
    saveRelationships(updated);
  };

  const handleDeleteRelationship = (id: string) => {
    const updated = relationships.filter(r => r.id !== id);
    setRelationships(updated);
    saveRelationships(updated);
  };

  const handleDeleteAccount = async (id: string) => {
    // Also remove any relationships involving this account
    const updated = relationships.filter(r => r.sourceId !== id && r.targetId !== id);
    setRelationships(updated);
    saveRelationships(updated);
    
    await deleteAccount(id);
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading accounts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen">
      <DraggableHedgeMap
        accounts={accounts}
        relationships={relationships}
        onAddAccount={() => setAddModalOpen(true)}
        onDeleteAccount={handleDeleteAccount}
        onCreateRelationship={handleCreateRelationship}
        onDeleteRelationship={handleDeleteRelationship}
        onUpdateRelationship={handleUpdateRelationship}
        onAccountClick={handleAccountClick}
      />

      <AddAccountModal
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        onSubmit={createAccount}
      />

      <AccountDetailsModal
        account={selectedAccount}
        open={detailsModalOpen}
        onOpenChange={setDetailsModalOpen}
        onSyncAccount={syncAccountFromMT5}
      />
    </div>
  );
};

export default Accounts;
