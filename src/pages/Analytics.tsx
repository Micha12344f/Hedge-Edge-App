import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function Analytics() {
  const [selectedFirm, setSelectedFirm] = useState("all");
  const [activeOnly, setActiveOnly] = useState(false);
  const [accountTab, setAccountTab] = useState("all");

  // Mock data - in a real app this would come from state/API
  const stats = {
    totalEvaluationFees: 0,
    totalPayouts: 0,
    netProfit: 0,
    roi: 0,
    totalAccounts: 1,
    totalFunding: 0,
    passingRate: 0,
    evaluationsPassed: 0,
    evaluationsFailed: 0,
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8">
          <h1 className="text-2xl font-bold text-foreground">Prop Firm Analytics</h1>
          <Select value={selectedFirm} onValueChange={setSelectedFirm}>
            <SelectTrigger className="w-full lg:w-[200px] bg-card border-primary/20">
              <SelectValue placeholder="All Prop Firms" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Prop Firms</SelectItem>
              <SelectItem value="ftmo">FTMO</SelectItem>
              <SelectItem value="5ers">The 5%ers</SelectItem>
              <SelectItem value="topstep">TopStep</SelectItem>
              <SelectItem value="mff">MyForexFunds</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content - Left Side */}
          <div className="lg:col-span-2 space-y-8">
            {/* Top Stats Row */}
            <div className="flex flex-wrap items-center gap-6 lg:gap-12">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Equity Bankroll</h2>
              </div>
              <div className="h-8 w-px bg-primary/20 hidden lg:block"></div>
              <div>
                <p className="text-xs text-muted-foreground">Total Evaluation Fees:</p>
                <p className="text-lg font-semibold">${stats.totalEvaluationFees}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Payouts:</p>
                <p className="text-lg font-semibold">${stats.totalPayouts}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Net Profit:</p>
                <p className="text-lg font-semibold">${stats.netProfit}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">ROI:</p>
                <p className="text-lg font-semibold">{stats.roi}%</p>
              </div>
            </div>

            {/* Chart Area */}
            <div className="bg-card border border-primary/20 rounded-lg p-6 min-h-[300px] flex items-center justify-center">
              <div className="w-full h-64 relative">
                {/* Dashed line placeholder for chart */}
                <div className="absolute bottom-1/2 left-0 right-0 border-t-2 border-dashed border-muted-foreground/30"></div>
                <p className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                  Chart data will appear here when you add accounts
                </p>
              </div>
            </div>

            {/* Bottom Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Total Accounts */}
              <div className="bg-card border border-primary/20 rounded-lg p-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-medium text-foreground">Total Accounts</h3>
                  <span className="text-xl font-bold">{stats.totalAccounts}</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground mb-2">
                  <span>Evaluation</span>
                  <span>Funded</span>
                </div>
                <div className="flex items-end gap-1 h-8">
                  <div className="flex-1 flex items-end">
                    <div className="w-1 bg-primary h-full"></div>
                  </div>
                  <div className="flex-1 flex items-end justify-end">
                    <div className="w-1 bg-secondary h-0"></div>
                  </div>
                </div>
                <div className="flex justify-between text-xs mt-1">
                  <span className="text-primary">0</span>
                  <span className="text-secondary">0</span>
                </div>
              </div>

              {/* Total Funding */}
              <div className="bg-card border border-primary/20 rounded-lg p-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-medium text-foreground">Total Funding (Funded only)</h3>
                  <span className="text-xl font-bold">{stats.totalFunding.toFixed(1)}</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground mb-2">
                  <span>Evaluation</span>
                  <span>Funded</span>
                </div>
                <div className="flex items-end gap-1 h-8">
                  <div className="flex-1 flex items-end">
                    <div className="w-1 bg-primary h-0"></div>
                  </div>
                  <div className="flex-1 flex items-end justify-end">
                    <div className="w-1 bg-secondary h-0"></div>
                  </div>
                </div>
                <div className="flex justify-between text-xs mt-1">
                  <span className="text-primary">$0.0</span>
                  <span className="text-secondary">$0.0</span>
                </div>
              </div>

              {/* Passing Rate */}
              <div className="bg-card border border-primary/20 rounded-lg p-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-medium text-foreground">Passing Rate</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-bold">{stats.passingRate.toFixed(1)}%</span>
                    <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30"></div>
                  </div>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground mb-2">
                  <span>Evaluations Passed</span>
                  <span>Evaluations Failed</span>
                </div>
                <div className="flex items-end gap-1 h-8">
                  <div className="flex-1 flex items-end">
                    <div className="w-1 bg-primary h-0"></div>
                  </div>
                  <div className="flex-1 flex items-end justify-end">
                    <div className="w-1 bg-destructive h-0"></div>
                  </div>
                </div>
                <div className="flex justify-between text-xs mt-1">
                  <span className="text-primary">{stats.evaluationsPassed}</span>
                  <span className="text-destructive">{stats.evaluationsFailed}</span>
                </div>
              </div>
            </div>

            {/* Accounts Table */}
            <div className="space-y-4">
              <Tabs value={accountTab} onValueChange={setAccountTab}>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <TabsList className="bg-transparent gap-2">
                    <TabsTrigger
                      value="all"
                      className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
                    >
                      All Accounts
                    </TabsTrigger>
                    <TabsTrigger
                      value="challenges"
                      className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
                    >
                      Challenges
                    </TabsTrigger>
                    <TabsTrigger
                      value="funded"
                      className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
                    >
                      Funded Accounts
                    </TabsTrigger>
                  </TabsList>

                  <div className="flex items-center gap-4">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="active-only"
                        checked={activeOnly}
                        onCheckedChange={setActiveOnly}
                      />
                      <Label htmlFor="active-only" className="text-sm text-muted-foreground">
                        Active accounts only
                      </Label>
                    </div>
                  </div>
                </div>

                <TabsContent value="all" className="mt-4">
                  <div className="flex gap-4 mb-4">
                    <Input
                      placeholder="Search..."
                      className="max-w-xs bg-card border-primary/20"
                    />
                    <Select defaultValue="sort">
                      <SelectTrigger className="w-[140px] bg-card border-primary/20">
                        <SelectValue placeholder="Sort by..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sort">Sort by...</SelectItem>
                        <SelectItem value="date">Date</SelectItem>
                        <SelectItem value="profit">Profit</SelectItem>
                        <SelectItem value="size">Size</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="bg-card border border-primary/20 rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-primary/20 hover:bg-transparent">
                          <TableHead className="text-muted-foreground">Prop Firm</TableHead>
                          <TableHead className="text-muted-foreground">Account Size</TableHead>
                          <TableHead className="text-muted-foreground">Phase</TableHead>
                          <TableHead className="text-muted-foreground">Status</TableHead>
                          <TableHead className="text-muted-foreground">Profit</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                            No accounts found. Add accounts from the Overview page.
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>

                <TabsContent value="challenges">
                  <div className="bg-card border border-primary/20 rounded-lg p-8 text-center text-muted-foreground">
                    No challenge accounts found.
                  </div>
                </TabsContent>

                <TabsContent value="funded">
                  <div className="bg-card border border-primary/20 rounded-lg p-8 text-center text-muted-foreground">
                    No funded accounts found.
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>

          {/* Sidebar - Right Side */}
          <div className="space-y-6">
            <div className="bg-card border border-primary/20 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4">Account Details</h3>
              
              <Tabs defaultValue="fees">
                <TabsList className="bg-transparent w-full justify-start gap-2 mb-4">
                  <TabsTrigger
                    value="fees"
                    className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary text-xs"
                  >
                    Evaluation Fees
                  </TabsTrigger>
                  <TabsTrigger
                    value="payouts"
                    className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary text-xs"
                  >
                    Payouts
                  </TabsTrigger>
                  <TabsTrigger
                    value="withdrawable"
                    className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary text-xs"
                  >
                    Withdrawable
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="fees">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Total Evaluation Fees</p>
                    <p className="text-3xl font-bold">0</p>
                  </div>
                </TabsContent>

                <TabsContent value="payouts">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Total Payouts</p>
                    <p className="text-3xl font-bold">$0</p>
                  </div>
                </TabsContent>

                <TabsContent value="withdrawable">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Withdrawable Amount</p>
                    <p className="text-3xl font-bold">$0</p>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
