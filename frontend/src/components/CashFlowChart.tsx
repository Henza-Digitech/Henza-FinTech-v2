import { useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { BarChart, LineChart } from "react-native-gifted-charts";
import Feather from "@react-native-vector-icons/feather";

import { api, formatIDR, shortIDR } from "@/src/api";
import { colors } from "@/src/theme";
import { categoryMeta } from "@/src/categories";

type Scope = "all" | "personal" | "business";
type Range = 6 | 12;
type Mode = "bars" | "trend";

export function CashFlowChart() {
  const [scope, setScope] = useState<Scope>("all");
  const [range, setRange] = useState<Range>(6);
  const [mode, setMode] = useState<Mode>("bars");
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["analytics", range, scope],
    queryFn: () => api.analytics(range, scope),
  });

  const series = data?.series || [];

  // Reset selection when data changes
  const activeIdx =
    selectedIdx !== null && selectedIdx < series.length
      ? selectedIdx
      : series.length - 1;
  const active = series[activeIdx];

  const maxVal = useMemo(() => {
    let m = 0;
    for (const s of series) {
      m = Math.max(m, s.income, s.expense);
    }
    return m || 1;
  }, [series]);

  // Bar chart data: two bars per month
  const barData = useMemo(() => {
    const out: any[] = [];
    series.forEach((s: any, i: number) => {
      const focus = i === activeIdx;
      out.push({
        value: s.income,
        label: s.label,
        frontColor: focus ? colors.success : `${colors.success}CC`,
        spacing: 3,
        onPress: () => setSelectedIdx(i),
        topLabelComponent:
          focus && s.income > 0
            ? () => (
                <Text style={styles.barTopLabel}>{shortIDR(s.income)}</Text>
              )
            : undefined,
      });
      out.push({
        value: s.expense,
        frontColor: focus ? colors.error : `${colors.error}CC`,
        spacing: 12,
        onPress: () => setSelectedIdx(i),
        topLabelComponent:
          focus && s.expense > 0
            ? () => (
                <Text style={styles.barTopLabel}>{shortIDR(s.expense)}</Text>
              )
            : undefined,
      });
    });
    return out;
  }, [series, activeIdx]);

  // Trend (line): net cash flow across months
  const trendData = useMemo(() => {
    return series.map((s: any, i: number) => ({
      value: s.net,
      label: s.label,
      dataPointColor:
        i === activeIdx ? colors.brand : s.net >= 0 ? colors.success : colors.error,
      dataPointRadius: i === activeIdx ? 6 : 4,
      onPress: () => setSelectedIdx(i),
      labelTextStyle: { color: colors.muted, fontSize: 10 },
    }));
  }, [series, activeIdx]);

  const incomeCats = active
    ? Object.entries(active.by_category_income || {}).sort(
        (a: any, b: any) => b[1] - a[1]
      )
    : [];
  const expenseCats = active
    ? Object.entries(active.by_category_expense || {}).sort(
        (a: any, b: any) => b[1] - a[1]
      )
    : [];

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Arus Kas Bulanan</Text>
          <Text style={styles.sub}>
            {range} bulan terakhir •{" "}
            {scope === "all" ? "Semua" : scope === "personal" ? "Pribadi" : "Bisnis"}
          </Text>
        </View>
        <View style={styles.rangeToggle}>
          <Pressable
            style={[styles.rangeBtn, range === 6 && styles.rangeActive]}
            onPress={() => setRange(6)}
          >
            <Text
              style={[
                styles.rangeText,
                range === 6 && { color: colors.brand, fontWeight: "700" },
              ]}
            >
              6B
            </Text>
          </Pressable>
          <Pressable
            style={[styles.rangeBtn, range === 12 && styles.rangeActive]}
            onPress={() => setRange(12)}
          >
            <Text
              style={[
                styles.rangeText,
                range === 12 && { color: colors.brand, fontWeight: "700" },
              ]}
            >
              12B
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Scope chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsRow}
      >
        {(["all", "personal", "business"] as const).map((s) => (
          <Pressable
            key={s}
            style={[styles.chip, scope === s && styles.chipActive]}
            onPress={() => {
              setScope(s);
              setSelectedIdx(null);
            }}
          >
            <Text
              style={[styles.chipText, scope === s && { color: "#fff" }]}
            >
              {s === "all" ? "Semua" : s === "personal" ? "Pribadi" : "Bisnis"}
            </Text>
          </Pressable>
        ))}
        <View style={styles.sep} />
        {(["bars", "trend"] as const).map((m) => (
          <Pressable
            key={m}
            style={[styles.chip, mode === m && styles.chipActive]}
            onPress={() => setMode(m)}
          >
            <Feather
              name={m === "bars" ? "bar-chart-2" : "trending-up"}
              size={12}
              color={mode === m ? "#fff" : colors.muted}
              style={{ marginRight: 4 }}
            />
            <Text
              style={[styles.chipText, mode === m && { color: "#fff" }]}
            >
              {m === "bars" ? "Batang" : "Tren Bersih"}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Progress vs previous window */}
      {data && (
        <View style={styles.progressRow}>
          <ProgressPill
            icon="trending-up"
            label="Pemasukan"
            change={data.income_change_pct}
            positiveGood
          />
          <ProgressPill
            icon="trending-down"
            label="Pengeluaran"
            change={data.expense_change_pct}
            positiveGood={false}
          />
        </View>
      )}

      {/* Chart */}
      <View style={{ marginTop: 12, alignItems: "center" }}>
        {isLoading || series.length === 0 ? (
          <Text style={styles.empty}>Memuat data...</Text>
        ) : mode === "bars" ? (
          <BarChart
            data={barData}
            height={160}
            barWidth={range === 12 ? 8 : 12}
            barBorderRadius={4}
            spacing={2}
            initialSpacing={8}
            endSpacing={4}
            yAxisTextStyle={{ color: colors.muted, fontSize: 9 }}
            xAxisLabelTextStyle={{ color: colors.muted, fontSize: 10 }}
            noOfSections={3}
            hideRules
            xAxisColor={colors.border}
            yAxisColor={colors.border}
            maxValue={maxVal * 1.15}
            formatYLabel={(v: any) => shortIDR(parseFloat(v)).replace("Rp ", "")}
          />
        ) : (
          <LineChart
            data={trendData}
            height={160}
            thickness={3}
            color={colors.brand}
            areaChart
            startFillColor={colors.brand}
            endFillColor={colors.brand}
            startOpacity={0.25}
            endOpacity={0.02}
            curved
            dataPointsColor={colors.brand}
            hideRules
            xAxisColor={colors.border}
            yAxisColor={colors.border}
            yAxisTextStyle={{ color: colors.muted, fontSize: 9 }}
            xAxisLabelTextStyle={{ color: colors.muted, fontSize: 10 }}
            noOfSections={3}
            formatYLabel={(v: any) => shortIDR(parseFloat(v)).replace("Rp ", "")}
          />
        )}
      </View>

      {/* Legend */}
      <View style={styles.legendRow}>
        {mode === "bars" ? (
          <>
            <LegendDot color={colors.success} label="Pemasukan" />
            <LegendDot color={colors.error} label="Pengeluaran" />
          </>
        ) : (
          <LegendDot color={colors.brand} label="Arus Kas Bersih (Net)" />
        )}
      </View>

      {/* Breakdown for selected month */}
      {active && (
        <View style={styles.breakdown}>
          <View style={styles.breakdownHead}>
            <View>
              <Text style={styles.breakdownLabel}>
                Detail {active.label} {active.year}
              </Text>
              <Text style={styles.breakdownSub}>
                {active.count} transaksi
              </Text>
            </View>
            <View style={styles.netBox}>
              <Text style={styles.netLabel}>Net</Text>
              <Text
                style={[
                  styles.netVal,
                  { color: active.net >= 0 ? colors.success : colors.error },
                ]}
              >
                {active.net >= 0 ? "+" : ""}
                {shortIDR(active.net)}
              </Text>
            </View>
          </View>

          <View style={styles.summaryPills}>
            <MiniStat
              icon="arrow-down-left"
              tint={colors.success}
              label="Masuk"
              value={formatIDR(active.income)}
            />
            <MiniStat
              icon="arrow-up-right"
              tint={colors.error}
              label="Keluar"
              value={formatIDR(active.expense)}
            />
          </View>

          {expenseCats.length > 0 && (
            <>
              <Text style={styles.breakdownSection}>Pengeluaran per Kategori</Text>
              {expenseCats.slice(0, 5).map(([k, v]: any) => {
                const meta = categoryMeta(k);
                const share = active.expense > 0 ? v / active.expense : 0;
                return (
                  <View key={`e-${k}`} style={styles.catRow}>
                    <View style={[styles.catDot, { backgroundColor: meta.color }]} />
                    <Text style={styles.catName}>{meta.label}</Text>
                    <View style={styles.catBar}>
                      <View
                        style={[
                          styles.catBarFill,
                          {
                            width: `${Math.min(100, share * 100)}%`,
                            backgroundColor: meta.color,
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.catVal}>{shortIDR(v)}</Text>
                  </View>
                );
              })}
            </>
          )}

          {incomeCats.length > 0 && (
            <>
              <Text style={styles.breakdownSection}>Pemasukan per Kategori</Text>
              {incomeCats.slice(0, 3).map(([k, v]: any) => {
                const meta = categoryMeta(k);
                const share = active.income > 0 ? v / active.income : 0;
                return (
                  <View key={`i-${k}`} style={styles.catRow}>
                    <View style={[styles.catDot, { backgroundColor: meta.color }]} />
                    <Text style={styles.catName}>{meta.label}</Text>
                    <View style={styles.catBar}>
                      <View
                        style={[
                          styles.catBarFill,
                          {
                            width: `${Math.min(100, share * 100)}%`,
                            backgroundColor: meta.color,
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.catVal}>{shortIDR(v)}</Text>
                  </View>
                );
              })}
            </>
          )}
          <Text style={styles.hint}>
            <Feather name="info" size={10} color={colors.muted} /> Tekan batang / titik
            bulan lain untuk lihat detailnya
          </Text>
        </View>
      )}
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

function ProgressPill({
  icon,
  label,
  change,
  positiveGood,
}: {
  icon: string;
  label: string;
  change: number;
  positiveGood: boolean;
}) {
  const good = positiveGood ? change > 0 : change < 0;
  const arrow = change > 0 ? "trending-up" : change < 0 ? "trending-down" : "minus";
  const c = good ? colors.success : change === 0 ? colors.muted : colors.error;
  return (
    <View style={styles.progressPill}>
      <View style={[styles.progressIcon, { backgroundColor: `${c}18` }]}>
        <Feather name={icon as any} size={12} color={c} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.progressLabel}>{label}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Feather name={arrow as any} size={11} color={c} />
          <Text style={[styles.progressChange, { color: c }]}>
            {change === 0
              ? "±0%"
              : `${change > 0 ? "+" : ""}${change.toFixed(1)}%`}
          </Text>
        </View>
      </View>
    </View>
  );
}

function MiniStat({
  icon,
  tint,
  label,
  value,
}: {
  icon: string;
  tint: string;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.miniStat}>
      <View style={[styles.miniIcon, { backgroundColor: `${tint}18` }]}>
        <Feather name={icon as any} size={12} color={tint} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.miniLabel}>{label}</Text>
        <Text style={[styles.miniValue, { color: tint }]}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  title: { fontSize: 14, fontWeight: "700", color: colors.onSurface },
  sub: { fontSize: 11, color: colors.muted, marginTop: 2 },
  rangeToggle: {
    flexDirection: "row",
    backgroundColor: colors.surfaceTertiary,
    borderRadius: 8,
    padding: 2,
  },
  rangeBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  rangeActive: { backgroundColor: colors.surface },
  rangeText: { fontSize: 11, color: colors.muted, fontWeight: "600" },

  chipsRow: { gap: 6, paddingVertical: 10, alignItems: "center" },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    height: 28,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    flexShrink: 0,
  },
  chipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { fontSize: 11, color: colors.onSurfaceSecondary, fontWeight: "500" },
  sep: { width: 1, height: 16, backgroundColor: colors.border, marginHorizontal: 4 },

  progressRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  progressPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 10,
    padding: 8,
  },
  progressIcon: {
    width: 26,
    height: 26,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  progressLabel: { fontSize: 10, color: colors.muted },
  progressChange: { fontSize: 12, fontWeight: "700" },

  barTopLabel: {
    fontSize: 9,
    color: colors.onSurface,
    fontWeight: "700",
    marginBottom: 2,
  },
  empty: { color: colors.muted, fontSize: 12, padding: 20 },

  legendRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
    marginTop: 8,
  },
  legendItem: { flexDirection: "row", alignItems: "center" },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 4 },
  legendText: { fontSize: 10, color: colors.muted },

  breakdown: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  breakdownHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  breakdownLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.onSurface,
  },
  breakdownSub: { fontSize: 10, color: colors.muted, marginTop: 2 },
  netBox: { alignItems: "flex-end" },
  netLabel: { fontSize: 9, color: colors.muted, textTransform: "uppercase" },
  netVal: { fontSize: 15, fontWeight: "800", marginTop: 2 },

  summaryPills: { flexDirection: "row", gap: 8, marginTop: 12 },
  miniStat: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 10,
    padding: 8,
  },
  miniIcon: {
    width: 26,
    height: 26,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  miniLabel: { fontSize: 10, color: colors.muted },
  miniValue: { fontSize: 12, fontWeight: "700", marginTop: 1 },

  breakdownSection: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.muted,
    marginTop: 14,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  catRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
  },
  catDot: { width: 8, height: 8, borderRadius: 4 },
  catName: {
    fontSize: 11,
    color: colors.onSurfaceSecondary,
    minWidth: 80,
    fontWeight: "500",
  },
  catBar: {
    flex: 1,
    height: 6,
    backgroundColor: colors.surfaceTertiary,
    borderRadius: 3,
    overflow: "hidden",
  },
  catBarFill: { height: "100%", borderRadius: 3 },
  catVal: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.onSurface,
    minWidth: 60,
    textAlign: "right",
  },
  hint: {
    fontSize: 10,
    color: colors.muted,
    textAlign: "center",
    marginTop: 10,
    fontStyle: "italic",
  },
});
