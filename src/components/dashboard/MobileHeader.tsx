import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import Sidebar from "./Sidebar";

// Alterado para exportação nomeada para bater com o import do Dashboard
export const MobileHeader = () => {
  return (
    <header className="sticky top-0 z-50 flex h-16 items-center border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:hidden">
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="mr-2">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle Menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-72">
          <Sidebar />
        </SheetContent>
      </Sheet>
      <div className="flex items-center gap-2">
        <span className="text-lg font-bold bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">
          Real ROI
        </span>
      </div>
    </header>
  );
};