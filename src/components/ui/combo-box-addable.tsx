import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '../ui/command';
import { ChevronsUpDown, Check, PlusCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Item {
  id?: string;
  name: string;
  label?: string;
}

interface ComboBoxAddableProps {
  items: Item[];
  value: string;
  onSelect: (value: string) => void;
  onAddNew: (newValue: string) => void;
  placeholder: string;
}

const ComboBoxAddable: React.FC<ComboBoxAddableProps> = ({
  items,
  value,
  onSelect,
  onAddNew,
  placeholder,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const safeItems = Array.isArray(items) ? items : [];
  const selectedItem = safeItems.find((item) => item.name === value);

  const filteredItems = query
    ? safeItems.filter((item) =>
        (item.label || item.name).toLowerCase().includes(query.toLowerCase())
      )
    : safeItems;

  const isNewEntry =
    query.trim() !== '' &&
    !safeItems.some(
      (item) =>
        (item.label || item.name).toLowerCase() === query.trim().toLowerCase()
    );

  const handleSelect = (currentValue: string) => {
    onSelect(currentValue);
    setOpen(false);
    setQuery('');
  };

  const handleAddNew = () => {
    if (isNewEntry) {
      onAddNew(query.trim());
      setOpen(false);
      setQuery('');
    }
  };

  // Keyboard handling
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();

      if (e.ctrlKey || e.shiftKey) {
        // Ctrl+Enter or Shift+Enter → Add new
        if (isNewEntry) handleAddNew();
      } else {
        // Plain Enter → select highlighted or first in list
        if (filteredItems.length > 0) {
          handleSelect(filteredItems[0].name);
        }
      }
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {selectedItem
            ? selectedItem.label || selectedItem.name
            : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="z-50 w-[300px] p-0 bg-popover">
        <Command>
          <CommandInput
            placeholder={placeholder}
            value={query}
            onValueChange={setQuery}
            onKeyDown={handleKeyDown}
          />
          <CommandList>
            {filteredItems.length > 0 && (
              <CommandGroup>
                {filteredItems.map((item) => (
                  <CommandItem
                    key={item.id || item.name}
                    onSelect={() => handleSelect(item.name)}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === item.name ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    {item.label || item.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            <CommandEmpty>
              {isNewEntry ? (
                <div className="flex items-center justify-between px-2 py-1 text-sm text-text-mid">
                  <span>
                    Press <kbd className="px-1 py-0.5 text-xs bg-surface-canvas">Ctrl</kbd>
                    +<kbd className="px-1 py-0.5 text-xs bg-surface-canvas">Enter</kbd> or use{" "}
                    <PlusCircle className="inline w-4 h-4 text-blue-600" /> below to
                    add "{query.trim()}"
                  </span>
                </div>
              ) : (
                <div className="p-2 text-sm text-text-mid">No results found</div>
              )}
            </CommandEmpty>
          </CommandList>
        </Command>

        {/* Mobile-friendly "+" button (always visible when new entry possible) */}
        {isNewEntry && (
          <div className="border-t px-2 py-2 flex justify-end">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={handleAddNew}
              className="flex items-center space-x-2"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Add "{query.trim()}"</span>
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default ComboBoxAddable;
