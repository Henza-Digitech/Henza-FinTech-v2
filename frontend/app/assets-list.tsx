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

import { api, formatIDR } from "@/src/api";
import { colors } from "@/src/theme";
import { ASSET_KINDS } from "@/src/categories";

export default function AssetsList() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({
    name: "",
    kind: "bank",
    balance: "",
    notes: "",
  });

  const { data = [] } = useQuery({
    queryKey: ["assets"],
    queryFn: () => api.listAssets(),
  });

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name,
        kind: form.kind,
        balance: parseFloat(form.balance.replace(/\./g, "")) || 0,
        notes: form.notes,
      };
      return editing
        ? api.updateAsset(editing.id, payload)
        : api.createAsset(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assets"] });
      qc.invalidateQueries({ queryKey: ["summary"] });
      close();
    },
  });

  const del = useMutation({
    mutationFn: (id: string) => api.deleteAsset(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assets"] });
      qc.invalidateQueries({ queryKey: ["summary"] });
    },
  });

  const total = data.reduce((s: number, a: any) => s + (a.balance || 0), 0);

  function open(a: any = null) {
    if (a) {
      setEditing(a);
      setForm({
        name: a.name,
        kind: a.kind,
        balance: String(a.balance).replace(/\B(?=(\d{3})+(?!\d))/g, "."),
        notes: a.notes || "",
      });
    } else {
      setEditing(null);
      setForm({ name: "", kind: "bank", balance: "", notes: "" });
    }
    setShowForm(true);
  }

  function close() {
    setShowForm(false);
    setEditing(null);
    setForm({ name: "", kind: "bank", balance: "", notes: "" });
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceSecondary }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Feather name="arrow-left" size={22} color={colors.onSurface} />
          </Pressable>
          <Text style={styles.title}>Aset Kas Lain</Text>
          <Pressable style={styles.addBtn} onPress={() => open()} testID="add-asset-btn">
            <Feather name="plus" size={18} color="#fff" />
          </Pressable>
        </View>
        <View style={styles.totalBox}>
          <Text style={styles.totalLabel}>Total Aset Kas</Text>
          <Text style={styles.totalValue}>{formatIDR(total)}</Text>
        </View>
      </View>

      <FlatList
        data={data}
        keyExtractor={(a) => a.id}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={
          <Text style={styles.empty}>
            Belum ada aset kas. Tambah rekening, e-wallet, atau piutang Anda.
          </Text>
        }
        renderItem={({ item }) => {
          const kind = ASSET_KINDS.find((k) => k.key === item.kind) || ASSET_KINDS[0];
          return (
            <Pressable style={styles.card} onPress={() => open(item)}>
              <View style={styles.iconBox}>
                <Feather name={kind.icon as any} size={18} color={colors.brand} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.kind}>{kind.label}</Text>
                {!!item.notes && <Text style={styles.notes}>{item.notes}</Text>}
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.balance}>{formatIDR(item.balance)}</Text>
                <Pressable
                  onPress={() =>
                    Alert.alert("Hapus", `Hapus ${item.name}?`, [
                      { text: "Batal", style: "cancel" },
                      {
                        text: "Hapus",
                        style: "destructive",
                        onPress: () => del.mutate(item.id),
                      },
                    ])
                  }
                  hitSlop={10}
                  style={{ marginTop: 6 }}
                >
                  <Feather name="trash-2" size={14} color={colors.error} />
                </Pressable>
              </View>
            </Pressable>
          );
        }}
      />

      <Modal visible={showForm} transparent animationType="slide" onRequestClose={close}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" }}
        >
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>
                {editing ? "Edit Aset" : "Tambah Aset"}
              </Text>
              <Pressable onPress={close} hitSlop={10}>
                <Feather name="x" size={22} color={colors.onSurface} />
              </Pressable>
            </View>

            <Text style={styles.label}>Jenis Aset</Text>
            <View style={styles.kindGrid}>
              {ASSET_KINDS.map((k) => (
                <Pressable
                  key={k.key}
                  style={[
                    styles.kindChip,
                    form.kind === k.key && {
                      borderColor: colors.brand,
                      backgroundColor: colors.brandTertiary,
                    },
                  ]}
                  onPress={() => setForm({ ...form, kind: k.key })}
                >
                  <Feather name={k.icon as any} size={14} color={colors.brand} />
                  <Text style={styles.kindText}>{k.label}</Text>
                </Pressable>
              ))}
            </View>

            <TextInput
              placeholder="Nama (misal: BCA Rekening Bisnis)"
              value={form.name}
              onChangeText={(v) => setForm({ ...form, name: v })}
              style={styles.input}
              placeholderTextColor={colors.muted}
              testID="asset-name-input"
            />
            <TextInput
              placeholder="Saldo (Rp)"
              value={form.balance}
              onChangeText={(v) => {
                const clean = v.replace(/[^0-9]/g, "");
                setForm({
                  ...form,
                  balance: clean.replace(/\B(?=(\d{3})+(?!\d))/g, "."),
                });
              }}
              keyboardType="number-pad"
              style={styles.input}
              placeholderTextColor={colors.muted}
              testID="asset-balance-input"
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
              testID="save-asset-btn"
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
    paddingBottom: 16,
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
  totalBox: {
    backgroundColor: colors.brandTertiary,
    padding: 12,
    borderRadius: 12,
  },
  totalLabel: { fontSize: 11, color: colors.brand },
  totalValue: { fontSize: 20, fontWeight: "700", color: colors.brand, marginTop: 2 },

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
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  name: { fontSize: 14, fontWeight: "600", color: colors.onSurface },
  kind: { fontSize: 11, color: colors.muted, marginTop: 2 },
  notes: { fontSize: 11, color: colors.muted, marginTop: 2, fontStyle: "italic" },
  balance: { fontSize: 14, fontWeight: "700", color: colors.brand },

  empty: { color: colors.muted, textAlign: "center", padding: 40, fontSize: 12 },

  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  sheetHead: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  sheetTitle: { fontSize: 18, fontWeight: "700", color: colors.onSurface },
  label: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.muted,
    marginTop: 12,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  kindGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  kindChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
  },
  kindText: { fontSize: 12, color: colors.onSurface },
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
