import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Gift, Coins, ArrowUpRight, ArrowDownRight, Ticket, Copy, Check, Sparkles } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

const DashboardRewards = () => {
  const qc = useQueryClient();
  const [redeemAmount, setRedeemAmount] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const { data: balance } = useQuery({
    queryKey: ["rewards", "balance"],
    queryFn: () => api.get<any>("/rewards/balance"),
  });

  const { data: history } = useQuery({
    queryKey: ["rewards", "history"],
    queryFn: () => api.get<any>("/rewards/history"),
  });

  const { data: coupons } = useQuery({
    queryKey: ["rewards", "coupons"],
    queryFn: () => api.get<any>("/rewards/coupons"),
  });

  const redeemMutation = useMutation({
    mutationFn: (points: number) => api.post<any>("/rewards/redeem", { points }),
    onSuccess: (data: any) => {
      toast({ title: "Coupon Created! 🎉", description: `Code: ${data.code} — Worth BDT ${data.amount}` });
      qc.invalidateQueries({ queryKey: ["rewards"] });
      setRedeemAmount("");
    },
    onError: (err: any) => {
      toast({ title: "Redemption Failed", description: err.message, variant: "destructive" });
    },
  });

  const handleRedeem = () => {
    const pts = parseInt(redeemAmount);
    if (!pts || pts <= 0) {
      toast({ title: "Invalid Amount", description: "Enter a valid points amount", variant: "destructive" });
      return;
    }
    if (pts > (balance?.balance || 0)) {
      toast({ title: "Insufficient Points", description: "You don't have enough points", variant: "destructive" });
      return;
    }
    redeemMutation.mutate(pts);
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  };

  const pts = balance?.balance || 0;
  const earned = balance?.totalEarned || 0;
  const redeemed = balance?.totalRedeemed || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-amber-500" /> Reward Points
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Earn points on every booking. 1 Point = 1 BDT</p>
      </div>

      {/* Points Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-amber-600/5" />
          <CardContent className="p-5 relative">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                <Coins className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Available Points</p>
                <p className="text-2xl font-black text-amber-600">{Math.round(pts).toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground">≈ BDT {Math.round(pts).toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                <ArrowUpRight className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Total Earned</p>
                <p className="text-2xl font-black text-emerald-600">{Math.round(earned).toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <ArrowDownRight className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Total Redeemed</p>
                <p className="text-2xl font-black text-purple-600">{Math.round(redeemed).toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Redeem Section */}
      <Card>
        <CardContent className="p-5">
          <h3 className="text-sm font-bold flex items-center gap-2 mb-4">
            <Gift className="w-4 h-4 text-accent" /> Redeem Points for Coupon
          </h3>
          <p className="text-xs text-muted-foreground mb-3">
            Convert your points into a discount coupon. Use it during flight checkout to save money!
          </p>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground font-medium">Points to Redeem</label>
              <Input
                type="number"
                placeholder="e.g. 500"
                value={redeemAmount}
                onChange={(e) => setRedeemAmount(e.target.value)}
                min={1}
                max={pts}
                className="mt-1"
              />
              {redeemAmount && parseInt(redeemAmount) > 0 && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  You'll get a coupon worth <strong>BDT {parseInt(redeemAmount).toLocaleString()}</strong>
                </p>
              )}
            </div>
            <Button
              onClick={handleRedeem}
              disabled={redeemMutation.isPending || !redeemAmount || parseInt(redeemAmount) <= 0}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              <Ticket className="w-4 h-4 mr-1.5" />
              {redeemMutation.isPending ? "Creating..." : "Generate Coupon"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Active Coupons */}
      {(coupons?.data?.length || 0) > 0 && (
        <Card>
          <CardContent className="p-5">
            <h3 className="text-sm font-bold mb-4">Your Coupons</h3>
            <div className="space-y-3">
              {coupons?.data?.map((c: any) => (
                <div key={c.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/20">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      c.status === "active" ? "bg-accent/20" : c.status === "used" ? "bg-muted" : "bg-destructive/10"
                    }`}>
                      <Ticket className={`w-5 h-5 ${
                        c.status === "active" ? "text-accent" : c.status === "used" ? "text-muted-foreground" : "text-destructive"
                      }`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm">{c.code}</span>
                        <Badge className={`text-[9px] ${
                          c.status === "active" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
                          c.status === "used" ? "bg-muted text-muted-foreground" :
                          "bg-destructive/10 text-destructive"
                        }`}>
                          {c.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        BDT {parseFloat(c.amount).toLocaleString()} • {c.expires_at ? `Expires ${new Date(c.expires_at).toLocaleDateString()}` : "No expiry"}
                      </p>
                    </div>
                  </div>
                  {c.status === "active" && (
                    <Button variant="ghost" size="sm" onClick={() => copyCode(c.code)} className="shrink-0">
                      {copied === c.code ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transaction History */}
      <Card>
        <CardContent className="p-5">
          <h3 className="text-sm font-bold mb-4">Points History</h3>
          {(history?.data?.length || 0) === 0 ? (
            <div className="text-center py-8">
              <Coins className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">No points activity yet</p>
              <p className="text-xs text-muted-foreground mt-1">Book a flight to start earning points!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {history?.data?.map((t: any) => (
                <div key={t.id} className="flex items-center justify-between py-2.5 border-b border-border/50 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      t.type === "earn" ? "bg-emerald-100 dark:bg-emerald-900/30" : "bg-amber-100 dark:bg-amber-900/30"
                    }`}>
                      {t.type === "earn" 
                        ? <ArrowUpRight className="w-4 h-4 text-emerald-600" />
                        : <ArrowDownRight className="w-4 h-4 text-amber-600" />
                      }
                    </div>
                    <div>
                      <p className="text-xs font-medium">{t.description}</p>
                      <p className="text-[10px] text-muted-foreground">{new Date(t.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                  <span className={`text-sm font-bold ${
                    parseFloat(t.amount) > 0 ? "text-emerald-600" : "text-amber-600"
                  }`}>
                    {parseFloat(t.amount) > 0 ? "+" : ""}{Math.round(parseFloat(t.amount)).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardRewards;
