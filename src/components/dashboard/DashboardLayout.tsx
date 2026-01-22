import { Outlet } from 'react-router-dom';
import { DashboardSidebar } from './DashboardSidebar';
import { AnimatedBackground } from '@/components/ui/animated-background';

export const DashboardLayout = () => {
  return (
    <AnimatedBackground>
      <div className="min-h-screen flex">
        <DashboardSidebar />
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </AnimatedBackground>
  );
};
