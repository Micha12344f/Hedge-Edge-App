import { Outlet } from 'react-router-dom';
import { DashboardSidebar } from './DashboardSidebar';

export const DashboardLayout = () => {
  return (
    <div className="min-h-screen bg-background flex">
      <DashboardSidebar />
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
};
