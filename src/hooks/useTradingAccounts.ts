import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface TradingAccount {
  id: string;
  user_id: string;
  account_name: string;
  prop_firm: string | null;
  account_size: number;
  current_balance: number;
  phase: 'evaluation' | 'funded' | 'live';
  platform: string | null;
  server: string | null;
  login?: string | null;
  profit_target: number | null;
  max_loss: number | null;
  max_daily_loss: number | null;
  min_trading_days: number | null;
  trading_days_completed: number | null;
  pnl: number;
  pnl_percent: number;
  is_active: boolean;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateAccountData {
  account_name: string;
  prop_firm?: string;
  account_size?: number;
  current_balance?: number;
  phase: 'evaluation' | 'funded' | 'live';
  platform?: string;
  server?: string;
  login?: string;
  profit_target?: number;
  max_loss?: number;
  max_daily_loss?: number;
  min_trading_days?: number;
}

// Local storage key for demo accounts
const LOCAL_ACCOUNTS_KEY = 'hedge_edge_demo_accounts';

const getLocalAccounts = (): TradingAccount[] => {
  try {
    const stored = localStorage.getItem(LOCAL_ACCOUNTS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const saveLocalAccounts = (accounts: TradingAccount[]) => {
  localStorage.setItem(LOCAL_ACCOUNTS_KEY, JSON.stringify(accounts));
};

export const useTradingAccounts = () => {
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchAccounts = async () => {
    setLoading(true);
    
    // If user is authenticated, try Supabase first
    if (user) {
      const { data, error } = await supabase
        .from('trading_accounts')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        setAccounts(data as TradingAccount[]);
        setLoading(false);
        return;
      }
    }
    
    // Fallback to local storage for demo mode
    const localAccounts = getLocalAccounts();
    setAccounts(localAccounts);
    setLoading(false);
  };

  const createAccount = async (data: CreateAccountData) => {
    // If user is authenticated, use Supabase
    if (user) {
      // Strip login field - not in Supabase schema, only for demo mode
      const { login, ...supabaseData } = data;
      const { error } = await supabase
        .from('trading_accounts')
        .insert({
          ...supabaseData,
          user_id: user.id,
          current_balance: data.current_balance ?? data.account_size ?? 0,
        });

      if (error) {
        toast({
          title: 'Error creating account ❌',
          description: error.message,
          variant: 'destructive',
        });
        return { error };
      }
    } else {
      // Demo mode - use local storage
      const newAccount: TradingAccount = {
        id: crypto.randomUUID(),
        user_id: 'demo',
        account_name: data.account_name,
        prop_firm: data.prop_firm || null,
        account_size: data.account_size || 0,
        current_balance: data.current_balance ?? data.account_size ?? 0,
        phase: data.phase,
        platform: data.platform || null,
        server: data.server || null,
        login: data.login || null,
        profit_target: data.profit_target || null,
        max_loss: data.max_loss || null,
        max_daily_loss: data.max_daily_loss || null,
        min_trading_days: data.min_trading_days || null,
        trading_days_completed: 0,
        pnl: 0,
        pnl_percent: 0,
        is_active: true,
        last_sync_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      
      const localAccounts = getLocalAccounts();
      const updated = [newAccount, ...localAccounts];
      saveLocalAccounts(updated);
    }

    toast({
      title: 'Account created 🎉',
      description: 'Your trading account has been added.',
    });
    
    await fetchAccounts();
    return { error: null };
  };

  const updateAccount = async (id: string, data: Partial<CreateAccountData>) => {
    if (user) {
      const { error } = await supabase
        .from('trading_accounts')
        .update(data)
        .eq('id', id);

      if (error) {
        toast({
          title: 'Error updating account ❌',
          description: error.message,
          variant: 'destructive',
        });
        return { error };
      }
    } else {
      // Demo mode
      const localAccounts = getLocalAccounts();
      const updated = localAccounts.map(acc => 
        acc.id === id ? { ...acc, ...data, updated_at: new Date().toISOString() } : acc
      );
      saveLocalAccounts(updated);
    }

    toast({
      title: 'Account updated ✅',
      description: 'Your trading account has been updated.',
    });
    
    await fetchAccounts();
    return { error: null };
  };

  const deleteAccount = async (id: string) => {
    if (user) {
      const { error } = await supabase
        .from('trading_accounts')
        .delete()
        .eq('id', id);

      if (error) {
        toast({
          title: 'Error deleting account ❌',
          description: error.message,
          variant: 'destructive',
        });
        return { error };
      }
    } else {
      // Demo mode
      const localAccounts = getLocalAccounts();
      const updated = localAccounts.filter(acc => acc.id !== id);
      saveLocalAccounts(updated);
    }

    toast({
      title: 'Account deleted 🗑️',
      description: 'Your trading account has been removed.',
    });
    
    await fetchAccounts();
    return { error: null };
  };

  useEffect(() => {
    fetchAccounts();
  }, [user]);

  return {
    accounts,
    loading,
    fetchAccounts,
    createAccount,
    updateAccount,
    deleteAccount,
  };
};
