import { useState } from 'react';
import { useTradingAccounts } from '@/hooks/useTradingAccounts';
import { AccountCard } from '@/components/dashboard/AccountCard';
import { AddAccountModal } from '@/components/dashboard/AddAccountModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search } from 'lucide-react';

const Accounts = () => {
  const { accounts, loading, createAccount, deleteAccount } = useTradingAccounts();
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredAccounts = accounts.filter((account) =>
    account.account_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (account.prop_firm?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Accounts</h1>
          <p className="text-muted-foreground">View and manage all your trading accounts</p>
        </div>
        <Button onClick={() => setAddModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Account
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search accounts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading accounts...</div>
      ) : filteredAccounts.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            {searchQuery ? 'No accounts match your search' : 'No accounts yet. Add your first account!'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredAccounts.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
              onDelete={deleteAccount}
            />
          ))}
        </div>
      )}

      <AddAccountModal
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        onSubmit={createAccount}
      />
    </div>
  );
};

export default Accounts;
