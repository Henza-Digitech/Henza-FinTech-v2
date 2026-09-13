import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Feather from "@react-native-vector-icons/feather";
import { useRouter } from "expo-router";

import { api } from "@/src/api";
import { colors } from "@/src/theme";

export default function FoldersList() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ name: "", notes: "" });

  const { data = [] } = useQuery({
    queryKey: ["folders", q],
    queryFn: () => api.listFolders(q),
  });

  const save = useMutation({
    mutationFn: () =>
      editing
        ? api.updateFolder(editing.id, form)
        : api.createFolder(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["folders"] });
      close();
    },
  });

  const del = useMutation({
    mutationFn: (id: string) => api.deleteFolder(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["folders"] }),
  });

  function open(f: any = null) {
    if (f) {
      setEditing(f);
      setForm({ name: f.name, notes: f.notes || "" });
    } else {
      setEditing(null);
      setForm({ name: "", notes: "" });
    }
    setShowForm(true);
  }

  function close() {
    setShowForm(false);
    setEditing(null);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceSecondary }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Feather name="arrow-left" size={22} color={colors.onSurface} />
          </Pressable>
          <Text style={styles.title}>Berkas Perusahaan</Text>
          <Pressable style={styles.addBtn} onPress={() => open()} testID="add-folder-btn">
            <Feather name="plus" size={18} color="#fff" />
          </Pressable>
        </View>
        <View style={styles.searchBox}>
          <Feather name="search" size={16} color={colors.muted} />
          <TextInput
            placeholder="Cari folder..."
            value={q}
            onChangeText={setQ}
            style={styles.searchInput}
            placeholderTextColor={colors.muted}
            testID="search-folder-input"
          />
        </View>
      </View>

      <FlatList
        data={data}
        keyExtractor={(f) => f.id}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Feather name="folder" size={44} color={colors.brandTertiary} />
            <Text style={styles.emptyTitle}>Belum ada folder</Text>
            <Text style={styles.emptyText}>
              Tambah folder untuk menyimpan berkas penting perusahaan (kontrak,
              faktur, SIUP, dsb).
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() =>
              router.push(`/folder/${item.id}?name=${encodeURIComponent(item.name)}`)
            }
            onLongPress={() =>
              Alert.alert(item.name, "Pilih tindakan", [
                { text: "Edit", onPress: () => open(item) },
                {
                  text: "Hapus",
                  style: "destructive",
                  onPress: () =>
                    Alert.alert(
                      "Hapus Folder",
                      `Hapus folder "${item.name}" beserta semua berkas di dalamnya?`,
                      [
                        { text: "Batal", style: "cancel" },
                        {
                          text: "Hapus",
                          style: "destructive",
                          onPress: () => del.mutate(item.id),
                        },
                      ]
                    ),
                },
                { text: "Batal", style: "cancel" },
              ])
            }
            testID={`folder-${item.id}`}
          >
            <View style={styles.folderIcon}>
              <Feather name="folder" size={20} color={colors.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.meta}>
                {item.file_count || 0} berkas
                {item.notes ? ` • ${item.notes}` : ""}
              </Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.muted} />
          </Pressable>
        )}
      />

      <Modal visible={showForm} transparent animationType="slide" onRequestClose={close}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" }}
        >
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>
                {editing ? "Edit Folder" : "Tambah Folder"}
              </Text>
              <Pressable onPress={close} hitSlop={10}>
                <Feather name="x" size={22} color={colors.onSurface} />
              </Pressable>
            </View>
            <TextInput
              placeholder="Nama folder (misal: Kontrak 2026)"
              value={form.name}
              onChangeText={(v) => setForm({ ...form, name: v })}
              style={styles.input}
              placeholderTextColor={colors.muted}
              testID="folder-name-input"
            />
            <TextInput
              placeholder="Catatan (opsional)"
              value={form.notes}
              onChangeText={(v) => setForm({ ...form, notes: v })}
              style={styles.input}
              placeholderTextColor={colors.muted}
            />
            <Pressable
              style={[styles.saveBtn, !form.name && { opacity: 0.5 }]}
              disabled={!form.name || save.isPending}
              onPress={() => save.mutate()}
              testID="save-folder-btn"
            >
              <Text style={styles.saveText}>Simpan</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
    marginBottom: 12,
  },
  title: { fontSize: 18, fontWeight: "700", color: colors.onSurface },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceTertiary,
    paddingHorizontal: 12,
    borderRadius: 10,
    height: 40,
    gap: 8,
  },
  searchInput: { flex: 1, color: colors.onSurface, fontSize: 13 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
  },
  folderIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  name: { fontSize: 14, fontWeight: "600", color: colors.onSurface },
  meta: { fontSize: 11, color: colors.muted, marginTop: 2 },

  emptyBox: { alignItems: "center", padding: 40, gap: 10 },
  emptyTitle: { fontSize: 14, fontWeight: "700", color: colors.onSurface, marginTop: 8 },
  emptyText: { fontSize: 12, color: colors.muted, textAlign: "center", lineHeight: 18 },

  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  sheetHead: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  sheetTitle: { fontSize: 18, fontWeight: "700", color: colors.onSurface },
  input: {
    height: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    color: colors.onSurface,
    fontSize: 13,
    marginTop: 10,
  },
  saveBtn: {
    height: 48,
    backgroundColor: colors.brand,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  saveText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
