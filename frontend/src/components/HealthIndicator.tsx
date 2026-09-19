import { useState, useEffect } from "react";
import { fetchHealth } from "../services/api";
import { HealthResponse } from "../types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/Card";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { Activity, RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";

export function HealthIndicator() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const checkStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchHealth();
      setHealth(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to connect to backend");
      setHealth(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkStatus();
  }, []);

  return (
    <Card className="w-full max-w-lg border-border/60 bg-card/80 backdrop-blur">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="space-y-1">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            System Diagnostic & Connectivity
          </CardTitle>
          <CardDescription>Real-time backend API and database status</CardDescription>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={checkStatus}
          disabled={loading}
          aria-label="Refresh status"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4 pt-2">
        {loading && !health && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Checking system status...
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-md bg-destructive/15 p-3 text-sm text-destructive-foreground border border-destructive/30">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Backend Offline or Unreachable</p>
              <p className="text-xs text-muted-foreground mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {health && (
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-border/40 pb-2">
              <span className="text-sm font-medium">Core API</span>
              <Badge variant={health.status === "ok" ? "success" : "destructive"}>
                <CheckCircle2 className="mr-1 h-3 w-3" />
                {health.status.toUpperCase()}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded border border-border/30 bg-muted/30 p-2">
                <span className="text-muted-foreground">Environment:</span>
                <p className="font-semibold mt-0.5 text-foreground">{health.environment}</p>
              </div>
              <div className="rounded border border-border/30 bg-muted/30 p-2">
                <span className="text-muted-foreground">API Version:</span>
                <p className="font-semibold mt-0.5 text-foreground">{health.version}</p>
              </div>
            </div>

            <div className="space-y-1.5 pt-1">
              <span className="text-xs font-medium text-muted-foreground">Subsystems</span>
              <div className="space-y-1">
                {Object.entries(health.services).map(([service, status]) => (
                  <div
                    key={service}
                    className="flex items-center justify-between text-xs py-1 px-2 rounded bg-muted/20"
                  >
                    <span className="capitalize">{service}</span>
                    <span className="font-mono text-emerald-400">{status}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
