import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Feather from "@react-native-vector-icons/feather";
import { useRouter } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

import { api } from "@/src/api";
import { colors } from "@/src/theme";

export default function BackupScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<"export" | "import" | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const preview = useQuery({
    queryKey: ["export-preview"],
    queryFn: () => api.exportAll(),
  });

  const doExport = async () => {
    try {
      setBusy("export");
      const bundle = await api.exportAll();
      const json = JSON.stringify(bundle, null, 2);
      const filename = `henza-backup-${new Date()
        .toISOString()
        .slice(0, 10)}.json`;

      if (Platform.OS === "web") {
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        const target = `${FileSystem.cacheDirectory}${filename}`;
        await FileSystem.writeAsStringAsync(target, json, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(target, {
            mimeType: "application/json",
            dialogTitle: "Simpan / Bagikan Cadangan HENZA",
          });
        } else {
          Alert.alert("Tersimpan", `Berkas cadangan: ${target}`);
        }
      }
      setLastResult(
        `✓ Ekspor berhasil: ${bundle.counts.transactions} transaksi, ${bundle.counts.assets} aset, ${bundle.counts.bills} tagihan, ${bundle.counts.contacts} kontak, ${bundle.counts.folders} folder, ${bundle.counts.files} berkas.`
      );
    } catch (e: any) {
      Alert.alert("Gagal ekspor", e.message || "Coba lagi.");
    } finally {
      setBusy(null);
    }
  };

  const doImport = async (mode: "merge" | "replace") => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: "application/json",
        copyToCacheDirectory: true,
      });
      if (res.canceled) return;
      const a = res.assets[0];
      setBusy("import");

      let text = "";
      if (Platform.OS === "web" && (a as any).file) {
        text = await (a as any).file.text();
      } else {
        text = await FileSystem.readAsStringAsync(a.uri, {
          encoding: FileSystem.EncodingType.UTF8,
        });
      }
      const bundle = JSON.parse(text);
      if (bundle.app && bundle.app !== "HENZA_DIGITECH") {
        throw new Error("Berkas cadangan bukan dari HENZA DIGITECH.");
      }
      const result = await api.importAll({ ...bundle, mode });
      const r = result.results;
      setLastResult(
        `✓ Impor (${mode}) berhasil:\n` +
          Object.entries(r)
            .map(
              ([k, v]: any) =>
                `• ${k}: +${v.inserted} baru, ${v.skipped} dilewati`
            )
            .join("\n")
      );
      qc.invalidateQueries();
    } catch (e: any) {
      Alert.alert("Gagal impor", e.message || "Berkas tidak valid.");
    } finally {
      setBusy(null);
    }
  };

  const c = preview.data?.counts || {
    transactions: 0,
    assets: 0,
    bills: 0,
    contacts: 0,
    folders: 0,
    files: 0,
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceSecondary }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Feather name="arrow-left" size={22} color={colors.onSurface} />
          </Pressable>
          <Text style={styles.title}>Cadangan Data</Text>
          <View style={{ width: 22 }} />
        </View>
        <Text style={styles.sub}>
          Simpan semua data Anda sebagai satu berkas untuk pindah HP atau
          cadangan
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        {/* Stats */}
        <View style={styles.statCard}>
          <Text style={styles.statTitle}>Ringkasan Data</Text>
          <View style={styles.statGrid}>
            <StatRow icon="list" label="Transaksi" value={c.transactions} />
            <StatRow icon="credit-card" label="Aset Kas" value={c.assets} />
            <StatRow icon="calendar" label="Tagihan" value={c.bills} />
            <StatRow icon="users" label="Kontak" value={c.contacts} />
            <StatRow icon="folder" label="Folder" value={c.folders} />
            <StatRow icon="file" label="Berkas" value={c.files} />
          </View>
        </View>

        {/* Export */}
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <View style={styles.iconBox}>
              <Feather name="download" size={18} color={colors.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Ekspor Data</Text>
              <Text style={styles.cardSub}>
                Unduh semua data dalam satu berkas JSON. Simpan ke HP, Drive,
                atau kirim ke diri sendiri via WhatsApp/Email.
              </Text>
            </View>
          </View>
          <Pressable
            style={styles.primaryBtn}
            onPress={doExport}
            disabled={busy !== null}
            testID="export-btn"
          >
            {busy === "export" ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Feather name="download" size={16} color="#fff" />
                <Text style={styles.primaryText}>Ekspor Sekarang</Text>
              </>
            )}
          </Pressable>
        </View>

        {/* Import */}
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <View style={[styles.iconBox, { backgroundColor: `${colors.info}18` }]}>
              <Feather name="upload" size={18} color={colors.info} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Impor Data</Text>
              <Text style={styles.cardSub}>
                Pulihkan data dari berkas cadangan HENZA sebelumnya. Cocok saat
                ganti HP.
              </Text>
            </View>
          </View>
          <Pressable
            style={styles.secondaryBtn}
            onPress={() => doImport("merge")}
            disabled={busy !== null}
            testID="import-merge-btn"
          >
            {busy === "import" ? (
              <ActivityIndicator color={colors.brand} />
            ) : (
              <>
                <Feather name="git-merge" size={16} color={colors.brand} />
                <Text style={styles.secondaryText}>
                  Gabungkan (data yang ada tetap aman)
                </Text>
              </>
            )}
          </Pressable>
          <Pressable
            style={[styles.secondaryBtn, { borderColor: colors.error }]}
            onPress={() =>
              Alert.alert(
                "Ganti Semua Data?",
                "Semua data saat ini akan DIHAPUS dan diganti dengan data dari berkas cadangan. Tindakan ini tidak dapat dibatalkan.",
                [
                  { text: "Batal", style: "cancel" },
                  {
                    text: "Ganti",
                    style: "destructive",
                    onPress: () => doImport("replace"),
                  },
                ]
              )
            }
            disabled={busy !== null}
            testID="import-replace-btn"
          >
            <Feather name="refresh-cw" size={16} color={colors.error} />
            <Text style={[styles.secondaryText, { color: colors.error }]}>
              Ganti Semua Data
            </Text>
          </Pressable>
        </View>

        {lastResult && (
          <View style={styles.resultBox}>
            <Text style={styles.resultText}>{lastResult}</Text>
          </View>
        )}

        <View style={styles.infoBox}>
          <Feather name="info" size={14} color={colors.brandPrimary} />
          <Text style={styles.infoText}>
            Simpan berkas cadangan di tempat aman (Google Drive, iCloud, atau
            email diri sendiri). Berkas ini berisi semua data keuangan dan
            berkas perusahaan Anda.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function StatRow({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: number;
}) {
  return (
    <View style={styles.statRow}>
      <Feather name={icon as any} size={14} color={colors.brand} />
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  title: { fontSize: 18, fontWeight: "700", color: colors.onSurface },
  sub: { fontSize: 11, color: colors.muted },

  statCard: {
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  statTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  statGrid: { gap: 8 },
  statRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 4,
  },
  statLabel: { flex: 1, fontSize: 13, color: colors.onSurface },
  statValue: { fontSize: 13, fontWeight: "700", color: colors.brand },

  card: {
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  cardHead: { flexDirection: "row", gap: 12, marginBottom: 12 },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: { fontSize: 14, fontWeight: "700", color: colors.onSurface },
  cardSub: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 2,
    lineHeight: 16,
  },
  primaryBtn: {
    flexDirection: "row",
    gap: 8,
    height: 46,
    backgroundColor: colors.brand,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  secondaryBtn: {
    flexDirection: "row",
    gap: 8,
    height: 44,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  secondaryText: { color: colors.brand, fontWeight: "700", fontSize: 12 },

  resultBox: {
    backgroundColor: `${colors.success}15`,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: `${colors.success}40`,
  },
  resultText: { fontSize: 12, color: colors.success, lineHeight: 18 },

  infoBox: {
    flexDirection: "row",
    gap: 10,
    padding: 12,
    backgroundColor: colors.brandTertiary,
    borderRadius: 12,
  },
  infoText: { flex: 1, fontSize: 11, color: colors.brand, lineHeight: 16 },
});
