import { useState } from "react";
import { Search, Play, Bell, RefreshCw, Settings, Info, Bookmark, MoreVertical, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ArbitrageBet {
  id: string;
  arbPercent: number;
  eventDate: string;
  eventName: string;
  sport: string;
  league: string;
  market: string;
  outcomes: {
    name: string;
    odds: number;
    book: string;
    betSize: number;
  }[];
  profit: { min: number; max: number };
}

export default function HedgeCalculator() {
  const [searchQuery, setSearchQuery] = useState("");
  const [betSize, setBetSize] = useState("50");
  const [activeTab, setActiveTab] = useState("pre-match");

  // Mock arbitrage data
  const [bets] = useState<ArbitrageBet[]>([
    {
      id: "1",
      arbPercent: 5.21,
      eventDate: "Thu, Jan 22 at 12:00 AM",
      eventName: "Detroit Red Wings vs Toronto Maple Leafs",
      sport: "Hockey",
      league: "NHL",
      market: "Moneyline",
      outcomes: [
        { name: "Detroit Red Wings", odds: 110, book: "DraftKings", betSize: 35 },
        { name: "Toronto Maple Leafs", odds: 112, book: "Betway", betSize: 34 },
      ],
      profit: { min: 3.08, max: 4.50 },
    },
    {
      id: "2",
      arbPercent: 5.21,
      eventDate: "Thu, Jan 22 at 12:00 AM",
      eventName: "Detroit Red Wings vs Toronto Maple Leafs",
      sport: "Hockey",
      league: "NHL",
      market: "Moneyline",
      outcomes: [
        { name: "Detroit Red Wings", odds: 110, book: "DraftKings", betSize: 35 },
        { name: "Toronto Maple Leafs", odds: 112, book: "Betway", betSize: 34 },
      ],
      profit: { min: 3.08, max: 4.50 },
    },
    {
      id: "3",
      arbPercent: 5.21,
      eventDate: "Thu, Jan 22 at 12:00 AM",
      eventName: "Detroit Red Wings vs Toronto Maple Leafs",
      sport: "Hockey",
      league: "NHL",
      market: "Moneyline",
      outcomes: [
        { name: "Detroit Red Wings", odds: 110, book: "FanDuel", betSize: 35 },
        { name: "Toronto Maple Leafs", odds: 112, book: "Betway", betSize: 34 },
      ],
      profit: { min: 3.08, max: 4.50 },
    },
    {
      id: "4",
      arbPercent: 5.21,
      eventDate: "Thu, Jan 22 at 12:00 AM",
      eventName: "Detroit Red Wings vs Toronto Maple Leafs",
      sport: "Hockey",
      league: "NHL",
      market: "Moneyline",
      outcomes: [
        { name: "Detroit Red Wings", odds: 110, book: "FanDuel", betSize: 35 },
        { name: "Toronto Maple Leafs", odds: 112, book: "Betway", betSize: 34 },
      ],
      profit: { min: 3.08, max: 4.50 },
    },
  ]);

  const getBookColor = (book: string) => {
    const colors: Record<string, string> = {
      DraftKings: "bg-[#53d337]",
      Betway: "bg-[#00a0e2]",
      FanDuel: "bg-[#1493ff]",
      BetMGM: "bg-[#c4a962]",
      Caesars: "bg-[#0a4833]",
      PointsBet: "bg-[#e63946]",
      "Bet365": "bg-[#0a7b3e]",
    };
    return colors[book] || "bg-primary";
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6">
        {/* Notice Banner */}
        <div className="bg-card border border-primary/20 rounded-lg p-3 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full border-2 border-muted-foreground flex items-center justify-center">
              <span className="text-xs">✓</span>
            </div>
            <p className="text-sm">
              <span className="font-medium">We've filtered bets to Main Markets only.</span>
              <span className="text-muted-foreground ml-2">
                To avoid limits, hit at least 20 of these before exploring Player Props and Alternate Lines.
              </span>
              <button className="text-primary hover:underline ml-2">Adjust filters</button>
            </p>
          </div>
          <button className="text-muted-foreground hover:text-foreground">×</button>
        </div>

        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-foreground">Arbitrage Bets</h1>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="bg-card border border-primary/20">
                <TabsTrigger
                  value="pre-match"
                  className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary"
                >
                  Pre-Match <span className="ml-1 text-muted-foreground">100</span>
                </TabsTrigger>
                <TabsTrigger
                  value="live"
                  className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary"
                >
                  Live
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-[150px] bg-card border-primary/20"
              />
            </div>
            <div className="flex items-center gap-1 bg-card border border-primary/20 rounded-md px-3 py-2">
              <span className="text-sm text-muted-foreground">$</span>
              <Input
                type="number"
                value={betSize}
                onChange={(e) => setBetSize(e.target.value)}
                className="w-12 border-0 bg-transparent p-0 text-center focus-visible:ring-0"
              />
            </div>
            <Button variant="outline" size="icon" className="border-primary/20">
              <Play className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon" className="border-primary/20 relative">
              <Settings className="w-4 h-4" />
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full"></span>
            </Button>
            <Button variant="outline" size="icon" className="border-primary/20">
              <Bell className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon" className="border-primary/20">
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon" className="border-primary/20">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-card border border-primary/20 rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-primary/20 hover:bg-transparent">
                <TableHead className="w-12"></TableHead>
                <TableHead className="text-muted-foreground">ARB %</TableHead>
                <TableHead className="text-muted-foreground">EVENT</TableHead>
                <TableHead className="text-muted-foreground">MARKET</TableHead>
                <TableHead className="text-muted-foreground">BOOKS</TableHead>
                <TableHead className="text-muted-foreground">
                  <div className="flex items-center gap-1">
                    1-CLICK BET
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="w-3 h-3" />
                      </TooltipTrigger>
                      <TooltipContent>
                        Click to place bet automatically
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </TableHead>
                <TableHead className="text-muted-foreground">BET SIZE</TableHead>
                <TableHead className="text-muted-foreground">
                  <div className="flex items-center gap-1">
                    PROFIT
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="w-3 h-3" />
                      </TooltipTrigger>
                      <TooltipContent>
                        Estimated profit range
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bets.map((bet) => (
                <TableRow key={bet.id} className="border-primary/20">
                  <TableCell>
                    <div className="flex flex-col items-center gap-1">
                      <button className="text-muted-foreground hover:text-foreground">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="3" width="7" height="7" />
                          <rect x="14" y="3" width="7" height="7" />
                          <rect x="3" y="14" width="7" height="7" />
                          <rect x="14" y="14" width="7" height="7" />
                        </svg>
                      </button>
                      <button className="text-primary hover:text-primary/80">
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-primary font-semibold">{bet.arbPercent}%</span>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="text-xs text-muted-foreground">{bet.eventDate}</p>
                      <p className="font-medium text-secondary">{bet.eventName}</p>
                      <p className="text-xs text-muted-foreground">{bet.sport} • {bet.league}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-primary">{bet.market}</span>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-2">
                      {bet.outcomes.map((outcome, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <span className="text-sm w-4">{idx + 1}</span>
                          <span className="text-sm flex-1">{outcome.name}</span>
                          <span className="text-sm text-muted-foreground">+{outcome.odds}</span>
                          <div className={`w-6 h-6 rounded ${getBookColor(outcome.book)} flex items-center justify-center`}>
                            <span className="text-xs font-bold text-white">
                              {outcome.book.charAt(0)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-2">
                      {bet.outcomes.map((outcome, idx) => (
                        <div key={idx}>
                          <Button
                            variant="outline"
                            size="sm"
                            className={`w-20 text-xs ${
                              idx === 0
                                ? "border-primary bg-primary/10 text-primary hover:bg-primary/20"
                                : "border-muted-foreground/30 text-muted-foreground hover:bg-muted"
                            }`}
                          >
                            {idx === 0 ? "DUAL ↗" : "BET ↗"}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-2">
                      {bet.outcomes.map((outcome, idx) => (
                        <div key={idx} className="flex items-center gap-1">
                          <span className="text-xs text-muted-foreground">BET</span>
                          <div className="bg-muted border border-primary/20 rounded px-2 py-1 text-sm">
                            ${outcome.betSize}
                          </div>
                        </div>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-right">
                      <p className="text-primary font-medium">${bet.profit.min.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">to</p>
                      <p className="text-primary font-medium">${bet.profit.max.toFixed(2)}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col items-center gap-2">
                      <button className="text-muted-foreground hover:text-foreground">
                        <Bookmark className="w-4 h-4" />
                      </button>
                      <button className="text-muted-foreground hover:text-foreground">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
