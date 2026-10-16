import React, { useEffect, useState } from 'react';

interface HealthResponse {
  status: string;
  timestamp: string;
  uptime: number;
  service: string;
  version: string;
  environment: string;
  database: string;
}

export const App: React.FC = () => {
  const [healthData, setHealthData] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [latency, setLatency] = useState<number | null>(null);

  const checkHealth = async () => {
    setLoading(true);
    setError(null);
    const start = performance.now();
    try {
      const response = await fetch('/api/health');
      const data = await response.json();
      setLatency(Math.round(performance.now() - start));
      if (response.ok) {
        setHealthData(data);
      } else {
        setError(`Server returned status ${response.status}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect to backend service');
      setHealthData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-indigo-500 selection:text-white">
      {/* Background Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-indigo-500/10 via-purple-500/5 to-transparent blur-3xl pointer-events-none" />

      {/* Navigation */}
      <header className="relative z-10 border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20">
              E
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                Evidra
              </span>
              <span className="ml-2 text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                Core Foundation
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Client Ready
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-5xl mx-auto px-6 py-12 flex-1 w-full flex flex-col justify-center">
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white mb-4">
            AI-Powered Placement Intelligence Platform
          </h1>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">
            System initialization and core monorepo foundation skeleton.
          </p>
        </div>

        {/* Status Dashboard Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-sm mb-10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
            <div>
              <h2 className="text-xl font-semibold text-white">System Health Verification</h2>
              <p className="text-sm text-slate-400">
                Live communication status between React client and Express API
              </p>
            </div>
            <button
              onClick={checkHealth}
              disabled={loading}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 active:scale-95 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition cursor-pointer self-start sm:self-auto"
            >
              {loading ? 'Checking...' : 'Recheck Health'}
            </button>
          </div>

          {/* Grid of indicators */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            {/* Frontend Card */}
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4">
              <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                Frontend Service
              </div>
              <div className="flex items-center gap-2 mb-1">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400"></span>
                <span className="font-semibold text-white">Online</span>
              </div>
              <p className="text-xs text-slate-500">React 19 • Vite • Tailwind CSS</p>
            </div>

            {/* Backend Card */}
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4">
              <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                Backend API
              </div>
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    loading
                      ? 'bg-amber-400 animate-ping'
                      : healthData
                        ? 'bg-emerald-400'
                        : 'bg-rose-500'
                  }`}
                ></span>
                <span className="font-semibold text-white">
                  {loading ? 'Checking...' : healthData ? 'Connected' : 'Offline'}
                </span>
                {latency !== null && (
                  <span className="text-xs text-slate-500 ml-auto">{latency}ms</span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                {healthData
                  ? `${healthData.service} v${healthData.version}`
                  : error
                    ? 'Server unreachable'
                    : 'Node.js Express API'}
              </p>
            </div>

            {/* Database Card */}
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4">
              <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                Database
              </div>
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    healthData?.database === 'connected'
                      ? 'bg-emerald-400'
                      : healthData?.database === 'connecting'
                        ? 'bg-amber-400'
                        : 'bg-slate-500'
                  }`}
                ></span>
                <span className="font-semibold text-white">
                  {healthData?.database ? healthData.database : 'MongoDB Atlas'}
                </span>
              </div>
              <p className="text-xs text-slate-500">Mongoose ODM Ready</p>
            </div>
          </div>

          {/* Details / Error info */}
          {error && (
            <div className="mt-6 p-4 rounded-xl bg-rose-950/30 border border-rose-800/50 text-rose-300 text-xs font-mono">
              <strong>Connection Notice:</strong> {error}. Ensure backend is running (`npm run
              dev:server`).
            </div>
          )}

          {healthData && (
            <div className="mt-6 p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-xs font-mono text-slate-300 overflow-x-auto">
              <div className="text-slate-500 mb-1">// API Response Payload (GET /api/health)</div>
              <pre>{JSON.stringify(healthData, null, 2)}</pre>
            </div>
          )}
        </div>

        {/* Stack Specs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div className="p-4 rounded-xl border border-slate-800/60 bg-slate-900/40">
            <div className="text-xs text-indigo-400 font-medium">Frontend Target</div>
            <div className="font-semibold text-slate-200 mt-1">Vercel</div>
          </div>
          <div className="p-4 rounded-xl border border-slate-800/60 bg-slate-900/40">
            <div className="text-xs text-indigo-400 font-medium">Backend Target</div>
            <div className="font-semibold text-slate-200 mt-1">Render</div>
          </div>
          <div className="p-4 rounded-xl border border-slate-800/60 bg-slate-900/40">
            <div className="text-xs text-indigo-400 font-medium">Auth Architecture</div>
            <div className="font-semibold text-slate-200 mt-1">JWT + HTTP Cookies</div>
          </div>
          <div className="p-4 rounded-xl border border-slate-800/60 bg-slate-900/40">
            <div className="text-xs text-indigo-400 font-medium">Data Layer</div>
            <div className="font-semibold text-slate-200 mt-1">MongoDB Atlas</div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-800/80 py-6 text-center text-xs text-slate-500">
        Evidra Platform Foundation • React + Express Monorepo Skeleton
      </footer>
    </div>
  );
};

export default App;
