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
  account_size: number;
  current_balance?: number;
  phase: 'evaluation' | 'funded' | 'live';
  platform?: string;
  server?: string;
  profit_target?: number;
  max_loss?: number;
  max_daily_loss?: number;
  min_trading_days?: number;
}

export const useTradingAccounts = () => {
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchAccounts = async () => {
    if (!user) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from('trading_accounts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast({
        title: 'Error fetching accounts',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      setAccounts(data as TradingAccount[]);
    }
    setLoading(false);
  };

  const createAccount = async (data: CreateAccountData) => {
    if (!user) return { error: new Error('Not authenticated') };

    const { error } = await supabase
      .from('trading_accounts')
      .insert({
        ...data,
        user_id: user.id,
        current_balance: data.current_balance ?? data.account_size,
      });

    if (error) {
      toast({
        title: 'Error creating account',
        description: error.message,
        variant: 'destructive',
      });
      return { error };
    }

    toast({
      title: 'Account created',
      description: 'Your trading account has been added.',
    });
    
    await fetchAccounts();
    return { error: null };
  };

  const updateAccount = async (id: string, data: Partial<CreateAccountData>) => {
    const { error } = await supabase
      .from('trading_accounts')
      .update(data)
      .eq('id', id);

    if (error) {
      toast({
        title: 'Error updating account',
        description: error.message,
        variant: 'destructive',
      });
      return { error };
    }

    toast({
      title: 'Account updated',
      description: 'Your trading account has been updated.',
    });
    
    await fetchAccounts();
    return { error: null };
  };

  const deleteAccount = async (id: string) => {
    const { error } = await supabase
      .from('trading_accounts')
      .delete()
      .eq('id', id);

    if (error) {
      toast({
        title: 'Error deleting account',
        description: error.message,
        variant: 'destructive',
      });
      return { error };
    }

    toast({
      title: 'Account deleted',
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
