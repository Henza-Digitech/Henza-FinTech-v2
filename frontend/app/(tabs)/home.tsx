import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  ActivityIndicator,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import Feather from "@react-native-vector-icons/feather";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { api, formatIDR, shortIDR } from "@/src/api";
import { colors } from "@/src/theme";
import { categoryMeta } from "@/src/categories";
import { CategoryIcon } from "@/src/components/CategoryIcon";
import { CashFlowChart } from "@/src/components/CashFlowChart";

const LOGO = require("../../assets/images/icon.png");

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const summary = useQuery({
    queryKey: ["summary"],
    queryFn: () => api.summary(),
  });
  const txs = useQuery({
    queryKey: ["transactions", { limit: 5 }],
    queryFn: () => api.listTransactions({ limit: "5" }),
  });
  const upcoming = useQuery({
    queryKey: ["upcoming"],
    queryFn: () => api.upcomingBills(7),
  });
  const tips = useQuery({
    queryKey: ["ai-tips"],
    queryFn: () => api.aiTips(),
    staleTime: 1000 * 60 * 60,
  });

  const refreshTips = useMutation({
    mutationFn: () => api.aiTips(),
    onSuccess: (data) => qc.setQueryData(["ai-tips"], data),
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      summary.refetch(),
      txs.refetch(),
      upcoming.refetch(),
    ]);
    setRefreshing(false);
  };

  const s = summary.data;
  const recent: any[] = txs.data || [];
  const bills: any[] = upcoming.data || [];

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <LinearGradient
          colors={["#0f2540", "#1a3a5c", "#1f8a9e"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, { paddingTop: insets.top + 16 }]}
        >
          <View style={styles.headerRow}>
            <View style={styles.brandRow}>
              <View style={styles.logoBadge}>
                <Image source={LOGO} style={styles.logo} />
              </View>
              <View>
                <Text style={styles.brandTitle}>HENZA DIGITECH</Text>
                <Text style={styles.brandSub}>Solusindo · Manajemen Keuangan</Text>
              </View>
            </View>
          </View>

          <Text style={styles.balanceLabel}>Total Kekayaan Bersih</Text>
          <Text style={styles.balanceValue} testID="total-wealth">
            {s ? formatIDR(s.total_wealth) : "..."}
          </Text>

          <View style={styles.statRow}>
            <View style={styles.statBox}>
              <View style={styles.statIcon}>
                <Feather name="arrow-down-left" size={14} color={colors.success} />
              </View>
              <View>
                <Text style={styles.statLabel}>Pemasukan</Text>
                <Text style={styles.statValue}>
                  {s ? shortIDR(s.total_income) : "-"}
                </Text>
              </View>
            </View>
            <View style={styles.statBox}>
              <View style={styles.statIcon}>
                <Feather name="arrow-up-right" size={14} color={colors.error} />
              </View>
              <View>
                <Text style={styles.statLabel}>Pengeluaran</Text>
                <Text style={styles.statValue}>
                  {s ? shortIDR(s.total_expense) : "-"}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.ratioBar}>
            <View
              style={[
                styles.ratioFill,
                { width: `${Math.min(100, (s?.expense_ratio || 0) * 100)}%` },
              ]}
            />
          </View>
          <Text style={styles.ratioText}>
            Rasio Pengeluaran: {s ? Math.round((s.expense_ratio || 0) * 100) : 0}%
          </Text>
        </LinearGradient>

        {/* Quick actions */}
        <View style={styles.quickRow}>
          <QuickAction
            icon="plus-circle"
            label="Pemasukan"
            color={colors.success}
            onPress={() => {
              Haptics.selectionAsync();
              router.push("/transaction-form?type=income");
            }}
            testID="qa-income"
          />
          <QuickAction
            icon="minus-circle"
            label="Pengeluaran"
            color={colors.error}
            onPress={() => {
              Haptics.selectionAsync();
              router.push("/transaction-form?type=expense");
            }}
            testID="qa-expense"
          />
          <QuickAction
            icon="credit-card"
            label="Aset"
            color={colors.brandPrimary}
            onPress={() => router.push("/(tabs)/more")}
            testID="qa-assets"
          />
          <QuickAction
            icon="calendar"
            label="Tagihan"
            color={colors.warning}
            onPress={() => router.push("/(tabs)/more")}
            testID="qa-bills"
          />
        </View>

        {/* AI Tip */}
        <View style={styles.card} testID="ai-tips-card">
          <View style={styles.cardHeader}>
            <View style={styles.rowCenter}>
              <Feather name="zap" size={16} color={colors.brandPrimary} />
              <Text style={styles.cardTitle}>Tips Hemat AI</Text>
            </View>
            <Pressable
              onPress={() => refreshTips.mutate()}
              hitSlop={10}
              testID="refresh-tips"
            >
              <Feather
                name="refresh-cw"
                size={16}
                color={colors.muted}
              />
            </Pressable>
          </View>
          {tips.isLoading || refreshTips.isPending ? (
            <ActivityIndicator color={colors.brandPrimary} />
          ) : (
            <Text style={styles.tipText}>
              {tips.data?.tips || "Belum ada tips."}
            </Text>
          )}
        </View>

        {/* Rich Cash Flow chart */}
        <CashFlowChart />

        {/* Upcoming bills */}
        {bills.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.rowCenter}>
                <Feather name="bell" size={16} color={colors.warning} />
                <Text style={styles.cardTitle}>Tagihan Segera Jatuh Tempo</Text>
              </View>
            </View>
            {bills.slice(0, 3).map((b) => (
              <View key={b.id} style={styles.billRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.billName}>{b.name}</Text>
                  <Text style={styles.billMeta}>
                    Tanggal {b.due_day} • {b.days_left === 0 ? "Hari ini" : `${b.days_left} hari lagi`}
                  </Text>
                </View>
                <Text style={styles.billAmount}>{formatIDR(b.amount)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Recent transactions */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Transaksi Terbaru</Text>
            <Pressable onPress={() => router.push("/(tabs)/transactions")}>
              <Text style={styles.link}>Lihat semua</Text>
            </Pressable>
          </View>
          {recent.length === 0 ? (
            <Text style={styles.empty}>Belum ada transaksi.</Text>
          ) : (
            recent.map((t) => {
              const meta = categoryMeta(t.category);
              return (
                <View key={t.id} style={styles.txRow}>
                  <CategoryIcon name={meta.icon} color={meta.color} size={16} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.txTitle}>
                      {t.description || meta.label}
                    </Text>
                    <Text style={styles.txMeta}>
                      {meta.label} • {t.scope === "business" ? "Bisnis" : "Pribadi"}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.txAmount,
                      { color: t.type === "income" ? colors.success : colors.error },
                    ]}
                  >
                    {t.type === "income" ? "+" : "-"}
                    {shortIDR(t.amount)}
                  </Text>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function QuickAction({
  icon,
  label,
  color,
  onPress,
  testID,
}: {
  icon: string;
  label: string;
  color: string;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable style={styles.qa} onPress={onPress} testID={testID}>
      <View style={[styles.qaIcon, { backgroundColor: `${color}18` }]}>
        <Feather name={icon as any} size={20} color={color} />
      </View>
      <Text style={styles.qaLabel}>{label}</Text>
    </Pressable>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.rowCenter}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surfaceSecondary },
  hero: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.95)",
    alignItems: "center",
    justifyContent: "center",
    padding: 6,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  logo: { width: "100%", height: "100%", resizeMode: "contain" },
  brandTitle: { color: "#fff", fontWeight: "800", fontSize: 16, letterSpacing: 0.8 },
  brandSub: { color: "rgba(255,255,255,0.7)", fontSize: 11 },
  balanceLabel: { color: "rgba(255,255,255,0.7)", fontSize: 12, marginTop: 4 },
  balanceValue: { color: "#fff", fontSize: 30, fontWeight: "700", marginTop: 4 },
  statRow: { flexDirection: "row", gap: 12, marginTop: 16 },
  statBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    padding: 10,
    borderRadius: 12,
    gap: 8,
  },
  statIcon: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
  statLabel: { color: "rgba(255,255,255,0.7)", fontSize: 10 },
  statValue: { color: "#fff", fontWeight: "700", fontSize: 13 },
  ratioBar: {
    height: 6,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 999,
    marginTop: 14,
    overflow: "hidden",
  },
  ratioFill: { height: "100%", backgroundColor: colors.warning },
  ratioText: { color: "rgba(255,255,255,0.8)", fontSize: 11, marginTop: 6 },

  quickRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    marginTop: 16,
    justifyContent: "space-between",
  },
  qa: { alignItems: "center", flex: 1 },
  qaIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  qaLabel: { fontSize: 11, color: colors.onSurfaceSecondary, fontWeight: "500" },

  card: {
    backgroundColor: colors.surface,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.onSurface,
    marginLeft: 6,
  },
  rowCenter: { flexDirection: "row", alignItems: "center" },
  link: { color: colors.brandPrimary, fontSize: 12, fontWeight: "600" },
  tipText: { color: colors.onSurfaceSecondary, fontSize: 13, lineHeight: 20 },
  empty: { color: colors.muted, fontSize: 12, textAlign: "center", padding: 16 },
  legendRow: { flexDirection: "row", gap: 16, marginTop: 8, justifyContent: "center" },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 4 },
  legendText: { fontSize: 11, color: colors.muted },

  billRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  billName: { fontSize: 13, fontWeight: "600", color: colors.onSurface },
  billMeta: { fontSize: 11, color: colors.muted, marginTop: 2 },
  billAmount: { fontSize: 13, fontWeight: "700", color: colors.warning },

  txRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  txTitle: { fontSize: 13, fontWeight: "600", color: colors.onSurface },
  txMeta: { fontSize: 11, color: colors.muted, marginTop: 2 },
  txAmount: { fontSize: 13, fontWeight: "700" },
});
