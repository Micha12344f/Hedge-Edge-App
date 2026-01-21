import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  BarChart3,
  BookOpen,
  Calculator,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Wallet,
  Copy,
  HelpCircle,
} from 'lucide-react';

const navItems = [
  { icon: LayoutDashboard, label: 'Overview', path: '/app/overview' },
  { icon: Wallet, label: 'Accounts', path: '/app/accounts' },
  { icon: BarChart3, label: 'Analytics', path: '/app/analytics' },
  { icon: Copy, label: 'Trade Copier', path: '/app/copier' },
  { icon: BookOpen, label: 'Journal', path: '/app/journal' },
  { icon: Calculator, label: 'Calculator', path: '/app/calculator' },
];

const bottomNavItems = [
  { icon: HelpCircle, label: 'Help', path: '/app/help' },
  { icon: Settings, label: 'Settings', path: '/app/settings' },
];

export const DashboardSidebar = () => {
  const [collapsed, setCollapsed] = useState(false);
  const { signOut, user } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <aside
      className={cn(
        'h-screen bg-muted/30 border-r border-border/50 flex flex-col transition-all duration-300',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-border/50">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold text-foreground">HedgeEdge</span>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className="h-8 w-8"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 py-4 px-2 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )
            }
          >
            <item.icon className="w-5 h-5 shrink-0" />
            {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Bottom Navigation */}
      <div className="py-4 px-2 border-t border-border/50 space-y-1">
        {bottomNavItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )
            }
          >
            <item.icon className="w-5 h-5 shrink-0" />
            {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
          </NavLink>
        ))}
        
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-muted-foreground hover:text-destructive hover:bg-destructive/10 w-full"
        >
          <LogOut className="w-5 h-5 shrink-0" />
          {!collapsed && <span className="text-sm font-medium">Sign Out</span>}
        </button>
      </div>

      {/* User Info */}
      {!collapsed && user && (
        <div className="p-4 border-t border-border/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
              <span className="text-sm font-medium text-primary">
                {user.email?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {user.email}
              </p>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
