import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { NotebookPen, CalendarDays, LineChart, ScrollText } from 'lucide-react';

const Journal = () => {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Trading Journal</h1>
        <p className="text-muted-foreground">Track and analyze your trading decisions</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 stagger-children">
        <Card className="border-border/50 bg-card/50 card-lift">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Journal Entries</CardTitle>
            <span className="icon-container"><ScrollText className="h-3.5 w-3.5 text-primary" /></span>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">0</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50 card-lift">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">This Week</CardTitle>
            <span className="icon-container"><CalendarDays className="h-3.5 w-3.5 text-primary" /></span>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">0</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50 card-lift">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Trades Logged</CardTitle>
            <span className="icon-container"><LineChart className="h-3.5 w-3.5 text-primary" /></span>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">0</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50 card-lift">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Insights</CardTitle>
            <span className="icon-container"><NotebookPen className="h-3.5 w-3.5 text-primary" /></span>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">0</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/50 bg-card/50 border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center mb-4">
            <NotebookPen className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium text-foreground mb-2">Trading Journal Coming Soon</h3>
          <p className="text-muted-foreground text-center max-w-md">
            Document your trades, record your thoughts, and gain insights into your trading psychology.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Journal;
