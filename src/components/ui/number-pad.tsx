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
  onValueChange: (value: string) => void;
  title?: string;
  decimal?: boolean;
  maxLength?: number;
  initialValue?: string;
}

export function NumberPad({
  isOpen,
  onClose,
  onValueChange,
  title = 'Enter Value',
  decimal = true,
  maxLength = 10,
  initialValue = '',
}: NumberPadProps) {
  const [value, setValue] = useState(initialValue);
  const previousIsOpen = useRef(isOpen);
  const onValueChangeRef = useRef(onValueChange);

  // Keep ref in sync with prop
  useEffect(() => {
    onValueChangeRef.current = onValueChange;
  }, [onValueChange]);

  // Initialize value when dialog opens (don't call callback)
  useEffect(() => {
    if (isOpen && !previousIsOpen.current) {
      console.log('[NumberPad] Opening with initialValue:', initialValue);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setValue(initialValue);
    } else if (!isOpen) {
      setValue('');
    }
    previousIsOpen.current = isOpen;
  }, [isOpen, initialValue]);

  const handleKeyPress = (key: string) => {
    if (key === 'C') {
      setValue('');
      onValueChangeRef.current('');
    } else if (key === '⌫') {
      setValue(prev => {
        const newValue = prev.slice(0, -1);
        onValueChangeRef.current(newValue);
        return newValue;
      });
    } else if (key === '.') {
      // Only allow one decimal point
      if (!value.includes('.')) {
        setValue(prev => {
          const newValue = prev + '.';
          if (newValue.length <= maxLength) {
            onValueChangeRef.current(newValue);
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
          onValueChangeRef.current(newValue);
          return newValue;
        }
        return prev;
      });
    }
  };

  const handlePreset = (presetValue: string) => {
    setValue(presetValue);
    onValueChangeRef.current(presetValue);
  };

  const handleSubmit = () => {
    console.log('[NumberPad handleSubmit] Submitting with value:', value);
    onValueChangeRef.current(value);
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

  const presets = decimal ? [
    { label: '1/8', value: '0.125' },
    { label: '1/4', value: '0.250' },
    { label: '1/2', value: '0.500' },
    { label: '3/4', value: '0.750' },
  ] : [];

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

          {/* Fraction Presets - only show for decimal mode */}
          {presets.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-2 px-1">Quick Select:</p>
              <div className="grid grid-cols-4 gap-2">
                {presets.map((preset) => (
                  <Button
                    key={preset.label}
                    type="button"
                    variant="outline"
                    onClick={(e) => {
                      e.preventDefault();
                      handlePreset(preset.value);
                    }}
                    className="h-10 text-xs font-semibold bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-950/50"
                    title={`${preset.label} = ${preset.value}`}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>
          )}

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
