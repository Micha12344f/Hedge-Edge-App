import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSidebar } from '@/contexts/SidebarContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Gauge,
  LineChart,
  SlidersHorizontal,
  LogOut,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Network,
  Repeat2,
  Signal,
  SignalZero,
} from 'lucide-react';
import { useConnectionsFeed } from '@/hooks/useConnectionsFeed';
import { GradientText } from '@/components/ui/gradient-text';
import { isElectron } from '@/lib/desktop';

const navItems = [
  { icon: Gauge, label: 'Overview', path: '/app/overview' },
  { icon: Repeat2, label: 'Trade Copier', path: '/app/copier' },
  { icon: Network, label: 'Hedge Map', path: '/app/accounts' },
  { icon: LineChart, label: 'Analytics', path: '/app/analytics' },
];

const bottomNavItems = [
  { icon: SlidersHorizontal, label: 'Settings', path: '/app/settings' },
];

export const DashboardSidebar = () => {
  const { collapsed, toggleCollapsed } = useSidebar();
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  
  // Get connection status for all accounts
  const { snapshots } = useConnectionsFeed({ autoStart: true, pollingInterval: 5000 });
  
  // Calculate connection summary
  const connectionIds = Object.keys(snapshots);
  const connectedCount = connectionIds.filter(id => snapshots[id]?.session.status === 'connected').length;
  const hasConnections = connectionIds.length > 0;
  const allConnected = hasConnections && connectedCount === connectionIds.length;
  const someConnected = connectedCount > 0 && connectedCount < connectionIds.length;

  const handleSignOut = async () => {
    await signOut();
    // Remove the license key so the LicenseGate re-engages
    if (isElectron() && window.electronAPI?.license?.remove) {
      await window.electronAPI.license.remove();
    }
    window.location.reload();
  };

  return (
    <aside
      className={cn(
        'h-screen bg-gradient-to-b from-muted/40 to-background border-r border-border/30 flex flex-col transition-all duration-500 ease-out backdrop-blur-sm flex-shrink-0 sticky top-0',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-border/30">
        {!collapsed && (
          <div className="flex items-center gap-1 animate-fade-in-up">
            <TrendingUp className="w-6 h-6 text-primary" strokeWidth={2.5} />
            <GradientText 
              colors={['hsl(120, 100%, 54%)', 'hsl(45, 100%, 56%)', 'hsl(120, 100%, 54%)']} 
              animationSpeed={5}
              className="text-lg font-bold"
            >
              HedgeEdge
            </GradientText>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleCollapsed}
          className="h-8 w-8 transition-transform duration-300 hover:rotate-180"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {/* Connection Status Indicator */}
      {hasConnections && (
        <div className={cn(
          "px-4 py-2 border-b border-border/30",
          collapsed ? "flex justify-center" : ""
        )}>
          <div className={cn(
            "flex items-center gap-2 p-2 rounded-lg transition-colors",
            allConnected ? "bg-primary/10" : someConnected ? "bg-yellow-500/10" : "bg-muted/30"
          )}>
            {allConnected ? (
              <Signal className="h-4 w-4 text-primary flex-shrink-0" />
            ) : someConnected ? (
              <Signal className="h-4 w-4 text-yellow-500 flex-shrink-0" />
            ) : (
              <SignalZero className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            )}
            {!collapsed && (
              <div className="flex-1 min-w-0 flex items-center gap-2">
                <p className={cn(
                  "text-xs font-medium truncate",
                  allConnected ? "text-primary" : someConnected ? "text-yellow-500" : "text-muted-foreground"
                )}>
                  {allConnected 
                    ? 'Connected' 
                    : someConnected 
                    ? 'Partially Connected'
                    : 'No Connections'}
                </p>
                {allConnected && <span className="status-dot-pulse" />}
                {someConnected && <span className="status-dot-warning" />}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Navigation */}
      <nav className="flex-1 py-4 px-2 space-y-1">
        {navItems.map((item, index) => (
          <NavLink
            key={item.path}
            to={item.path}
            style={{ animationDelay: `${index * 50}ms` }}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 relative overflow-hidden group animate-fade-in-up',
                isActive
                  ? 'bg-primary/15 text-primary shadow-sm shadow-primary/10'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 hover:translate-x-1'
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-7 bg-primary rounded-r-full shadow-[0_0_8px_1px_hsl(var(--primary)/0.5)]" />
                )}
                <div className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-md shrink-0 transition-all duration-200",
                  isActive ? "bg-primary/10" : "group-hover:bg-muted/60"
                )}>
                  <item.icon className={cn(
                    "w-[18px] h-[18px] transition-transform duration-200",
                    isActive && "scale-110"
                  )} />
                </div>
                {!collapsed && (
                  <span className="text-sm font-medium transition-all duration-200">
                    {item.label}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Bottom Navigation */}
      <div className="py-4 px-2 border-t border-border/30 space-y-1">
        {bottomNavItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 relative overflow-hidden group',
                isActive
                  ? 'bg-primary/15 text-primary shadow-sm shadow-primary/10'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 hover:translate-x-1'
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-7 bg-primary rounded-r-full shadow-[0_0_8px_1px_hsl(var(--primary)/0.5)]" />
                )}
                <item.icon className="w-5 h-5 shrink-0" />
                {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
              </>
            )}
          </NavLink>
        ))}
        
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-muted-foreground hover:text-destructive hover:bg-destructive/10 hover:translate-x-1 w-full active:scale-[0.98]"
        >
          <LogOut className="w-5 h-5 shrink-0" />
          {!collapsed && <span className="text-sm font-medium">Sign Out</span>}
        </button>
      </div>

      {/* User Info */}
      {!collapsed && user && (
        <div className="p-4 border-t border-border/30 animate-fade-in-up">
          <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/30 transition-colors hover:bg-muted/50">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center ring-2 ring-primary/20">
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
