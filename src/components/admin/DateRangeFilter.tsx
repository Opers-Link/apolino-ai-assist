import { useState } from 'react';
import { Calendar as CalendarIcon, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Card } from '@/components/ui/card';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';

interface DateRangeFilterProps {
  onFilterChange: (startDate: Date | null, endDate: Date | null) => void;
}

type QuickFilter = 'last7days' | 'last30days' | 'thisMonth' | 'custom' | null;

export function DateRangeFilter({ onFilterChange }: DateRangeFilterProps) {
  const [activeFilter, setActiveFilter] = useState<QuickFilter>(null);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  const handleQuickFilter = (filter: QuickFilter, startDate: Date, endDate: Date) => {
    setActiveFilter(filter);
    setDateRange({ from: startDate, to: endDate });
    onFilterChange(startDate, endDate);
  };

  const handleLast7Days = () => {
    const end = new Date();
    const start = subDays(end, 7);
    handleQuickFilter('last7days', start, end);
  };

  const handleLast30Days = () => {
    const end = new Date();
    const start = subDays(end, 30);
    handleQuickFilter('last30days', start, end);
  };

  const handleThisMonth = () => {
    const now = new Date();
    const start = startOfMonth(now);
    const end = endOfMonth(now);
    handleQuickFilter('thisMonth', start, end);
  };

  const handleCustomRange = () => {
    if (dateRange?.from && dateRange?.to) {
      setActiveFilter('custom');
      onFilterChange(dateRange.from, dateRange.to);
      setIsPopoverOpen(false);
    }
  };

  const handleClearFilter = () => {
    setActiveFilter(null);
    setDateRange(undefined);
    onFilterChange(null, null);
  };

  const getFilterLabel = () => {
    if (!activeFilter || !dateRange?.from) return null;

    const formatDate = (date: Date) => format(date, 'dd/MM/yyyy', { locale: ptBR });

    switch (activeFilter) {
      case 'last7days':
        return 'Últimos 7 dias';
      case 'last30days':
        return 'Últimos 30 dias';
      case 'thisMonth':
        return 'Este mês';
      case 'custom':
        return dateRange.to
          ? `${formatDate(dateRange.from)} - ${formatDate(dateRange.to)}`
          : formatDate(dateRange.from);
      default:
        return null;
    }
  };

  return (
    <Card className="bg-white/70 backdrop-blur-xl border border-apolar-blue/10 shadow-lg mb-6">
      <div className="p-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-apolar-gold to-apolar-gold-alt flex items-center justify-center shadow-md">
              <CalendarIcon className="h-5 w-5 text-apolar-blue" />
            </div>
            <span className="font-semibold text-apolar-blue">Período:</span>
          </div>
          
          <Button
            variant={activeFilter === 'last7days' ? 'default' : 'outline'}
            size="sm"
            onClick={handleLast7Days}
            className={activeFilter === 'last7days' 
              ? 'bg-gradient-to-r from-apolar-blue to-apolar-blue-dark text-white shadow-lg shadow-apolar-blue/30 hover:shadow-xl border-0' 
              : 'border-apolar-blue/20 hover:border-apolar-gold/50 hover:bg-apolar-gold/5 transition-all duration-300'}
          >
            Últimos 7 dias
          </Button>

          <Button
            variant={activeFilter === 'last30days' ? 'default' : 'outline'}
            size="sm"
            onClick={handleLast30Days}
            className={activeFilter === 'last30days' 
              ? 'bg-gradient-to-r from-apolar-blue to-apolar-blue-dark text-white shadow-lg shadow-apolar-blue/30 hover:shadow-xl border-0' 
              : 'border-apolar-blue/20 hover:border-apolar-gold/50 hover:bg-apolar-gold/5 transition-all duration-300'}
          >
            Últimos 30 dias
          </Button>

          <Button
            variant={activeFilter === 'thisMonth' ? 'default' : 'outline'}
            size="sm"
            onClick={handleThisMonth}
            className={activeFilter === 'thisMonth' 
              ? 'bg-gradient-to-r from-apolar-blue to-apolar-blue-dark text-white shadow-lg shadow-apolar-blue/30 hover:shadow-xl border-0' 
              : 'border-apolar-blue/20 hover:border-apolar-gold/50 hover:bg-apolar-gold/5 transition-all duration-300'}
          >
            Este mês
          </Button>

          <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant={activeFilter === 'custom' ? 'default' : 'outline'}
                size="sm"
                className={activeFilter === 'custom' 
                  ? 'bg-gradient-to-r from-apolar-blue to-apolar-blue-dark text-white shadow-lg shadow-apolar-blue/30 hover:shadow-xl border-0' 
                  : 'border-apolar-blue/20 hover:border-apolar-gold/50 hover:bg-apolar-gold/5 transition-all duration-300'}
              >
                <CalendarIcon className="h-4 w-4 mr-2" />
                Período personalizado
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <div className="p-4 space-y-4">
                <Calendar
                  mode="range"
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={2}
                  locale={ptBR}
                  disabled={(date) => date > new Date()}
                  initialFocus
                />
                <div className="flex gap-2 justify-end border-t pt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setDateRange(undefined);
                      setIsPopoverOpen(false);
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleCustomRange}
                    disabled={!dateRange?.from || !dateRange?.to}
                    className="bg-gradient-to-r from-apolar-blue to-apolar-blue-dark hover:shadow-lg border-0"
                  >
                    Aplicar
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {activeFilter && (
            <>
              <Badge className="bg-gradient-to-r from-apolar-gold/20 to-apolar-gold-light border border-apolar-gold/30 text-apolar-blue font-medium px-4 py-2">
                📅 {getFilterLabel()}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearFilter}
                className="text-muted-foreground hover:text-apolar-red hover:bg-apolar-red/5"
              >
                <X className="h-4 w-4 mr-2" />
                Limpar
              </Button>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
