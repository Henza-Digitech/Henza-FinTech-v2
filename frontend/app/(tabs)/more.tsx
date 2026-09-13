import { View, Text, StyleSheet, ScrollView, Pressable, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import Feather from "@react-native-vector-icons/feather";
import { useRouter } from "expo-router";

import { api, formatIDR } from "@/src/api";
import { colors } from "@/src/theme";

const LOGO = require("../../assets/images/icon.png");

export default function MoreScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const assets = useQuery({ queryKey: ["assets"], queryFn: () => api.listAssets() });
  const bills = useQuery({ queryKey: ["bills"], queryFn: () => api.listBills() });
  const upcoming = useQuery({
    queryKey: ["upcoming", 30],
    queryFn: () => api.upcomingBills(30),
  });
  const folders = useQuery({
    queryKey: ["folders", ""],
    queryFn: () => api.listFolders(),
  });

  const totalAssets = (assets.data || []).reduce(
    (sum: number, a: any) => sum + (a.balance || 0),
    0
  );
  const urgentCount = (upcoming.data || []).filter((b: any) => b.days_left <= 7).length;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 32 }}
      >
        {/* Brand header */}
        <View style={styles.brandCard}>
          <View style={styles.logoBadge}>
            <Image source={LOGO} style={styles.logo} />
          </View>
          <Text style={styles.brandName}>HENZA DIGITECH</Text>
          <Text style={styles.brandTag}>Solusindo · Financial App</Text>
        </View>

        {/* Aset Kas Lain */}
        <Section
          title="Aset Kas Lain"
          subtitle={formatIDR(totalAssets)}
          icon="credit-card"
          onPress={() => router.push("/assets-list")}
          count={(assets.data || []).length}
          testID="menu-assets"
        />

        {/* Tagihan Rutin */}
        <Section
          title="Tagihan Rutin"
          subtitle={
            urgentCount > 0
              ? `${urgentCount} tagihan segera jatuh tempo`
              : `${(bills.data || []).length} tagihan aktif`
          }
          icon="calendar"
          badge={urgentCount > 0 ? urgentCount : undefined}
          onPress={() => router.push("/bills-list")}
          count={(bills.data || []).length}
          testID="menu-bills"
        />

        {/* Berkas Perusahaan */}
        <Section
          title="Berkas Perusahaan"
          subtitle="Simpan & unduh dokumen penting"
          icon="folder"
          onPress={() => router.push("/folders-list")}
          count={(folders.data || []).length}
          testID="menu-folders"
        />

        {/* Cadangan Data */}
        <Section
          title="Cadangan Data"
          subtitle="Ekspor & impor data untuk pindah HP"
          icon="hard-drive"
          onPress={() => router.push("/backup")}
          testID="menu-backup"
        />

        {/* Info */}
        <View style={styles.infoBox}>
          <Feather name="info" size={14} color={colors.brandPrimary} />
          <Text style={styles.infoText}>
            Pemasukan Anda otomatis diakumulasi dengan Aset Kas Lain untuk menghitung Total Kekayaan Bersih.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function Section({
  title,
  subtitle,
  icon,
  onPress,
  badge,
  count,
  testID,
}: {
  title: string;
  subtitle?: string;
  icon: string;
  onPress: () => void;
  badge?: number;
  count?: number;
  testID?: string;
}) {
  return (
    <Pressable style={styles.row} onPress={onPress} testID={testID}>
      <View style={styles.rowIcon}>
        <Feather name={icon as any} size={18} color={colors.brand} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={styles.rowTitle}>{title}</Text>
          {badge !== undefined && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          )}
        </View>
        {subtitle && <Text style={styles.rowSub}>{subtitle}</Text>}
      </View>
      {count !== undefined && (
        <Text style={styles.count}>{count}</Text>
      )}
      <Feather name="chevron-right" size={18} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surfaceSecondary },
  brandCard: {
    alignItems: "center",
    paddingVertical: 24,
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  logoBadge: {
    width: 110,
    height: 110,
    borderRadius: 24,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
    padding: 10,
  },
  logo: { width: "100%", height: "100%", resizeMode: "contain" },
  brandName: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.brand,
    marginTop: 12,
    letterSpacing: 1,
  },
  brandTag: { fontSize: 12, color: colors.muted, marginTop: 2 },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface,
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  rowTitle: { fontSize: 14, fontWeight: "600", color: colors.onSurface },
  rowSub: { fontSize: 11, color: colors.muted, marginTop: 2 },
  count: { fontSize: 12, color: colors.muted, fontWeight: "600" },
  badge: {
    backgroundColor: colors.warning,
    borderRadius: 10,
    paddingHorizontal: 6,
    minWidth: 20,
    alignItems: "center",
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },

  infoBox: {
    flexDirection: "row",
    gap: 10,
    padding: 12,
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: colors.brandTertiary,
    borderRadius: 12,
  },
  infoText: { flex: 1, fontSize: 12, color: colors.brand, lineHeight: 18 },
});
