import { useState } from 'react';
import { toast } from '@/components/ui/sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import * as AleoServiceV2 from '@/services/aleoServiceV2';
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react';
import { useLocalAuctions } from '@/hooks/useLocalAuctions';


const steps = ['Basic Info', 'Item Details', 'Settings', 'Review'];

export default function CreateAuctionPage() {
  const { connected, executeTransaction, address } = useWallet();
  const { addAuction } = useLocalAuctions();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: '',
    category: '',
    currency: 'usdcx',        // NEW: Default to USDCx
    minBid: '',
    closingDate: undefined,
    description: '',
  });

  const updateField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const handlePublishAuction = async () => {
    console.log('[CreateAuction] Starting publish auction');
    console.log('[CreateAuction] Contract Version: V2.21');
    console.log('[CreateAuction] Connected:', connected);
    console.log('[CreateAuction] Form:', form);
    
    if (!connected) { 
      toast.error('Please connect your wallet first'); 
      return; 
    }
    
    if (!form.title || !form.minBid || !form.closingDate) {
      toast.error('Please fill all required fields');
      console.log('[CreateAuction] Missing fields:', {
        title: !!form.title,
        minBid: !!form.minBid,
        closingDate: !!form.closingDate
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const auctionId = Date.now() % (2 ** 32);
      const minBidAmount = Math.round(parseFloat(form.minBid.replace(/[^0-9.]/g, '')) * 1_000_000);
      const currencyType = form.currency === 'aleo' ? 1 : 0;
      
      const endTime = Math.floor(form.closingDate.getTime() / 1000);
      const revealPeriod = 86400;
      const disputePeriod = 86400;

      console.log('[CreateAuction] Auction params:', {
        auctionId,
        minBidAmount,
        reservePrice: minBidAmount,
        currencyType,
        currency: form.currency,
        assetType: 0,
        endTime,
        endTimeDate: new Date(endTime * 1000).toISOString(),
        revealPeriod,
        disputePeriod,
        version: 'v2.21'
      });

      toast.info(`Submitting ${form.currency === 'aleo' ? 'Aleo' : 'USDCx'} auction to blockchain...`);
      const result = await AleoServiceV2.createAuction(
        executeTransaction, 
        auctionId, 
        minBidAmount,
        minBidAmount,
        currencyType,
        0,
        endTime, 
        revealPeriod,
        disputePeriod
      );
      
      console.log('[CreateAuction] Transaction result:', result);
      
      // Save auction locally
      const currencyLabel = form.currency === 'aleo' ? 'Aleo' : 'USDCx';
      const auctionData = {
        auctionId,
        title: form.title,
        category: form.category || 'General',
        description: form.description,
        currency: form.currency,
        currency_type: currencyType,
        minBid: `${minBidAmount / 1_000_000} ${currencyLabel}`,
        endTime,
        closingDate: form.closingDate.toLocaleDateString(),
        seller: address,
        txId: result?.transactionId,
        version: 'v2.21'
      };
      
      console.log('[CreateAuction] Saving auction locally:', auctionData);
      addAuction(auctionData);

      toast.success(`${currencyLabel} auction created! TX: ${result?.transactionId?.slice(0, 12)}...`);
      toast.success('Auction saved to your dashboard!');

      setForm({ title: '', category: '', currency: 'usdcx', minBid: '', closingDate: undefined, description: '' });
    } catch (error) {
      console.error('[CreateAuction] Error:', error);
      toast.error(`Failed: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6" data-testid="create-auction-page">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white md:text-4xl" data-testid="create-auction-title">
          Create Auction
        </h1>
        <p className="mt-1 text-sm text-slate-400" data-testid="create-auction-subtitle">
          Set up a sealed-bid auction on-chain
        </p>
      </div>

      <Card data-testid="create-auction-form-card">
        <CardHeader>
          <CardTitle className="text-base" data-testid="create-auction-form-title">Auction Details</CardTitle>
          {!connected && (
            <div className="mt-2 rounded-lg border border-amber-500/20 bg-amber-950/30 p-2">
              <p className="text-sm text-amber-200">⚠️ Connect wallet to continue</p>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label htmlFor="auction-title" data-testid="create-auction-title-label">Auction Title</Label>
            <Input
              id="auction-title"
              value={form.title}
              onChange={(e) => updateField('title', e.target.value)}
              placeholder="e.g. Enterprise Router Procurement"
              data-testid="create-auction-title-input"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="auction-category" data-testid="create-auction-category-label">Category</Label>
              <Input
                id="auction-category"
                value={form.category}
                onChange={(e) => updateField('category', e.target.value)}
                placeholder="IT Infrastructure"
                data-testid="create-auction-category-input"
              />
            </div>
            <div>
              <Label htmlFor="auction-currency" data-testid="create-auction-currency-label">
                Bid Currency
              </Label>
              <Select value={form.currency} onValueChange={(value) => updateField('currency', value)}>
                <SelectTrigger id="auction-currency" data-testid="create-auction-currency-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="usdcx">
                    <span className="font-semibold">USDC</span>
                  </SelectItem>
                  <SelectItem value="aleo">
                    <span className="font-semibold">Aleo</span>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-400 mt-1">
                All bids must use this currency
              </p>
            </div>
          </div>
          <div>
            <Label htmlFor="auction-reserve" data-testid="create-auction-reserve-label">
              Minimum Bid ({form.currency === 'aleo' ? 'Aleo' : 'USDC'})
            </Label>
            <Input
              id="auction-reserve"
              value={form.minBid}
              onChange={(e) => updateField('minBid', e.target.value)}
              placeholder={form.currency === 'aleo' ? 'e.g. 1.0' : 'e.g. 100.0'}
              type="number"
              step="0.000001"
              data-testid="create-auction-reserve-input"
            />
            <p className="text-xs text-slate-400 mt-1">
              {form.currency === 'aleo' 
                ? '1 Aleo = 1,000,000 microcredits' 
                : '1 USDC = 1,000,000 micro-units'}
            </p>
          </div>
          <div>
            <Label htmlFor="auction-closing" data-testid="create-auction-closing-label">Closing Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="auction-closing"
                  variant="outline"
                  className="w-full justify-start font-normal"
                  data-testid="create-auction-closing-trigger"
                >
                  <CalendarIcon className="mr-2 h-4 w-4 text-slate-500" />
                  {form.closingDate ? format(form.closingDate, 'dd MMM yyyy') : 'Select closing date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={form.closingDate}
                  onSelect={(date) => updateField('closingDate', date)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <Label htmlFor="auction-description" data-testid="create-auction-description-label">Description</Label>
            <Textarea
              id="auction-description"
              value={form.description}
              onChange={(e) => updateField('description', e.target.value)}
              placeholder="Enter specifications, SLA, and tender requirements."
              className="min-h-28"
              data-testid="create-auction-description-input"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              onClick={() => {
                console.log('[CreateAuction] Publish button clicked!');
                handlePublishAuction();
              }}
              disabled={isSubmitting || !connected}
              data-testid="create-auction-publish-button"
            >
              {isSubmitting ? 'Publishing...' : 'Publish Auction'}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                console.log('[CreateAuction] Cancel clicked');
                setForm({ title: '', category: '', minBid: '', closingDate: undefined, description: '' });
                toast.warning('Form cleared');
              }}
              disabled={isSubmitting}
              data-testid="create-auction-cancel-button"
            >
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
