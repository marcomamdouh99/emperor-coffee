'use client';

import { Button } from '@/components/ui/button';

interface NumpadProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  maxLength?: number;
  className?: string;
}

export function Numpad({ value, onChange, onSubmit, maxLength = 10, className }: NumpadProps) {
  const handlePress = (key: string) => {
    let newValue = value;
    
    if (key === 'C') {
      newValue = '';
    } else if (key === '⌫') {
      newValue = value.slice(0, -1);
    } else if (key === '.') {
      // Only allow one decimal point
      if (!value.includes('.')) {
        newValue = value + '.';
      }
    } else {
      // Number key
      if (value.length < maxLength) {
        newValue = value + key;
      }
    }
    
    onChange(newValue);
  };

  return (
    <div className={`grid grid-cols-3 gap-2 p-4 ${className}`}>
      <Button
        variant="outline"
        onClick={() => handlePress('7')}
        className="h-16 text-2xl font-semibold"
      >
        7
      </Button>
      <Button
        variant="outline"
        onClick={() => handlePress('8')}
        className="h-16 text-2xl font-semibold"
      >
        8
      </Button>
      <Button
        variant="outline"
        onClick={() => handlePress('9')}
        className="h-16 text-2xl font-semibold"
      >
        9
      </Button>
      <Button
        variant="outline"
        onClick={() => handlePress('4')}
        className="h-16 text-2xl font-semibold"
      >
        4
      </Button>
      <Button
        variant="outline"
        onClick={() => handlePress('5')}
        className="h-16 text-2xl font-semibold"
      >
        5
      </Button>
      <Button
        variant="outline"
        onClick={() => handlePress('6')}
        className="h-16 text-2xl font-semibold"
      >
        6
      </Button>
      <Button
        variant="outline"
        onClick={() => handlePress('1')}
        className="h-16 text-2xl font-semibold"
      >
        1
      </Button>
      <Button
        variant="outline"
        onClick={() => handlePress('2')}
        className="h-16 text-2xl font-semibold"
      >
        2
      </Button>
      <Button
        variant="outline"
        onClick={() => handlePress('3')}
        className="h-16 text-2xl font-semibold"
      >
        3
      </Button>
      <Button
        variant="destructive"
        onClick={() => handlePress('C')}
        className="h-16 text-xl font-semibold"
      >
        C
      </Button>
      <Button
        variant="outline"
        onClick={() => handlePress('0')}
        className="h-16 text-2xl font-semibold"
      >
        0
      </Button>
      <Button
        variant="outline"
        onClick={() => handlePress('.')}
        className="h-16 text-2xl font-semibold"
      >
        .
      </Button>
      <Button
        variant="outline"
        onClick={() => handlePress('⌫')}
        className="h-16 text-xl font-semibold"
      >
        ⌫
      </Button>
      <Button
        variant="outline"
        onClick={() => handlePress('00')}
        className="h-16 text-xl font-semibold"
      >
        00
      </Button>
      {onSubmit && (
        <Button
          onClick={onSubmit}
          className="h-16 text-xl font-semibold bg-emerald-600 hover:bg-emerald-700"
        >
          ✓
        </Button>
      )}
    </div>
  );
}
