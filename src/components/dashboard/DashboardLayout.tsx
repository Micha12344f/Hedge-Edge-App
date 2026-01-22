import { Outlet } from 'react-router-dom';
import { DashboardSidebar } from './DashboardSidebar';
import { AnimatedBackground } from '@/components/ui/animated-background';
import { SidebarProvider } from '@/contexts/SidebarContext';

export const DashboardLayout = () => {
  return (
    <SidebarProvider>
      <AnimatedBackground>
        <div className="min-h-screen flex">
          <DashboardSidebar />
          <main className="flex-1 overflow-auto">
            <Outlet />
          </main>
        </div>
      </AnimatedBackground>
    </SidebarProvider>
  );
};
