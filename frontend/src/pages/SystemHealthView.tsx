import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Layers,
  RefreshCw,
  Server,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { fetchHealth } from '../services/api';
import { HealthResponse } from '../types';

export const SystemHealthView: React.FC = () => {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchHealth();
      setHealth(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Backend unreachable');
      setHealth(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-300 pb-12">
      {/* Header */}
      <div className="border-b border-border/40 pb-4 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-primary text-xs font-mono uppercase tracking-wider mb-1">
            <Server className="h-4 w-4" />
            <span>Platform Telemetry & Health</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-foreground font-mono">
            System Subsystem Diagnostics
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time operational status of backend services, vector database, LLM provider, and agent orchestrator.
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={checkHealth} className="text-xs">
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
          Run Health Probe
        </Button>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-destructive/15 border border-destructive/30 text-destructive-foreground text-xs flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">Backend Unreachable</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {health && (
        <div className="space-y-4">
          {/* Overall Health Card */}
          <Card className="border-border/60 bg-card/60">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  Overall Platform Status
                </CardTitle>
                <Badge
                  className={
                    health.status === 'ok'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono text-xs'
                      : 'bg-destructive text-destructive-foreground font-mono text-xs'
                  }
                >
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  {health.status.toUpperCase()}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-md bg-muted/20 border border-border/30">
                <span className="text-muted-foreground block text-[11px]">Runtime Environment:</span>
                <span className="font-semibold text-foreground font-mono">{health.environment}</span>
              </div>
              <div className="p-3 rounded-md bg-muted/20 border border-border/30">
                <span className="text-muted-foreground block text-[11px]">Platform Version:</span>
                <span className="font-semibold text-foreground font-mono">{health.version}</span>
              </div>
              <div className="p-3 rounded-md bg-muted/20 border border-border/30 col-span-2 sm:col-span-1">
                <span className="text-muted-foreground block text-[11px]">Core Architecture:</span>
                <span className="font-semibold text-foreground font-mono">FastAPI + React 18</span>
              </div>
            </CardContent>
          </Card>

          {/* Subsystem Telemetry Grid */}
          <Card className="border-border/60 bg-card/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" />
                Constituent Subsystems
              </CardTitle>
              <CardDescription className="text-xs">
                Live monitoring of individual storage, vector, and agent services
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              {Object.entries(health.services).map(([service, status]) => (
                <div
                  key={service}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border border-border/30"
                >
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    <span className="font-semibold capitalize text-foreground">
                      {service.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <span className="font-mono text-emerald-400 font-medium text-xs">
                    {status}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
