import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Alert,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Feather from "@react-native-vector-icons/feather";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

import { api } from "@/src/api";
import { colors } from "@/src/theme";

function formatSize(bytes: number): string {
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function iconForMime(mime: string): string {
  if (mime.startsWith("image/")) return "image";
  if (mime.includes("pdf")) return "file-text";
  if (mime.includes("word") || mime.includes("document")) return "file-text";
  if (mime.includes("sheet") || mime.includes("excel") || mime.includes("csv"))
    return "grid";
  if (mime.startsWith("video/")) return "film";
  if (mime.startsWith("audio/")) return "music";
  return "file";
}

export default function FolderDetail() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const [busy, setBusy] = useState(false);

  const { data = [] } = useQuery({
    queryKey: ["files", id],
    queryFn: () => api.listFiles(id!),
    enabled: !!id,
  });

  const upload = useMutation({
    mutationFn: (body: any) => api.uploadFile(id!, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["files", id] }),
    onError: (e: any) => Alert.alert("Gagal unggah", e.message || "Coba lagi."),
  });

  const del = useMutation({
    mutationFn: (fid: string) => api.deleteFile(fid),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["files", id] }),
  });

  const pickAndUpload = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
      });
      if (res.canceled) return;
      const a = res.assets[0];
      setBusy(true);
      // Read as base64 from file URI
      let base64 = "";
      if (Platform.OS === "web" && (a as any).file) {
        // Web: read via FileReader
        const file = (a as any).file as File;
        base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(",")[1] || "");
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      } else {
        base64 = await FileSystem.readAsStringAsync(a.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
      }
      await upload.mutateAsync({
        name: a.name,
        mime: a.mimeType || "application/octet-stream",
        size: a.size || 0,
        data: base64,
      });
    } catch (e: any) {
      Alert.alert("Gagal", e.message || "Terjadi kesalahan.");
    } finally {
      setBusy(false);
    }
  };

  const downloadFile = async (fileMeta: any) => {
    try {
      setBusy(true);
      const full = await api.getFile(fileMeta.id);
      if (Platform.OS === "web") {
        // trigger browser download
        const link = document.createElement("a");
        link.href = `data:${full.mime};base64,${full.data}`;
        link.download = full.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        const target = `${FileSystem.cacheDirectory}${full.name}`;
        await FileSystem.writeAsStringAsync(target, full.data, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(target, {
            mimeType: full.mime,
            dialogTitle: `Bagikan / Simpan ${full.name}`,
          });
        } else {
          Alert.alert("Tersimpan", `Berkas disimpan di cache: ${target}`);
        }
      }
    } catch (e: any) {
      Alert.alert("Gagal unduh", e.message || "Coba lagi.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceSecondary }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Feather name="arrow-left" size={22} color={colors.onSurface} />
          </Pressable>
          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={styles.title} numberOfLines={1}>
              {name || "Folder"}
            </Text>
            <Text style={styles.sub}>
              {data.length} berkas
            </Text>
          </View>
          <Pressable
            style={styles.addBtn}
            onPress={pickAndUpload}
            disabled={busy}
            testID="upload-file-btn"
          >
            {busy ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Feather name="upload" size={18} color="#fff" />
            )}
          </Pressable>
        </View>
      </View>

      <FlatList
        data={data}
        keyExtractor={(f) => f.id}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Feather name="file-plus" size={44} color={colors.brandTertiary} />
            <Text style={styles.emptyTitle}>Belum ada berkas</Text>
            <Text style={styles.emptyText}>
              Tekan tombol unggah untuk menambahkan PDF, gambar, atau dokumen ke
              folder ini.
            </Text>
            <Pressable style={styles.uploadCta} onPress={pickAndUpload}>
              <Feather name="upload" size={14} color="#fff" />
              <Text style={styles.uploadCtaText}>Unggah Berkas</Text>
            </Pressable>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.fileRow}>
            <View style={styles.fileIcon}>
              <Feather
                name={iconForMime(item.mime) as any}
                size={18}
                color={colors.brand}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fileName} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.fileMeta}>
                {formatSize(item.size)} •{" "}
                {new Date(item.created_at).toLocaleDateString("id-ID")}
              </Text>
            </View>
            <Pressable
              onPress={() => downloadFile(item)}
              hitSlop={10}
              style={styles.iconBtn}
              testID={`download-${item.id}`}
            >
              <Feather name="download" size={18} color={colors.brand} />
            </Pressable>
            <Pressable
              onPress={() =>
                Alert.alert("Hapus", `Hapus "${item.name}"?`, [
                  { text: "Batal", style: "cancel" },
                  {
                    text: "Hapus",
                    style: "destructive",
                    onPress: () => del.mutate(item.id),
                  },
                ])
              }
              hitSlop={10}
              style={styles.iconBtn}
            >
              <Feather name="trash-2" size={16} color={colors.error} />
            </Pressable>
          </View>
        )}
      />
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
    gap: 12,
  },
  title: { fontSize: 16, fontWeight: "700", color: colors.onSurface },
  sub: { fontSize: 11, color: colors.muted, marginTop: 2 },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  fileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.surface,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
  },
  fileIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  fileName: { fontSize: 13, fontWeight: "600", color: colors.onSurface },
  fileMeta: { fontSize: 11, color: colors.muted, marginTop: 2 },
  iconBtn: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: colors.surfaceTertiary,
  },
  emptyBox: { alignItems: "center", padding: 40, gap: 10 },
  emptyTitle: { fontSize: 14, fontWeight: "700", color: colors.onSurface, marginTop: 8 },
  emptyText: {
    fontSize: 12,
    color: colors.muted,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 12,
  },
  uploadCta: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    backgroundColor: colors.brand,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  uploadCtaText: { color: "#fff", fontWeight: "700", fontSize: 12 },
});
