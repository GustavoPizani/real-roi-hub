import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DateRange } from "react-day-picker";
import { DatePickerWithRange } from "@/components/ui/date-picker";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface MobileHeaderProps {
  date?: DateRange;
  setDate: (date: DateRange | undefined) => void;
  isUsingMockData: boolean;
}

const MobileHeader = ({ date, setDate, isUsingMockData }: MobileHeaderProps) => {
  return (
    <header className="sticky top-0 z-40 bg-[#0f172a]/95 backdrop-blur-xl border-b border-slate-800/50 px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-black tracking-tighter text-white">
            REAL <span className="text-[#f90f54]">ROI</span>
          </h1>
          <div className={cn(
            "w-2 h-2 rounded-full animate-pulse",
            isUsingMockData ? 'bg-red-500' : 'bg-green-500'
          )} />
        </div>
        
        <Popover>
          <PopoverTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon"
              className="min-w-[44px] min-h-[44px] text-slate-400 hover:text-white hover:bg-slate-800/50 active:scale-95"
            >
              <CalendarDays className="w-5 h-5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 bg-[#1e293b] border-slate-700" align="end">
            <DatePickerWithRange date={date} setDate={setDate} />
          </PopoverContent>
        </Popover>
      </div>
    </header>
  );
};

export default MobileHeader;

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
