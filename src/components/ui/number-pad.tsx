'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { X, Check, Delete } from 'lucide-react';

interface NumberPadProps {
  isOpen: boolean;
  onClose: () => void;
  onValue: (value: string) => void;
  onSubmit: (value: string) => void;
  title?: string;
  decimal?: boolean;
  maxLength?: number;
  initialValue?: string;
}

export function NumberPad({
  isOpen,
  onClose,
  onValue,
  onSubmit,
  title = 'Enter Value',
  decimal = true,
  maxLength = 10,
  initialValue = '',
}: NumberPadProps) {
  const [value, setValue] = useState(initialValue);
  const previousIsOpen = useRef(isOpen);

  // Update value when dialog opens
  useEffect(() => {
    if (isOpen && !previousIsOpen.current) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setValue(initialValue);
    }
    previousIsOpen.current = isOpen;
  }, [isOpen, initialValue]);

  const handleKeyPress = (key: string) => {
    if (key === 'C') {
      setValue('');
    } else if (key === '⌫') {
      setValue(prev => prev.slice(0, -1));
    } else if (key === '.') {
      // Only allow one decimal point
      if (!value.includes('.')) {
        setValue(prev => {
          const newValue = prev + '.';
          if (newValue.length <= maxLength) {
            onValue(newValue);
            return newValue;
          }
          return prev;
        });
      }
    } else {
      // Number key
      setValue(prev => {
        const newValue = prev + key;
        if (newValue.length <= maxLength) {
          onValue(newValue);
          return newValue;
        }
        return prev;
      });
    }
  };

  const handleSubmit = () => {
    onValue(value);
    onSubmit(value);
    setValue('');
    onClose();
  };

  const handleClose = () => {
    setValue('');
    onClose();
  };

  const keys = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    decimal ? ['.', '0', '⌫'] : ['0', '⌫'],
  ];

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-sm p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle>{title}</DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        {/* Display */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900/50">
          <div className="text-center">
            <input
              type="text"
              value={value || '0'}
              readOnly
              className="w-full text-3xl font-mono font-bold text-center bg-transparent border-0 focus:outline-none text-slate-900 dark:text-white"
            />
          </div>
        </div>

        {/* Number Pad */}
        <div className="p-4 pt-0">
          <div className="grid grid-cols-3 gap-2">
            {keys.map((row, rowIndex) => (
              <div key={rowIndex} className="contents">
                {row.map((key) => (
                  <Button
                    key={key}
                    type="button"
                    variant={key === 'C' ? 'destructive' : key === '⌫' ? 'outline' : 'default'}
                    onClick={(e) => {
                      e.preventDefault();
                      handleKeyPress(key);
                    }}
                    className={`h-14 text-2xl font-semibold ${
                      key === 'C' ? 'bg-red-600 hover:bg-red-700' :
                      key === '⌫' ? 'hover:bg-slate-100 dark:hover:bg-slate-800' :
                      'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700'
                    } ${key === 'C' ? 'text-white' : 'text-slate-900 dark:text-white'}`}
                  >
                    {key === '⌫' ? <Delete className="h-5 w-5" /> : key}
                  </Button>
                ))}
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2 mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="h-12"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              className="h-12 bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={!value}
            >
              <Check className="h-4 w-4 mr-2" />
              OK
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
