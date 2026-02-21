import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown, Search, ExternalLink } from 'lucide-react';

interface PolymarketEvent {
  id: string;
  title: string;
  description: string;
  markets: PolymarketMarket[];
  startDate: string;
  endDate: string;
  category: string;
  active: boolean;
}

interface PolymarketMarket {
  id: string;
  question: string;
  description: string;
  outcomes: string[];
  prices: number[];
  volume: number;
  active: boolean;
  closed: boolean;
  marketMakerAddress: string;
  endDate: string | null;
  category: string;
}

interface PolymarketResponse {
  events: PolymarketEvent[];
  markets: PolymarketMarket[];
}

const PolymarketCardSkeleton = () => (
  <Card className="border border-slate-200 dark:border-slate-800 overflow-hidden min-h-[200px] bg-white dark:bg-slate-900 shadow-sm rounded-2xl animate-pulse">
    <CardContent className="p-4 flex flex-col h-full space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-5 w-3/4 rounded-full bg-slate-200 dark:bg-slate-800" />
        <Skeleton className="h-4 w-full rounded-full bg-slate-100 dark:bg-slate-800/50" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-1/2 rounded-full bg-slate-100 dark:bg-slate-800/50" />
        <Skeleton className="h-4 w-2/3 rounded-full bg-slate-100 dark:bg-slate-800/50" />
      </div>
      <div className="pt-2 flex justify-between items-center">
        <Skeleton className="h-6 w-16 rounded-lg bg-slate-200 dark:bg-slate-800" />
        <Skeleton className="h-4 w-12 rounded-full bg-slate-100 dark:bg-slate-800/50" />
      </div>
    </CardContent>
  </Card>
);

const PolymarketMarketCard: React.FC<{ market: PolymarketMarket }> = ({ market }) => {
  const bestPrice = Math.max(...market.prices);
  const worstPrice = Math.min(...market.prices);

  return (
    <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm rounded-xl hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-sm font-semibold text-slate-900 dark:text-slate-100 line-clamp-2">
              {market.question}
            </CardTitle>
            <CardDescription className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              {market.category}
            </CardDescription>
          </div>
          <Badge
            variant={market.active ? "default" : "secondary"}
            className={`text-xs px-2 py-1 ${
              market.active
                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
            }`}
          >
            {market.active ? 'Active' : market.closed ? 'Closed' : 'Pending'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-600 dark:text-slate-400">Volume</span>
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              ${market.volume.toLocaleString()}
            </span>
          </div>

          <div className="space-y-2">
            {market.outcomes.map((outcome, index) => (
              <div key={outcome} className="flex items-center justify-between">
                <span className="text-xs text-slate-700 dark:text-slate-300 truncate flex-1 mr-2">
                  {outcome}
                </span>
                <div className="flex items-center space-x-1">
                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {(market.prices[index] * 100).toFixed(1)}%
                  </span>
                  {market.prices[index] > 0.5 ? (
                    <TrendingUp className="w-3 h-3 text-green-600" />
                  ) : (
                    <TrendingDown className="w-3 h-3 text-red-600" />
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-slate-600 dark:text-slate-400">
              {market.endDate ? `Ends ${new Date(market.endDate).toLocaleDateString()}` : 'No end date'}
            </span>
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs"
              onClick={() => window.open(`https://polymarket.com/market/${market.id}`, '_blank')}
            >
              <ExternalLink className="w-3 h-3 mr-1" />
              View
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export const PolymarketTab: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch markets from Polymarket CLOB API
  const { data, isLoading, error } = useQuery({
    queryKey: ['polymarket-markets'],
    queryFn: async () => {
      try {
        console.log('Fetching Polymarket data from CLOB API...');

        const response = await fetch('https://clob.polymarket.com/markets?active=true&closed=false&limit=20');

        if (!response.ok) {
          throw new Error(`API request failed: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();

        if (!result || !result.data || !Array.isArray(result.data)) {
          throw new Error('Invalid API response format');
        }

        console.log('Polymarket CLOB API success, markets found:', result.data.length);

        // Transform the data to match our interface
        const transformedMarkets = result.data.map((market: any) => {
          // Extract prices from tokens
          const prices = market.tokens?.map((token: any) => token.price || 0) || [0, 0];

          return {
            id: market.condition_id || market.id || `market_${Math.random()}`,
            question: market.question || 'Unknown Question',
            description: market.description || '',
            outcomes: market.outcomes || ['Yes', 'No'],
            prices: prices,
            volume: parseFloat(market.volume) || 0,
            active: market.active || false,
            closed: market.closed || false,
            marketMakerAddress: market.fpmm || '',
            endDate: market.end_date_iso || null,
            category: market.tags?.[0] || 'Other'
          };
        });

        return transformedMarkets as PolymarketMarket[];

      } catch (error) {
        console.error('Error fetching Polymarket data:', error);
        throw new Error('Failed to load Polymarket data. Please try again later.');
      }
    },
    refetchInterval: 30000, // Refetch every 30 seconds
    retry: 2, // Retry failed requests
  });

  const filteredMarkets = data?.filter((market) => {
    const matchesSearch = searchTerm === '' ||
      market.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
      market.category.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesSearch;
  }) || [];

  if (error) {
    return (
      <div className="text-center py-20">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 dark:bg-red-900 mb-4">
          <TrendingDown className="w-8 h-8 text-red-600" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Failed to load Polymarket data</h3>
        <p className="text-slate-500 dark:text-slate-400">Please try again later</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
          <Input
            placeholder="Search markets..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-10"
          />
        </div>
      </div>

      {/* Markets Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <PolymarketCardSkeleton key={i} />
          ))}
        </div>
      ) : filteredMarkets.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMarkets.map((market) => (
            <PolymarketMarketCard key={market.id} market={market} />
          ))}
        </div>
      ) : (
        <div className="text-center py-20">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 mb-4">
            <Search className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">No markets found</h3>
          <p className="text-slate-500 dark:text-slate-400">
            {searchTerm ? 'Try adjusting your search terms' : 'No markets available at the moment'}
          </p>
        </div>
      )}
    </div>
  );
};

export default PolymarketTab;