import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Wallet, Plus, History, TrendingUp, TrendingDown } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAdminQuery, adminApiRequest } from '@/lib/adminApi';
import { useToast } from '@/hooks/use-toast';

interface TreasuryWallet {
  balance: string;
  totalDeposited: string;
  totalUsed: string;
  totalEarned: string;
  status: string;
}

interface Transaction {
  id: number;
  type: 'deposit' | 'debit' | 'credit' | 'settlement';
  amount: string;
  description: string;
  status: string;
  balanceBefore: string;
  balanceAfter: string;
  createdAt: string;
}

interface TreasuryWalletPanelProps {
  adminUser: {
    id: string;
    username: string;
    firstName: string;
    email: string;
    isAdmin: boolean;
  };
}

export const TreasuryWalletPanel: React.FC<TreasuryWalletPanelProps> = ({
  adminUser,
}) => {
  const [depositAmount, setDepositAmount] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch wallet balance
  const { data: wallet, isLoading: walletLoading, error: walletError } = useAdminQuery(`/api/admin/treasury/wallet`, {
    retry: false,
  });

  // Fetch transactions
  const { data: transactions } = useAdminQuery(`/api/admin/treasury/wallet/transactions?limit=20`, {
    retry: false,
  });

  // Initiate deposit
  const initiateDepositMutation = useMutation({
    mutationFn: async (amount: number) => {
      return adminApiRequest('/api/admin/treasury/wallet/deposit/initiate', {
        method: 'POST',
        body: JSON.stringify({
          amount,
          email: adminUser.email,
        }),
      });
    },
    onSuccess: (data) => {
      // Show Paystack modal instead of redirecting
      if (data.publicKey && data.reference) {
        const handler = (window as any).PaystackPop.setup({
          key: data.publicKey,
          email: adminUser.email,
          amount: parseFloat(depositAmount) * 100, // Convert to kobo
          currency: 'NGN',
          ref: data.reference,
          callback: function(response: any) {
            if (response.status === 'success') {
              // Payment successful, verify with backend
              adminApiRequest('/api/admin/treasury/wallet/deposit/verify', {
                method: 'POST',
                body: JSON.stringify({
                  reference: response.reference,
                }),
              }).then(() => {
                // Refresh wallet data
                queryClient.invalidateQueries({ queryKey: ['/api/admin/treasury/wallet'] });
                queryClient.invalidateQueries({ queryKey: ['/api/admin/treasury/wallet/transactions'] });
                toast({
                  title: "Deposit Successful",
                  description: "Your treasury wallet has been credited.",
                  variant: "success",
                });
              }).catch((error) => {
                console.error('Verification failed:', error);
                toast({
                  title: "Verification Failed",
                  description: "Payment completed but verification failed. Please contact support.",
                  variant: "error",
                });
              });
            } else {
              toast({
                title: "Payment Failed",
                description: "Payment was not successful. Please try again.",
                variant: "error",
              });
            }
          },
          onClose: function() {
            // Payment modal was closed
            console.log('Payment modal closed');
          }
        });
        
        handler.openIframe();
      } else {
        toast({
          title: "Payment Initialization Failed",
          description: "Failed to initialize payment. Please try again.",
          variant: "error",
        });
      }
    },
    onError: (error) => {
      console.error('Deposit initiation failed:', error);
      toast({
        title: "Deposit Failed",
        description: "Failed to initiate deposit. Please try again.",
        variant: "error",
      });
    },
  });

  const handleDeposit = () => {
    const amount = parseFloat(depositAmount);
    if (!amount || amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount greater than 0.",
        variant: "error",
      });
      return;
    }

    setIsProcessing(true);
    initiateDepositMutation.mutate(amount, {
      onSettled: () => setIsProcessing(false),
    });
  };

  if (walletLoading) {
    return <div className="flex items-center justify-center h-96">Loading...</div>;
  }

  if (walletError) {
    return (
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Treasury Wallet</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-slate-400">
            {walletError instanceof Error ? walletError.message : 'Failed to load wallet'}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!wallet) {
    return (
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Treasury Wallet</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-slate-400">No treasury wallet found. Please contact support.</p>
        </CardContent>
      </Card>
    );
  }

  const balance = parseFloat(wallet.balance);
  const totalEarned = parseFloat(wallet.totalEarned);
  const totalUsed = parseFloat(wallet.totalUsed);
  const netPnL = totalEarned - totalUsed;

  return (
    <div className="space-y-6">
      {/* Main Balance Card */}
      <Card className="border-2 border-primary bg-slate-800 border-slate-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-white">
                <Wallet className="h-5 w-5" />
                Treasury Wallet
              </CardTitle>
              <CardDescription className="text-slate-400">
                Your dedicated Treasury fund for matching bets
              </CardDescription>
            </div>
            <Badge
              variant={wallet.status === 'active' ? 'default' : 'secondary'}
            >
              {wallet.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Balance Display */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Available Balance</p>
              <p className="text-3xl font-bold text-green-600">
                ₦{balance.toLocaleString('en-NG', { maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Net P&L</p>
              <p
                className={`text-3xl font-bold ${
                  netPnL >= 0 ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {netPnL >= 0 ? '+' : ''}
                ₦{Math.abs(netPnL).toLocaleString('en-NG', { maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-4 pt-4 border-t">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Total Deposited</p>
              <p className="font-semibold">
                ₦{parseFloat(wallet.totalDeposited).toLocaleString('en-NG', {
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Total Used</p>
              <p className="font-semibold text-red-600">
                ₦{totalUsed.toLocaleString('en-NG', {
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Total Earned</p>
              <p className="font-semibold text-green-600">
                ₦{totalEarned.toLocaleString('en-NG', {
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>
          </div>

          {/* Deposit Button */}
          <Dialog>
            <DialogTrigger asChild>
              <Button className="w-full" size="lg">
                <Plus className="h-4 w-4 mr-2" />
                Deposit to Treasury
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Deposit to Treasury Wallet</DialogTitle>
                <DialogDescription>
                  Add funds to your Treasury wallet via Paystack
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Amount (₦)</label>
                  <Input
                    type="number"
                    placeholder="Enter amount"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    min="1000"
                    step="1000"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Minimum: ₦1,000
                  </p>
                </div>
                <Button
                  onClick={handleDeposit}
                  disabled={isProcessing || !depositAmount}
                  className="w-full"
                >
                  {isProcessing ? 'Processing...' : 'Continue to Payment'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      {/* Transaction History */}
      {transactions && transactions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Transaction History
            </CardTitle>
            <CardDescription>Recent Treasury wallet transactions</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-96">
              <div className="space-y-3 pr-4">
                {transactions.map((tx) => {
                  const amount = parseFloat(tx.amount);
                  const isCredit = tx.type === 'deposit' || tx.type === 'credit';
                  const icon = isCredit ? (
                    <TrendingUp className="h-4 w-4 text-green-600" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-600" />
                  );

                  return (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        {icon}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm capitalize">
                            {tx.type === 'deposit'
                              ? 'Deposit'
                              : tx.type === 'credit'
                                ? 'Settlement Win'
                                : 'Match Created'}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {tx.description}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(tx.createdAt).toLocaleDateString('en-NG')}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p
                          className={`font-semibold ${
                            isCredit ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          {isCredit ? '+' : '-'}₦
                          {amount.toLocaleString('en-NG', {
                            maximumFractionDigits: 2,
                          })}
                        </p>
                        <Badge variant="outline" className="mt-1 text-xs">
                          {tx.status}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TreasuryWalletPanel;
