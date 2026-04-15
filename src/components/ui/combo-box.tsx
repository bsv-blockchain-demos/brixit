import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command';
import { ChevronsUpDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils'; // Assuming this utility function exists

interface Item {
  id?: string; // ID is optional
  name: string;
  label?: string; // Display label
}

interface ComboboxProps {
  items: Item[];
  value: string;
  onSelect: (value: string) => void;
  placeholder: string;
}

function capitalizeWords(str: string): string {
  return str.replace(/\b\w/g, (c) => c.toUpperCase());
}

const Combobox: React.FC<ComboboxProps> = ({ items, value, onSelect, placeholder }) => {
  const [open, setOpen] = useState(false);
  const safeItems = Array.isArray(items) ? items : [];
  const selectedItem = safeItems.find(
    (item) => item.name.toLowerCase() === value.toLowerCase()
  );

  const displayText = (item: Item) => capitalizeWords(item.label || item.name);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {selectedItem ? displayText(selectedItem) : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="z-50 w-[300px] p-0 bg-popover">
        <Command>
          <CommandInput placeholder={placeholder} />
          <CommandList>
            <CommandEmpty>No item found.</CommandEmpty>
            <CommandGroup>
              {safeItems.map((item) => (
                <CommandItem
                  key={item.id || item.name}
                  value={item.label || item.name}
                  onSelect={() => {
                    onSelect(item.name);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === item.name ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {displayText(item)}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default Combobox;
