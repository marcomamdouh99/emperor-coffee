'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Minus, Maximize, X, GripVertical } from 'lucide-react';

interface NumpadProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  maxLength?: number;
  className?: string;
  onClose?: () => void;
  isOpen?: boolean;
}

export function Numpad({ value, onChange, onSubmit, maxLength = 10, className, onClose, isOpen = true }: NumpadProps) {
  const [position, setPosition] = useState({ x: 20, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const headerRef = useRef<HTMLDivElement>(null);

  // Load saved position from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedPosition = localStorage.getItem('numpadPosition');
      const savedMinimized = localStorage.getItem('numpadMinimized');
      
      if (savedPosition) {
        try {
          const pos = JSON.parse(savedPosition);
          setPosition(pos);
        } catch (e) {
          console.error('Failed to parse saved numpad position:', e);
        }
      }
      
      if (savedMinimized) {
        setIsMinimized(savedMinimized === 'true');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save position to localStorage when it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('numpadPosition', JSON.stringify(position));
      localStorage.setItem('numpadMinimized', isMinimized.toString());
    }
  }, [position, isMinimized]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (headerRef.current && headerRef.current.contains(e.target as Node)) {
      setIsDragging(true);
      setDragOffset({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      });
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;
      
      // Constrain to viewport
      const maxX = window.innerWidth - (isMinimized ? 200 : 280);
      const maxY = window.innerHeight - (isMinimized ? 50 : 450);
      
      setPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY))
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragOffset]);

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

  // Don't render if not open
  if (!isOpen) return null;

  const numpadContent = (
    <div
      className="fixed shadow-2xl rounded-2xl bg-white dark:bg-slate-800 border-2 border-emerald-500/30 z-[99999]"
      style={{
        left: position.x,
        top: position.y,
        width: isMinimized ? '200px' : '280px',
        minWidth: isMinimized ? '200px' : '280px',
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Header - Drag Handle */}
      <div
        ref={headerRef}
        className="flex items-center justify-between px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-t-xl cursor-move select-none"
      >
        <div className="flex items-center gap-2">
          <GripVertical className="h-5 w-5 text-white/70" />
          <span className="text-white font-semibold text-sm">Numpad</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-white hover:bg-white/20"
            onClick={() => setIsMinimized(!isMinimized)}
          >
            {isMinimized ? (
              <Maximize className="h-4 w-4" />
            ) : (
              <Minus className="h-4 w-4" />
            )}
          </Button>
          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-white hover:bg-white/20"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      {!isMinimized && (
        <div className="p-3">
          {/* Display */}
          <div className="mb-3 p-3 bg-slate-100 dark:bg-slate-900 rounded-xl text-center">
            <div className="text-3xl font-mono font-bold text-slate-900 dark:text-white">
              {value || '0'}
            </div>
          </div>

          {/* Numpad Grid */}
          <div className={`grid grid-cols-3 gap-2 ${className}`}>
            <Button
              variant="outline"
              onClick={() => handlePress('7')}
              className="h-14 text-2xl font-semibold"
            >
              7
            </Button>
            <Button
              variant="outline"
              onClick={() => handlePress('8')}
              className="h-14 text-2xl font-semibold"
            >
              8
            </Button>
            <Button
              variant="outline"
              onClick={() => handlePress('9')}
              className="h-14 text-2xl font-semibold"
            >
              9
            </Button>
            <Button
              variant="outline"
              onClick={() => handlePress('4')}
              className="h-14 text-2xl font-semibold"
            >
              4
            </Button>
            <Button
              variant="outline"
              onClick={() => handlePress('5')}
              className="h-14 text-2xl font-semibold"
            >
              5
            </Button>
            <Button
              variant="outline"
              onClick={() => handlePress('6')}
              className="h-14 text-2xl font-semibold"
            >
              6
            </Button>
            <Button
              variant="outline"
              onClick={() => handlePress('1')}
              className="h-14 text-2xl font-semibold"
            >
              1
            </Button>
            <Button
              variant="outline"
              onClick={() => handlePress('2')}
              className="h-14 text-2xl font-semibold"
            >
              2
            </Button>
            <Button
              variant="outline"
              onClick={() => handlePress('3')}
              className="h-14 text-2xl font-semibold"
            >
              3
            </Button>
            <Button
              variant="destructive"
              onClick={() => handlePress('C')}
              className="h-14 text-xl font-semibold"
            >
              C
            </Button>
            <Button
              variant="outline"
              onClick={() => handlePress('0')}
              className="h-14 text-2xl font-semibold"
            >
              0
            </Button>
            <Button
              variant="outline"
              onClick={() => handlePress('.')}
              className="h-14 text-2xl font-semibold"
            >
              .
            </Button>
            <Button
              variant="outline"
              onClick={() => handlePress('⌫')}
              className="h-14 text-xl font-semibold"
            >
              ⌫
            </Button>
            <Button
              variant="outline"
              onClick={() => handlePress('00')}
              className="h-14 text-xl font-semibold"
            >
              00
            </Button>
            <Button
              variant="outline"
              onClick={() => handlePress('0.125')}
              className="h-14 text-sm font-semibold"
              title="1/8 = 0.125"
            >
              1/8
            </Button>
            <Button
              variant="outline"
              onClick={() => handlePress('0.250')}
              className="h-14 text-sm font-semibold"
              title="1/4 = 0.250"
            >
              1/4
            </Button>
            <Button
              variant="outline"
              onClick={() => handlePress('0.500')}
              className="h-14 text-sm font-semibold"
              title="1/2 = 0.500"
            >
              1/2
            </Button>
            {onSubmit && (
              <Button
                onClick={onSubmit}
                className="h-14 text-xl font-semibold bg-emerald-600 hover:bg-emerald-700 col-span-2"
              >
                ✓
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );

  // Render using Portal to ensure it's always on top of all dialogs
  if (typeof window !== 'undefined') {
    return createPortal(numpadContent, document.body);
  }

  return numpadContent;
}
