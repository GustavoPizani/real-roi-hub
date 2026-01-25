"use client"

import * as React from "react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Calendar as CalendarIcon, Check } from "lucide-react"
import { DateRange } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DatePickerWithRangeProps extends React.HTMLAttributes<HTMLDivElement> {
    date: DateRange | undefined;
    setDate: (date: DateRange | undefined) => void;
}

export function DatePickerWithRange({
  className,
  date,
  setDate
}: DatePickerWithRangeProps) {
  // Estado temporário para a seleção pendente
  const [tempDate, setTempDate] = React.useState<DateRange | undefined>(date);
  const [isOpen, setIsOpen] = React.useState(false);

  // Sincroniza o estado temporário quando o date externo muda
  React.useEffect(() => {
    setTempDate(date);
  }, [date]);

  // Aplica o filtro apenas quando o botão é clicado
  const handleApplyFilter = () => {
    console.log('[DatePicker] Aplicando filtro:', tempDate);
    setDate(tempDate);
    setIsOpen(false);
  };

  // Cancela a seleção e fecha o popover
  const handleCancel = () => {
    setTempDate(date);
    setIsOpen(false);
  };

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn(
              "w-full justify-start text-left font-normal bg-surface-2 border-border hover:border-muted-foreground transition-colors",
              !date && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date?.from ? (
              date.to ? (
                <>
                  {format(date.from, "dd MMM yyyy", { locale: ptBR })} -{" "}
                  {format(date.to, "dd MMM yyyy", { locale: ptBR })}
                </>
              ) : (
                format(date.from, "dd MMM yyyy", { locale: ptBR })
              )
            ) : (
              <span>Selecione um período</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 bg-[#1e293b] border-slate-700" align="start">
          <div className="p-3 border-b border-slate-700/50">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              Selecione o período
            </p>
            {tempDate?.from && (
              <p className="text-sm text-white mt-1">
                {format(tempDate.from, "dd MMM yyyy", { locale: ptBR })}
                {tempDate.to && ` - ${format(tempDate.to, "dd MMM yyyy", { locale: ptBR })}`}
              </p>
            )}
          </div>
          
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={tempDate?.from}
            selected={tempDate}
            onSelect={setTempDate}
            numberOfMonths={2}
            locale={ptBR}
            className="pointer-events-auto"
          />
          
          <div className="flex gap-2 p-3 border-t border-slate-700/50">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              className="flex-1 text-slate-400 hover:text-white hover:bg-slate-700/50"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleApplyFilter}
              disabled={!tempDate?.from || !tempDate?.to}
              className="flex-1 bg-[#f90f54] hover:bg-[#d90d49] text-white font-bold"
            >
              <Check className="w-4 h-4 mr-1" />
              Aplicar
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
