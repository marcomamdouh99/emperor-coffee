'use client'

/**
 * System Monitoring Dashboard
 * Displays health status, metrics, and performance data
 */

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Activity, Database, HardDrive, Clock, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  checks: {
    database: any
    cache: any
    memory: any
  }
}

interface PerformanceStats {
  totalRequests: number
  avgResponseTime: number
  errorRatePercentage: string
  slowRatePercentage: string
  errorCount: number
  slowRequests: number
}

export function SystemMonitoringDashboard() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [metrics, setMetrics] = useState<any>(null);
  const [performanceStats, setPerformanceStats] = useState<PerformanceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const fetchHealth = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/health', {
        method: 'POST',
      });
      const data = await response.json();
      setHealth(data);
    } catch (error) {
      console.error('Failed to fetch health:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMetrics = async () => {
    try {
      const response = await fetch('/api/metrics');
      const data = await response.json();
      setMetrics(data);
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
    }
  };

  const fetchPerformanceStats = async () => {
    try {
      const response = await fetch('/api/monitoring/performance?type=stats');
      const data = await response.json();
      setPerformanceStats(data.data);
    } catch (error) {
      console.error('Failed to fetch performance stats:', error);
    }
  };

  const refreshAll = () => {
    fetchHealth();
    fetchMetrics();
    fetchPerformanceStats();
  };

  useEffect(() => {
    refreshAll();
  }, []);

  // Auto refresh if enabled
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(refreshAll, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-500';
      case 'degraded':
        return 'bg-amber-500';
      case 'unhealthy':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'degraded':
        return <AlertTriangle className="h-5 w-5 text-amber-500" />;
      case 'unhealthy':
        return <AlertTriangle className="h-5 w-5 text-red-500" />;
      default:
        return <Activity className="h-5 w-5 text-gray-500" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">System Monitoring</h1>
          <p className="text-muted-foreground">Real-time health and performance metrics</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={autoRefresh ? 'default' : 'outline'}
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <Clock className="mr-2 h-4 w-4" />
            {autoRefresh ? 'Auto-refreshing' : 'Enable Auto-refresh'}
          </Button>
          <Button variant="outline" onClick={refreshAll} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Overall Status Card */}
      <Card>
        <CardHeader>
          <CardTitle>System Status</CardTitle>
          <CardDescription>Overall system health status</CardDescription>
        </CardHeader>
        <CardContent>
          {health ? (
            <div className="flex items-center gap-4">
              <div className={`w-4 h-4 rounded-full ${getStatusColor(health.status)}`} />
              <div>
                <div className="flex items-center gap-2">
                  {getStatusIcon(health.status)}
                  <span className="text-2xl font-bold capitalize">{health.status}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-12">
              <RefreshCw className="h-6 w-6 animate-spin" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detailed Health Checks */}
      <Card>
        <CardHeader>
          <CardTitle>Component Health</CardTitle>
          <CardDescription>Status of individual system components</CardDescription>
        </CardHeader>
        <CardContent>
          {health && health.checks ? (
            <div className="space-y-4">
              {/* Database */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Database className="h-5 w-5" />
                  <div>
                    <div className="font-medium">Database</div>
                    <div className="text-sm text-muted-foreground">
                      {health.checks.database.message}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusIcon(health.checks.database.status)}
                  <Badge variant={health.checks.database.status === 'healthy' ? 'default' : 'destructive'}>
                    {health.checks.database.status.toUpperCase()}
                  </Badge>
                  {health.checks.database.latency && (
                    <span className="text-sm text-muted-foreground">
                      ({health.checks.database.latency}ms)
                    </span>
                  )}
                </div>
              </div>

              {/* Cache */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Activity className="h-5 w-5" />
                  <div>
                    <div className="font-medium">Cache</div>
                    <div className="text-sm text-muted-foreground">
                      Hit rate: {(health.checks.cache.stats.hitRate * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusIcon(health.checks.cache.status)}
                  <Badge variant={health.checks.cache.status === 'healthy' ? 'default' : 'destructive'}>
                    {health.checks.cache.status.toUpperCase()}
                  </Badge>
                </div>
              </div>

              {/* Memory */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <HardDrive className="h-5 w-5" />
                  <div>
                    <div className="font-medium">Memory</div>
                    <div className="text-sm text-muted-foreground">
                      Usage: {health.checks.memory.usage.percentage.toFixed(1)}%
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusIcon(health.checks.memory.status)}
                  <Badge
                    variant={
                      health.checks.memory.status === 'healthy'
                        ? 'default'
                        : health.checks.memory.status === 'warning'
                        ? 'secondary'
                        : 'destructive'
                    }
                  >
                    {health.checks.memory.status.toUpperCase()}
                  </Badge>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-32">
              <RefreshCw className="h-8 w-8 animate-spin" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Performance Statistics */}
      {performanceStats && (
        <Card>
          <CardHeader>
            <CardTitle>Performance Statistics</CardTitle>
            <CardDescription>API request metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground">Total Requests</div>
                <div className="text-2xl font-bold">{performanceStats.totalRequests}</div>
              </div>

              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground">Avg Response Time</div>
                <div className="text-2xl font-bold">{performanceStats.avgResponseTime.toFixed(0)}ms</div>
              </div>

              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground">Error Rate</div>
                <div className="text-2xl font-bold text-red-500">{performanceStats.errorRatePercentage}</div>
              </div>

              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground">Slow Request Rate</div>
                <div className="text-2xl font-bold text-amber-500">{performanceStats.slowRatePercentage}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detailed Metrics Tabs */}
      {metrics && (
        <Card>
          <CardHeader>
            <CardTitle>Detailed Metrics</CardTitle>
            <CardDescription>Real-time system metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="database">Database</TabsTrigger>
                <TabsTrigger value="cache">Cache</TabsTrigger>
                <TabsTrigger value="memory">Memory</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="mt-6">
                <div className="space-y-4">
                  <div className="p-4 border rounded-lg">
                    <div className="text-sm text-muted-foreground">Uptime</div>
                    <div className="text-2xl font-bold">
                      {Math.floor(metrics.uptime / 60)} minutes
                    </div>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="text-sm text-muted-foreground">Database Status</div>
                    <div className="text-xl font-bold">{metrics.database.status}</div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="database" className="mt-6">
                <div className="p-4 border rounded-lg">
                  <div className="text-sm text-muted-foreground">Database Latency</div>
                  <div className="text-2xl font-bold">
                    {metrics.database.latency}ms
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="cache" className="mt-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 border rounded-lg">
                    <div className="text-sm text-muted-foreground">Cache Hits</div>
                    <div className="text-2xl font-bold text-green-500">{metrics.cache.hits}</div>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="text-sm text-muted-foreground">Cache Misses</div>
                    <div className="text-2xl font-bold text-red-500">{metrics.cache.misses}</div>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="text-sm text-muted-foreground">Cache Size</div>
                    <div className="text-2xl font-bold">{metrics.cache.size}</div>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="text-sm text-muted-foreground">Hit Rate</div>
                    <div className="text-2xl font-bold text-green-500">
                      {(metrics.cache.hitRate * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="memory" className="mt-6">
                <div className="p-4 border rounded-lg">
                  <div className="text-sm text-muted-foreground">Heap Usage</div>
                  <div className="text-2xl font-bold">{(metrics.memory.heapUsed / 1024 / 1024).toFixed(2)} MB</div>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="text-sm text-muted-foreground">Heap Total</div>
                  <div className="text-2xl font-bold">{(metrics.memory.heapTotal / 1024 / 1024).toFixed(2)} MB</div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
