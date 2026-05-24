"use client";

import { useEffect, useState } from 'react';

export default function PerformanceMonitor() {
  const [metrics, setMetrics] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (typeof window !== 'undefined' && 'performance' in window) {
        const navigation = performance.getEntriesByType('navigation')[0];
        const paint = performance.getEntriesByType('paint');

        const firstContentfulPaint = paint.find(p => p.name === 'first-contentful-paint');
        const largestContentfulPaint = performance.getEntriesByType('largest-contentful-paint')[0];

        setMetrics({
          domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
          loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
          firstContentfulPaint: firstContentfulPaint?.startTime || 'N/A',
          largestContentfulPaint: largestContentfulPaint?.startTime || 'N/A',
        });
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  if (process.env.NODE_ENV !== 'development' || !metrics) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      background: 'rgba(0,0,0,0.8)',
      color: 'white',
      padding: '12px',
      borderRadius: '8px',
      fontSize: '12px',
      fontFamily: 'monospace',
      zIndex: 9999,
      maxWidth: '300px'
    }}>
      <div style={{ marginBottom: '8px', fontWeight: 'bold' }}>Performance Metrics</div>
      <div>DOM Content Loaded: {Math.round(metrics.domContentLoaded)}ms</div>
      <div>Load Complete: {Math.round(metrics.loadComplete)}ms</div>
      <div>First Contentful Paint: {typeof metrics.firstContentfulPaint === 'number' ? Math.round(metrics.firstContentfulPaint) + 'ms' : metrics.firstContentfulPaint}</div>
      <div>Largest Contentful Paint: {typeof metrics.largestContentfulPaint === 'number' ? Math.round(metrics.largestContentfulPaint) + 'ms' : metrics.largestContentfulPaint}</div>
    </div>
  );
}
