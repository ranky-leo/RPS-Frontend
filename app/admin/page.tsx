"use client";

import {
  useEffect,
  useState,
  useCallback,
  useMemo,
  type FormEvent,
} from "react";
import {
  api,
  clearAuthCredentials,
  getAuthToken,
  setAuthCredentials,
} from "../../lib/api";
import type { User } from "../../lib/types";

type PageState = "checking" | "login" | "denied" | "dashboard";
type Period = "day" | "week" | "month";

interface MetricData {
  region?: string;
  date?: string;
  week_start?: string;
  week_end?: string;
  year?: number;
  month?: number;
  visits: number;
  registrations: number;
  total_usdt_balance: number;
  total_rac_balance: number;
  usdt_transaction?: number;
  usdt_transaction_volume?: number;
  rac_transaction?: number;
  rac_transaction_volume?: number;
  usdt_match_count: number;
  rac_match_count: number;
}

function formatDateUTC(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getWeekStartUTC(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  const day = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - day);
  return formatDateUTC(date);
}

function getWeekEndUTC(weekStart: string) {
  const date = new Date(`${weekStart}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 6);
  return formatDateUTC(date);
}

function aggregateWeeklyFromDaily(daily: MetricData[]): MetricData[] {
  const map = new Map<string, MetricData>();

  for (const row of daily) {
    if (!row.date) continue;
    const weekStart = getWeekStartUTC(row.date);
    const existing = map.get(weekStart) || {
      region: row.region,
      week_start: weekStart,
      week_end: getWeekEndUTC(weekStart),
      visits: 0,
      registrations: 0,
      total_usdt_balance: 0,
      total_rac_balance: 0,
      usdt_transaction: 0,
      usdt_transaction_volume: 0,
      rac_transaction: 0,
      rac_transaction_volume: 0,
      usdt_match_count: 0,
      rac_match_count: 0,
    };

    existing.visits += Number(row.visits || 0);
    existing.registrations += Number(row.registrations || 0);
    existing.total_usdt_balance += Number(row.total_usdt_balance || 0);
    existing.total_rac_balance += Number(row.total_rac_balance || 0);
    existing.usdt_transaction =
      Number(existing.usdt_transaction || 0) +
      Number(row.usdt_transaction || 0);
    existing.usdt_transaction_volume =
      Number(existing.usdt_transaction_volume || 0) +
      Number(row.usdt_transaction_volume ?? row.usdt_transaction_volume ?? 0);
    existing.rac_transaction =
      Number(existing.rac_transaction || 0) + Number(row.rac_transaction || 0);
    existing.rac_transaction_volume =
      Number(existing.rac_transaction_volume || 0) +
      Number(row.rac_transaction_volume ?? row.rac_transaction_volume ?? 0);
    existing.usdt_transaction_volume =
      (existing.usdt_transaction_volume ?? 0) +
      Number(row.usdt_transaction_volume ?? row.usdt_transaction_volume ?? 0);
    existing.rac_transaction_volume =
      (existing.rac_transaction_volume ?? 0) +
      Number(row.rac_transaction_volume ?? row.rac_transaction_volume ?? 0);
    existing.usdt_match_count += Number(row.usdt_match_count || 0);
    existing.rac_match_count += Number(row.rac_match_count || 0);

    map.set(weekStart, existing);
  }

  return Array.from(map.values())
    .sort((a, b) => String(b.week_start).localeCompare(String(a.week_start)))
    .map((row) => ({
      ...row,
      total_usdt_balance: Number(row.total_usdt_balance.toFixed(3)),
      total_rac_balance: Number(row.total_rac_balance.toFixed(3)),
      usdt_transaction_volume: Number(
        (
          row.usdt_transaction_volume ??
          row.usdt_transaction_volume ??
          0
        ).toFixed(3),
      ),
      rac_transaction_volume: Number(
        (row.rac_transaction_volume ?? row.rac_transaction_volume ?? 0).toFixed(
          3,
        ),
      ),
    }));
}

function aggregateMonthlyFromDaily(daily: MetricData[]): MetricData[] {
  const map = new Map<string, MetricData>();

  for (const row of daily) {
    if (!row.date) continue;
    const key = row.date.slice(0, 7);
    const year = Number.parseInt(key.slice(0, 4), 10);
    const month = Number.parseInt(key.slice(5, 7), 10);

    const existing = map.get(key) || {
      region: row.region,
      year,
      month,
      visits: 0,
      registrations: 0,
      total_usdt_balance: 0,
      total_rac_balance: 0,
      usdt_transaction: 0,
      usdt_transaction_volume: 0,
      rac_transaction: 0,
      rac_transaction_volume: 0,
      usdt_match_count: 0,
      rac_match_count: 0,
    };

    existing.visits += Number(row.visits || 0);
    existing.registrations += Number(row.registrations || 0);
    existing.total_usdt_balance += Number(row.total_usdt_balance || 0);
    existing.total_rac_balance += Number(row.total_rac_balance || 0);
    existing.usdt_transaction =
      Number(existing.usdt_transaction || 0) +
      Number(row.usdt_transaction || 0);
    existing.usdt_transaction_volume =
      Number(existing.usdt_transaction_volume || 0) +
      Number(row.usdt_transaction_volume ?? row.usdt_transaction_volume ?? 0);
    existing.rac_transaction =
      Number(existing.rac_transaction || 0) + Number(row.rac_transaction || 0);
    existing.rac_transaction_volume =
      Number(existing.rac_transaction_volume || 0) +
      Number(row.rac_transaction_volume ?? row.rac_transaction_volume ?? 0);
    existing.usdt_transaction_volume =
      (existing.usdt_transaction_volume ?? 0) +
      Number(row.usdt_transaction_volume ?? row.usdt_transaction_volume ?? 0);
    existing.rac_transaction_volume =
      (existing.rac_transaction_volume ?? 0) +
      Number(row.rac_transaction_volume ?? row.rac_transaction_volume ?? 0);
    existing.usdt_match_count += Number(row.usdt_match_count || 0);
    existing.rac_match_count += Number(row.rac_match_count || 0);

    map.set(key, existing);
  }

  return Array.from(map.values())
    .sort(
      (a, b) =>
        (b.year || 0) - (a.year || 0) || (b.month || 0) - (a.month || 0),
    )
    .map((row) => ({
      ...row,
      total_usdt_balance: Number(row.total_usdt_balance.toFixed(3)),
      total_rac_balance: Number(row.total_rac_balance.toFixed(3)),
      usdt_transaction_volume: Number(
        (
          row.usdt_transaction_volume ??
          row.usdt_transaction_volume ??
          0
        ).toFixed(3),
      ),
      rac_transaction_volume: Number(
        (row.rac_transaction_volume ?? row.rac_transaction_volume ?? 0).toFixed(
          3,
        ),
      ),
    }));
}

function MiniLineChart({
  title,
  values,
  color,
}: {
  title: string;
  values: number[];
  color: string;
}) {
  const width = 420;
  const height = 140;
  const padding = 12;

  if (values.length === 0) {
    return (
      <div
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 12,
          padding: 12,
          minHeight: 180,
        }}
      >
        <div style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
          {title}
        </div>
        <div
          style={{
            height: 140,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--text-muted)",
            fontSize: "0.8rem",
          }}
        >
          No data
        </div>
      </div>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);
  const stepX =
    values.length === 1 ? 0 : (width - padding * 2) / (values.length - 1);

  const points = values
    .map((value, i) => {
      const x = padding + i * stepX;
      const y =
        height - padding - ((value - min) / range) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 12,
        padding: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
          gap: 8,
        }}
      >
        <div style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
          {title}
        </div>
        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
          {min.toLocaleString()} → {max.toLocaleString()}
        </div>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: "100%", height: 140, display: "block" }}
        preserveAspectRatio="none"
      >
        <rect x="0" y="0" width={width} height={height} fill="transparent" />
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          points={points}
        />
      </svg>
    </div>
  );
}

export default function MarketingPage() {
  const [state, setState] = useState<PageState>("checking");
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Dashboard state
  const [period, setPeriod] = useState<Period>("day");
  const [dailyMetrics, setDailyMetrics] = useState<MetricData[]>([]);
  const [metricsLoading, setMetricsLoading] = useState(false);

  const loadMetrics = useCallback(async () => {
    setMetricsLoading(true);
    try {
      const res = await api.marketingDashboard("day");
      setDailyMetrics(res.data || []);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load metrics");
    } finally {
      setMetricsLoading(false);
    }
  }, []);

  const metricsByPeriod = useMemo(() => {
    const dayRows = [...dailyMetrics].sort((a, b) =>
      String(b.date || "").localeCompare(String(a.date || "")),
    );

    return {
      day: dayRows,
      week: aggregateWeeklyFromDaily(dayRows),
      month: aggregateMonthlyFromDaily(dayRows),
    } as const;
  }, [dailyMetrics]);

  const metrics = metricsByPeriod[period];

  const loadMarketingStatus = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await api.marketingMe();
      setUser(res.user);
      setState("dashboard");
      await loadMetrics();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);

      if (message.includes("401") || message.includes("authentication")) {
        clearAuthCredentials();
        setUser(null);
        setState("login");
        setError("Please log in with your customer account first.");
      } else if (message.includes("403") || message.includes("marketing")) {
        setUser(null);
        setState("denied");
        setError("This page is only for marketing users.");
      } else {
        setState("login");
        setError(message || "Unable to check access.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      setUser(null);
      setState("login");
      setLoading(false);
      return;
    }

    void loadMarketingStatus();
  }, []);

  const handlePeriodChange = (p: Period) => {
    setPeriod(p);
  };

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await api.login({
        identifier,
        password,
      });

      setAuthCredentials({
        token: res.token,
        userId: res.user.id,
        expiredAt: res.expiredAt,
      });

      if (res.user.is_marketing) {
        setUser(res.user);
        setState("dashboard");
        await loadMetrics();
      } else {
        setUser(null);
        setState("denied");
        setError("Your account is not marked as a marketing user.");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setState("login");
      setError(message || "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    clearAuthCredentials();
    setUser(null);
    setIdentifier("");
    setPassword("");
    setState("login");
    setError("Logged out.");
  };

  const getMetricLabel = (metric: MetricData) => {
    if (metric.date) return metric.date;
    if (metric.week_start && metric.week_end)
      return `${metric.week_start} to ${metric.week_end}`;
    if (metric.year && metric.month)
      return `${metric.year}-${String(metric.month).padStart(2, "0")}`;
    return "Unknown";
  };

  if (state === "login") {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "var(--bg-base)",
          color: "var(--text-primary)",
          fontFamily: "var(--font)",
          padding: "32px 24px",
        }}
      >
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 12,
            }}
          >
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background:
                  "linear-gradient(135deg, var(--accent-1), var(--accent-2))",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
              }}
            >
              📣
            </div>
            <div>
              <h1 style={{ fontSize: "1.35rem", fontWeight: 800 }}>
                Marketing Dashboard
              </h1>
              <p style={{ fontSize: "0.9rem", color: "var(--text-muted)" }}>
                Sign in with your regular customer account.
              </p>
            </div>
          </div>

          {error && (
            <div
              style={{
                marginBottom: 16,
                padding: "12px 14px",
                borderRadius: 10,
                border: "1px solid var(--border)",
                background: "var(--bg-card)",
                color: "var(--text-secondary)",
              }}
            >
              {error}
            </div>
          )}

          <form
            onSubmit={handleLogin}
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-subtle)",
              borderRadius: 14,
              padding: 24,
              maxWidth: 480,
            }}
          >
            <label
              style={{
                display: "block",
                fontSize: "0.84rem",
                color: "var(--text-muted)",
                marginBottom: 8,
              }}
            >
              Username or email
            </label>
            <input
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              placeholder="Enter your customer username or email"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid var(--border)",
                background: "var(--bg-input)",
                color: "var(--text-primary)",
                marginBottom: 14,
              }}
            />

            <label
              style={{
                display: "block",
                fontSize: "0.84rem",
                color: "var(--text-muted)",
                marginBottom: 8,
              }}
            >
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your customer password"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid var(--border)",
                background: "var(--bg-input)",
                color: "var(--text-primary)",
                marginBottom: 14,
              }}
            />

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 10,
                border: "none",
                background:
                  "linear-gradient(135deg, var(--accent-1), var(--accent-2))",
                color: "white",
                fontWeight: 700,
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (state === "denied") {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "var(--bg-base)",
          color: "var(--text-primary)",
          fontFamily: "var(--font)",
          padding: "32px 24px",
        }}
      >
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-subtle)",
              borderRadius: 14,
              padding: 24,
              maxWidth: 560,
            }}
          >
            <h2 style={{ fontSize: "1.05rem", marginBottom: 8 }}>
              Access denied
            </h2>
            <p style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>
              Your customer account is signed in, but it is not marked as a
              marketing user.
            </p>
            <button
              onClick={handleLogout}
              style={{
                marginTop: 14,
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--bg-input)",
                color: "var(--text-primary)",
                cursor: "pointer",
              }}
            >
              Log out and try another account
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (state === "dashboard" && user) {
    const totalVisits = metrics.reduce((sum, m) => sum + m.visits, 0);
    const totalRegistrations = metrics.reduce(
      (sum, m) => sum + m.registrations,
      0,
    );
    const totalUsdtBalance = metrics.reduce(
      (sum, m) => sum + m.total_usdt_balance,
      0,
    );
    const totalRacBalance = metrics.reduce(
      (sum, m) => sum + m.total_rac_balance,
      0,
    );
    const totalUsdtTransaction = metrics.reduce(
      (sum, m) => sum + Number(m.usdt_transaction || 0),
      0,
    );
    const totalUsdtTransactionVolume = metrics.reduce(
      (sum, m) =>
        sum +
        Number((m.usdt_transaction_volume ?? m.usdt_transaction_volume) || 0),
      0,
    );
    const totalRacTransaction = metrics.reduce(
      (sum, m) => sum + Number(m.rac_transaction || 0),
      0,
    );
    const totalRacTransactionVolume = metrics.reduce(
      (sum, m) =>
        sum +
        Number((m.rac_transaction_volume ?? m.rac_transaction_volume) || 0),
      0,
    );
    const totalUsdtMatchCount = metrics.reduce(
      (sum, m) => sum + m.usdt_match_count,
      0,
    );
    const totalRacMatchCount = metrics.reduce(
      (sum, m) => sum + m.rac_match_count,
      0,
    );
    const chartRows = [...metrics].reverse().slice(-30);
    const visitsTrend = chartRows.map((m) => m.visits);
    const registrationsTrend = chartRows.map((m) => m.registrations);
    const usdtTransactionVolumeTrend = chartRows.map(
      (m) => m.usdt_transaction_volume ?? m.usdt_transaction_volume ?? 0,
    );
    const racTransactionVolumeTrend = chartRows.map(
      (m) => m.rac_transaction_volume ?? m.rac_transaction_volume ?? 0,
    );
    const usdtBalanceTrend = chartRows.map((m) => m.total_usdt_balance);
    const racBalanceTrend = chartRows.map((m) => m.total_rac_balance);
    const usdtTransactionTrend = chartRows.map((m) => m.usdt_transaction ?? 0);
    const racTransactionTrend = chartRows.map((m) => m.rac_transaction ?? 0);
    const usdtMatchTrend = chartRows.map((m) => m.usdt_match_count);
    const racMatchTrend = chartRows.map((m) => m.rac_match_count);
    const dashboardShellStyle = {
      minHeight: "100vh",
      background:
        "radial-gradient(circle at top right, rgba(79,141,255,0.12), transparent 35%), var(--bg-base)",
      color: "var(--text-primary)",
      fontFamily: "var(--font)",
      padding: "24px 20px 36px",
    } as const;
    const panelStyle = {
      background: "var(--bg-card)",
      border: "1px solid var(--border-subtle)",
      borderRadius: 14,
      boxShadow: "0 10px 26px rgba(10, 24, 48, 0.08)",
    } as const;

    return (
      <div style={dashboardShellStyle}>
        <div style={{ maxWidth: 1400, margin: "0 auto" }}>
          {/* Header */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: 22,
              gap: 12,
            }}
          >
            <div>
              <h1
                style={{
                  fontSize: "1.55rem",
                  fontWeight: 800,
                  marginBottom: 4,
                }}
              >
                Marketing Dashboard
              </h1>
              <p
                style={{
                  fontSize: "0.88rem",
                  color: "var(--text-muted)",
                }}
              >
                Welcome, {user.username}
              </p>
              <p
                style={{
                  fontSize: "0.76rem",
                  color: "var(--accent-1)",
                  marginTop: 6,
                  display: "inline-block",
                  border: "1px solid rgba(79,141,255,0.35)",
                  borderRadius: 999,
                  padding: "4px 10px",
                  background: "rgba(79,141,255,0.12)",
                }}
              >
                Region: {user.marketing_region || "global"}
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                onClick={() => void loadMetrics()}
                style={{
                  padding: "8px 14px",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "var(--bg-input)",
                  color: "var(--text-primary)",
                  cursor: metricsLoading ? "not-allowed" : "pointer",
                  opacity: metricsLoading ? 0.7 : 1,
                  fontWeight: 600,
                }}
                disabled={metricsLoading}
              >
                {metricsLoading ? "Refreshing..." : "Refresh"}
              </button>
              <button
                onClick={handleLogout}
                style={{
                  padding: "8px 14px",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "var(--bg-input)",
                  color: "var(--text-primary)",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Log out
              </button>
            </div>
          </div>

          {error && (
            <div
              style={{
                marginBottom: 16,
                padding: "12px 14px",
                borderRadius: 10,
                border: "1px solid rgba(239,95,124,0.28)",
                background: "rgba(239,95,124,0.12)",
                color: "var(--danger)",
              }}
            >
              {error}
            </div>
          )}

          {/* Period tabs */}
          <div
            style={{
              display: "flex",
              gap: 8,
              marginBottom: 18,
              flexWrap: "wrap",
            }}
          >
            {(["day", "week", "month"] as const).map((p) => (
              <button
                key={p}
                onClick={() => handlePeriodChange(p)}
                disabled={metricsLoading}
                style={{
                  padding: "8px 14px",
                  borderRadius: 999,
                  border:
                    "1px solid " +
                    (period === p ? "var(--accent-1)" : "var(--border)"),
                  background:
                    period === p
                      ? "linear-gradient(135deg, rgba(79,141,255,0.24), rgba(79,141,255,0.12))"
                      : "var(--bg-card)",
                  color:
                    period === p ? "var(--accent-1)" : "var(--text-primary)",
                  cursor: metricsLoading ? "not-allowed" : "pointer",
                  fontWeight: 600,
                  textTransform: "capitalize",
                }}
              >
                {p}
              </button>
            ))}
          </div>

          {/* Summary Cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 14,
              marginBottom: 28,
            }}
          >
            {[
              { label: "Total Visits", value: totalVisits },
              { label: "Total Registrations", value: totalRegistrations },
              {
                label: "Total USDT Balance",
                value: totalUsdtBalance.toFixed(3),
              },
              { label: "Total RAC Balance", value: totalRacBalance.toFixed(3) },
              {
                label: "Total USDT Transaction",
                value: totalUsdtTransaction,
              },
              {
                label: "Total USDT Transaction Volume",
                value: totalUsdtTransactionVolume.toFixed(3),
              },
              {
                label: "Total RAC Transaction",
                value: totalRacTransaction,
              },
              {
                label: "Total RAC Transaction Volume",
                value: totalRacTransactionVolume.toFixed(3),
              },
              { label: "USDT Match Count", value: totalUsdtMatchCount },
              { label: "RAC Match Count", value: totalRacMatchCount },
            ].map((card) => (
              <div
                key={card.label}
                style={{
                  ...panelStyle,
                  borderRadius: 12,
                  padding: 16,
                }}
              >
                <div
                  style={{
                    fontSize: "0.78rem",
                    color: "var(--text-muted)",
                    marginBottom: 6,
                  }}
                >
                  {card.label}
                </div>
                <div
                  style={{
                    fontSize: "1.4rem",
                    fontWeight: 800,
                    color: "var(--accent-1)",
                  }}
                >
                  {typeof card.value === "number" && card.value > 100
                    ? card.value.toLocaleString()
                    : card.value}
                </div>
              </div>
            ))}
          </div>

          {/* Trend Charts */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: 14,
              marginBottom: 28,
            }}
          >
            <MiniLineChart
              title="Visits Trend"
              values={visitsTrend}
              color="#4f8dff"
            />
            <MiniLineChart
              title="Registrations Trend"
              values={registrationsTrend}
              color="#22c55e"
            />
            <MiniLineChart
              title="USDT Transaction Volume Trend"
              values={usdtTransactionVolumeTrend}
              color="#a855f7"
            />
            <MiniLineChart
              title="RAC Transaction Volume Trend"
              values={racTransactionVolumeTrend}
              color="#f59e0b"
            />
            <MiniLineChart
              title="USDT Balance Trend"
              values={usdtBalanceTrend}
              color="#06b6d4"
            />
            <MiniLineChart
              title="RAC Balance Trend"
              values={racBalanceTrend}
              color="#ef4444"
            />
            <MiniLineChart
              title="USDT Transaction Trend"
              values={usdtTransactionTrend}
              color="#14b8a6"
            />
            <MiniLineChart
              title="RAC Transaction Trend"
              values={racTransactionTrend}
              color="#f97316"
            />
            <MiniLineChart
              title="USDT Match Count Trend"
              values={usdtMatchTrend}
              color="#0ea5e9"
            />
            <MiniLineChart
              title="RAC Match Count Trend"
              values={racMatchTrend}
              color="#ef6c00"
            />
          </div>

          {/* Metrics Table */}
          <div
            style={{
              ...panelStyle,
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "14px 16px",
                borderBottom: "1px solid var(--border-subtle)",
                fontSize: "0.85rem",
                fontWeight: 700,
                color: "var(--text-muted)",
                background:
                  "linear-gradient(180deg, rgba(79,141,255,0.08), rgba(79,141,255,0.01))",
              }}
            >
              Period Metrics {metricsLoading && "• Loading..."}
            </div>

            {metrics.length === 0 ? (
              <div
                style={{
                  padding: "32px",
                  textAlign: "center",
                  color: "var(--text-muted)",
                }}
              >
                No metrics available for this period.
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: "0.85rem",
                  }}
                >
                  <thead>
                    <tr
                      style={{ borderBottom: "1px solid var(--border-subtle)" }}
                    >
                      <th
                        style={{
                          padding: "10px 12px",
                          textAlign: "left",
                          fontWeight: 600,
                          color: "var(--text-muted)",
                        }}
                      >
                        Period
                      </th>
                      <th
                        style={{
                          padding: "10px 12px",
                          textAlign: "right",
                          fontWeight: 600,
                          color: "var(--text-muted)",
                        }}
                      >
                        Visits
                      </th>
                      <th
                        style={{
                          padding: "10px 12px",
                          textAlign: "right",
                          fontWeight: 600,
                          color: "var(--text-muted)",
                        }}
                      >
                        Registrations
                      </th>
                      <th
                        style={{
                          padding: "10px 12px",
                          textAlign: "right",
                          fontWeight: 600,
                          color: "var(--text-muted)",
                        }}
                      >
                        USDT Balance
                      </th>
                      <th
                        style={{
                          padding: "10px 12px",
                          textAlign: "right",
                          fontWeight: 600,
                          color: "var(--text-muted)",
                        }}
                      >
                        RAC Balance
                      </th>
                      <th
                        style={{
                          padding: "10px 12px",
                          textAlign: "right",
                          fontWeight: 600,
                          color: "var(--text-muted)",
                        }}
                      >
                        USDT Tx
                      </th>
                      <th
                        style={{
                          padding: "10px 12px",
                          textAlign: "right",
                          fontWeight: 600,
                          color: "var(--text-muted)",
                        }}
                      >
                        USDT Tx Vol
                      </th>
                      <th
                        style={{
                          padding: "10px 12px",
                          textAlign: "right",
                          fontWeight: 600,
                          color: "var(--text-muted)",
                        }}
                      >
                        RAC Tx
                      </th>
                      <th
                        style={{
                          padding: "10px 12px",
                          textAlign: "right",
                          fontWeight: 600,
                          color: "var(--text-muted)",
                        }}
                      >
                        RAC Tx Vol
                      </th>
                      <th
                        style={{
                          padding: "10px 12px",
                          textAlign: "right",
                          fontWeight: 600,
                          color: "var(--text-muted)",
                        }}
                      >
                        USDT Transaction Volumn
                      </th>
                      <th
                        style={{
                          padding: "10px 12px",
                          textAlign: "right",
                          fontWeight: 600,
                          color: "var(--text-muted)",
                        }}
                      >
                        RAC Transaction Volumn
                      </th>
                      <th
                        style={{
                          padding: "10px 12px",
                          textAlign: "right",
                          fontWeight: 600,
                          color: "var(--text-muted)",
                        }}
                      >
                        USDT Match
                      </th>
                      <th
                        style={{
                          padding: "10px 12px",
                          textAlign: "right",
                          fontWeight: 600,
                          color: "var(--text-muted)",
                        }}
                      >
                        RAC Match
                      </th>
                      <th
                        style={{
                          padding: "10px 12px",
                          textAlign: "right",
                          fontWeight: 600,
                          color: "var(--text-muted)",
                        }}
                      >
                        Region
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.map((metric, idx) => (
                      <tr
                        key={idx}
                        style={{
                          borderBottom: "1px solid var(--border-subtle)",
                          background: "transparent",
                        }}
                      >
                        <td style={{ padding: "10px 12px" }}>
                          {getMetricLabel(metric)}
                        </td>
                        <td
                          style={{ padding: "10px 12px", textAlign: "right" }}
                        >
                          {metric.visits}
                        </td>
                        <td
                          style={{ padding: "10px 12px", textAlign: "right" }}
                        >
                          {metric.registrations}
                        </td>
                        <td
                          style={{ padding: "10px 12px", textAlign: "right" }}
                        >
                          {metric.total_usdt_balance.toFixed(3)}
                        </td>
                        <td
                          style={{ padding: "10px 12px", textAlign: "right" }}
                        >
                          {metric.total_rac_balance.toFixed(3)}
                        </td>
                        <td
                          style={{ padding: "10px 12px", textAlign: "right" }}
                        >
                          {Number(metric.usdt_transaction ?? 0)}
                        </td>
                        <td
                          style={{ padding: "10px 12px", textAlign: "right" }}
                        >
                          {(
                            metric.usdt_transaction_volume ??
                            metric.usdt_transaction_volume ??
                            0
                          ).toFixed(3)}
                        </td>
                        <td
                          style={{ padding: "10px 12px", textAlign: "right" }}
                        >
                          {Number(metric.rac_transaction ?? 0)}
                        </td>
                        <td
                          style={{ padding: "10px 12px", textAlign: "right" }}
                        >
                          {(
                            metric.rac_transaction_volume ??
                            metric.rac_transaction_volume ??
                            0
                          ).toFixed(3)}
                        </td>
                        <td
                          style={{ padding: "10px 12px", textAlign: "right" }}
                        >
                          {(
                            metric.usdt_transaction_volume ??
                            metric.usdt_transaction_volume ??
                            0
                          ).toFixed(3)}
                        </td>
                        <td
                          style={{ padding: "10px 12px", textAlign: "right" }}
                        >
                          {(
                            metric.rac_transaction_volume ??
                            metric.rac_transaction_volume ??
                            0
                          ).toFixed(3)}
                        </td>
                        <td
                          style={{ padding: "10px 12px", textAlign: "right" }}
                        >
                          {metric.usdt_match_count}
                        </td>
                        <td
                          style={{ padding: "10px 12px", textAlign: "right" }}
                        >
                          {metric.rac_match_count}
                        </td>
                        <td
                          style={{ padding: "10px 12px", textAlign: "right" }}
                        >
                          {metric.region || user.marketing_region || "global"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg-base)",
        color: "var(--text-primary)",
        fontFamily: "var(--font)",
        padding: "32px 24px",
      }}
    >
      <div style={{ maxWidth: 900, margin: "0 auto" }}>Loading…</div>
    </div>
  );
}
