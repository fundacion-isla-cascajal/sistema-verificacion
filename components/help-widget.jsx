"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { HelpCircle, Search, ChevronDown } from "lucide-react";
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetDescription,
  SheetTrigger 
} from "@/components/ui/sheet";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { helpCategories } from "@/lib/help-data";

export function HelpWidget() {
  const pathname = usePathname();
  const [searchTerm, setSearchTerm] = useState("");

  // Ocultar widget en pantallas de enfoque
  if (
    pathname?.startsWith('/registro') ||
    pathname?.startsWith('/afiliado') ||
    pathname?.startsWith('/login')
  ) {
    return null;
  }

  const filteredCategories = helpCategories.map(cat => {
    const filteredItems = cat.items.filter(item => 
      item.question.toLowerCase().includes(searchTerm.toLowerCase()) || 
      item.answer.toLowerCase().includes(searchTerm.toLowerCase())
    );
    return { ...cat, items: filteredItems };
  }).filter(cat => cat.items.length > 0);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button 
          size="icon" 
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-2xl z-50 hover:scale-110 transition-transform"
          style={{ backgroundColor: "#ea580c" }}
        >
          <HelpCircle className="h-7 w-7 text-white" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col h-full bg-slate-50">
        <SheetHeader className="p-6 bg-[#1e3a5f] text-white">
          <SheetTitle className="text-white text-xl flex items-center gap-2">
            <HelpCircle className="h-6 w-6 text-orange-400" />
            Centro de Ayuda
          </SheetTitle>
          <SheetDescription className="text-slate-300">
            Encuentra respuestas rápidas a tus dudas.
          </SheetDescription>
        </SheetHeader>

        <div className="p-4 border-b bg-white">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar cómo hacer algo..." 
              className="pl-9 bg-slate-50"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 pb-24">
          {filteredCategories.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No se encontraron resultados para "{searchTerm}"
            </div>
          ) : (
            filteredCategories.map((category) => (
              <div key={category.id} className="mb-8">
                <h3 className="font-bold text-lg text-slate-800 mb-1">{category.title}</h3>
                <p className="text-sm text-muted-foreground mb-4">{category.description}</p>
                
                <Accordion type="single" collapsible className="w-full">
                  {category.items.map((item, index) => (
                    <AccordionItem key={index} value={`${category.id}-${index}`} className="bg-white px-4 border rounded-lg mb-2 shadow-sm">
                      <AccordionTrigger className="text-left font-semibold text-sm hover:no-underline py-3">
                        {item.question}
                      </AccordionTrigger>
                      <AccordionContent className="text-sm text-slate-600 pb-4 whitespace-pre-wrap">
                        {item.answer}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
