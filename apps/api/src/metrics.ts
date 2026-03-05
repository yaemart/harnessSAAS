interface MetricEntry {
  count: number;
  totalMs: number;
  errors: number;
  lastUpdated: number;
}

class MetricsCollector {
  private endpoints = new Map<string, MetricEntry>();
  private agentStats = new Map<string, { completed: number; failed: number; retries: number }>();

  recordEndpoint(path: string, durationMs: number, isError: boolean): void {
    const entry = this.endpoints.get(path) ?? { count: 0, totalMs: 0, errors: 0, lastUpdated: 0 };
    entry.count++;
    entry.totalMs += durationMs;
    if (isError) entry.errors++;
    entry.lastUpdated = Date.now();
    this.endpoints.set(path, entry);
  }

  recordAgentExecution(tenantId: string, status: 'completed' | 'failed' | 'retry'): void {
    const stats = this.agentStats.get(tenantId) ?? { completed: 0, failed: 0, retries: 0 };
    if (status === 'completed') stats.completed++;
    else if (status === 'failed') stats.failed++;
    else stats.retries++;
    this.agentStats.set(tenantId, stats);
  }

  getEndpointMetrics(): Record<string, { count: number; avgMs: number; errorRate: number }> {
    const result: Record<string, { count: number; avgMs: number; errorRate: number }> = {};
    for (const [path, entry] of this.endpoints) {
      result[path] = {
        count: entry.count,
        avgMs: entry.count > 0 ? Math.round(entry.totalMs / entry.count) : 0,
        errorRate: entry.count > 0 ? Number((entry.errors / entry.count).toFixed(4)) : 0,
      };
    }
    return result;
  }

  getAgentMetrics(): Record<string, { completed: number; failed: number; retries: number; successRate: number }> {
    const result: Record<string, { completed: number; failed: number; retries: number; successRate: number }> = {};
    for (const [tenantId, stats] of this.agentStats) {
      const total = stats.completed + stats.failed;
      result[tenantId] = {
        ...stats,
        successRate: total > 0 ? Number((stats.completed / total).toFixed(4)) : 1,
      };
    }
    return result;
  }

  reset(): void {
    this.endpoints.clear();
    this.agentStats.clear();
  }
}

export const metrics = new MetricsCollector();
