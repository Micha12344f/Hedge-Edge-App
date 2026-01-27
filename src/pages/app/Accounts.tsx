import { useState, useEffect } from 'react';
import { useTradingAccounts, TradingAccount } from '@/hooks/useTradingAccounts';
import { DraggableHedgeMap, HedgeRelationship } from '@/components/dashboard/DraggableHedgeMap';
import { AddAccountModal } from '@/components/dashboard/AddAccountModal';
import { AccountDetailsModal } from '@/components/dashboard/AccountDetailsModal';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

// Local storage key for relationships
const RELATIONSHIPS_KEY = 'hedge_edge_relationships';
// Local storage key for accounts displayed in hedge map
const HEDGE_MAP_ACCOUNTS_KEY = 'hedge_edge_map_accounts';

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

const getStoredHedgeMapAccounts = (): string[] => {
  try {
    const stored = localStorage.getItem(HEDGE_MAP_ACCOUNTS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const saveHedgeMapAccounts = (accountIds: string[]) => {
  localStorage.setItem(HEDGE_MAP_ACCOUNTS_KEY, JSON.stringify(accountIds));
};

const Accounts = () => {
  const { accounts, loading, createAccount, deleteAccount, syncAccountFromMT5 } = useTradingAccounts();
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [selectAccountModalOpen, setSelectAccountModalOpen] = useState(false);
  const [selectedAccountToAdd, setSelectedAccountToAdd] = useState<string>('');
  const [relationships, setRelationships] = useState<HedgeRelationship[]>(getStoredRelationships);
  const [selectedAccount, setSelectedAccount] = useState<TradingAccount | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [hedgeMapAccountIds, setHedgeMapAccountIds] = useState<string[]>(getStoredHedgeMapAccounts);
  const { toast } = useToast();

  // Clean up invalid hedge map account IDs only after accounts have loaded
  useEffect(() => {
    if (!loading && accounts.length > 0) {
      const validIds = hedgeMapAccountIds.filter(id => accounts.some(acc => acc.id === id));
      if (validIds.length !== hedgeMapAccountIds.length) {
        setHedgeMapAccountIds(validIds);
        saveHedgeMapAccounts(validIds);
      }
    }
  }, [accounts, loading]); // Only run when accounts change or loading finishes

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
    const updatedRelationships = relationships.filter(r => r.sourceId !== id && r.targetId !== id);
    setRelationships(updatedRelationships);
    saveRelationships(updatedRelationships);
    
    // Remove from hedge map accounts list
    const updatedHedgeMapAccounts = hedgeMapAccountIds.filter(accountId => accountId !== id);
    setHedgeMapAccountIds(updatedHedgeMapAccounts);
    saveHedgeMapAccounts(updatedHedgeMapAccounts);
    
    await deleteAccount(id);
  };

  // Filter accounts to only show those added to the hedge map
  // hedgeMapAccountIds are already cleaned up via useEffect above
  const hedgeMapAccounts = accounts.filter(acc => hedgeMapAccountIds.includes(acc.id));
  
  // Available accounts to add (not already in the hedge map)
  const availableAccounts = accounts.filter(acc => !hedgeMapAccountIds.includes(acc.id));

  const handleAddAccountToMap = () => {
    if (selectedAccountToAdd) {
      const updated = [...hedgeMapAccountIds, selectedAccountToAdd];
      setHedgeMapAccountIds(updated);
      saveHedgeMapAccounts(updated);
      setSelectedAccountToAdd('');
      setSelectAccountModalOpen(false);
      toast({
        title: 'Account added ✓',
        description: 'Account has been added to the hedge map.',
      });
    }
  };

  const handleOpenAddAccount = () => {
    if (availableAccounts.length === 0) {
      // No existing accounts to add, open the create account modal
      setAddModalOpen(true);
    } else {
      // Show selection dialog
      setSelectAccountModalOpen(true);
    }
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
        accounts={hedgeMapAccounts}
        relationships={relationships}
        onAddAccount={handleOpenAddAccount}
        onDeleteAccount={handleDeleteAccount}
        onCreateRelationship={handleCreateRelationship}
        onDeleteRelationship={handleDeleteRelationship}
        onUpdateRelationship={handleUpdateRelationship}
        onAccountClick={handleAccountClick}
      />

      {/* Select existing account dialog */}
      <Dialog open={selectAccountModalOpen} onOpenChange={setSelectAccountModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Account to Hedge Map</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Select an account</Label>
              <Select value={selectedAccountToAdd} onValueChange={setSelectedAccountToAdd}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an account..." />
                </SelectTrigger>
                <SelectContent>
                  {availableAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.account_name} ({account.phase === 'live' ? 'Hedge' : account.phase === 'funded' ? 'Funded' : 'Evaluation'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-sm text-muted-foreground">
              Or{' '}
              <button
                type="button"
                className="text-primary hover:underline"
                onClick={() => {
                  setSelectAccountModalOpen(false);
                  setAddModalOpen(true);
                }}
              >
                create a new account
              </button>
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectAccountModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddAccountToMap} disabled={!selectedAccountToAdd}>
              Add to Map
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
