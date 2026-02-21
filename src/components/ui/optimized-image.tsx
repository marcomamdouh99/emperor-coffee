'use client'

/**
 * Optimized Image component with lazy loading and fallback
 */

import Image from 'next/image';
import { useState } from 'react';

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  fill?: boolean;
  className?: string;
  priority?: boolean;
  sizes?: string;
  quality?: number;
  onLoad?: () => void;
  onError?: () => void;
}

export function OptimizedImage({
  src,
  alt,
  width,
  height,
  fill = false,
  className = '',
  priority = false,
  sizes,
  quality = 75,
  onLoad,
  onError,
}: OptimizedImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const handleLoad = () => {
    setIsLoading(false);
    onLoad?.();
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
    onError?.();
  };

  if (hasError) {
    return (
      <div
        className={`flex items-center justify-center bg-muted ${fill ? 'w-full h-full' : ''} ${className}`}
        style={fill ? undefined : { width, height }}
      >
        <span className="text-muted-foreground text-sm">Image not available</span>
      </div>
    );
  }

  return (
    <div className={`relative ${fill ? 'w-full h-full' : ''} ${className}`}>
      {isLoading && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-muted animate-pulse"
          style={fill ? undefined : { width, height }}
        >
          <div className="h-8 w-8 rounded bg-muted-foreground/20" />
        </div>
      )}
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        fill={fill}
        priority={priority}
        sizes={sizes}
        quality={quality}
        loading="lazy"
        decoding="async"
        onLoad={handleLoad}
        onError={handleError}
        className={`transition-opacity duration-300 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
      />
    </div>
  );
}

/**
 * Avatar component with optimized image
 */
interface OptimizedAvatarProps {
  src?: string | null;
  name: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function OptimizedAvatar({
  src,
  name,
  size = 'md',
  className = '',
}: OptimizedAvatarProps) {
  const sizeMap = {
    sm: 32,
    md: 48,
    lg: 64,
    xl: 96,
  };

  const dimensions = sizeMap[size];

  if (src) {
    return (
      <OptimizedImage
        src={src}
        alt={`${name} avatar`}
        width={dimensions}
        height={dimensions}
        className={`rounded-full ${className}`}
      />
    );
  }

  // Fallback to initials if no image
  const initials = name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div
      className={`flex items-center justify-center rounded-full bg-primary text-primary-foreground font-medium ${className}`}
      style={{
        width: dimensions,
        height: dimensions,
      }}
    >
      {initials}
    </div>
  );
}

/**
 * Product image component for menu items
 */
interface ProductImageProps {
  src?: string | null;
  name: string;
  className?: string;
}

export function ProductImage({ src, name, className = '' }: ProductImageProps) {
  return (
    <OptimizedImage
      src={src || '/placeholder-product.png'}
      alt={name}
      width={200}
      height={200}
      className={`object-cover rounded-lg ${className}`}
      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
    />
  );
}
