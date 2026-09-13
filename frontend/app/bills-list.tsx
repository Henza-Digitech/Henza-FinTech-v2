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

export default function BillsList() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({
    name: "",
    amount: "",
    due_day: "1",
    notes: "",
  });

  const bills = useQuery({ queryKey: ["bills"], queryFn: () => api.listBills() });
  const upcoming = useQuery({
    queryKey: ["upcoming", 31],
    queryFn: () => api.upcomingBills(31),
  });

  const upcomingMap: Record<string, number> = {};
  (upcoming.data || []).forEach((u: any) => {
    upcomingMap[u.id] = u.days_left;
  });

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name,
        amount: parseFloat(form.amount.replace(/\./g, "")) || 0,
        due_day: parseInt(form.due_day) || 1,
        notes: form.notes,
        category: "lainnya",
        active: true,
      };
      return editing ? api.updateBill(editing.id, payload) : api.createBill(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bills"] });
      qc.invalidateQueries({ queryKey: ["upcoming"] });
      close();
    },
  });

  const del = useMutation({
    mutationFn: (id: string) => api.deleteBill(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bills"] });
      qc.invalidateQueries({ queryKey: ["upcoming"] });
    },
  });

  function open(b: any = null) {
    if (b) {
      setEditing(b);
      setForm({
        name: b.name,
        amount: String(b.amount).replace(/\B(?=(\d{3})+(?!\d))/g, "."),
        due_day: String(b.due_day),
        notes: b.notes || "",
      });
    } else {
      setEditing(null);
      setForm({ name: "", amount: "", due_day: "1", notes: "" });
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
          <Text style={styles.title}>Tagihan Rutin</Text>
          <Pressable style={styles.addBtn} onPress={() => open()} testID="add-bill-btn">
            <Feather name="plus" size={18} color="#fff" />
          </Pressable>
        </View>
        <Text style={styles.sub}>Pengingat otomatis mendekati tanggal jatuh tempo</Text>
      </View>

      <FlatList
        data={bills.data || []}
        keyExtractor={(b) => b.id}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={
          <Text style={styles.empty}>
            Belum ada tagihan. Tambah tagihan berulang seperti sewa, listrik, cicilan.
          </Text>
        }
        renderItem={({ item }) => {
          const daysLeft = upcomingMap[item.id];
          const urgent = daysLeft !== undefined && daysLeft <= 7;
          return (
            <Pressable style={styles.card} onPress={() => open(item)}>
              <View
                style={[
                  styles.iconBox,
                  urgent && { backgroundColor: `${colors.warning}22` },
                ]}
              >
                <Feather
                  name="calendar"
                  size={18}
                  color={urgent ? colors.warning : colors.brand}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.meta}>
                  Setiap tanggal {item.due_day}
                  {daysLeft !== undefined &&
                    ` • ${
                      daysLeft === 0
                        ? "Jatuh tempo hari ini!"
                        : `${daysLeft} hari lagi`
                    }`}
                </Text>
                {!!item.notes && <Text style={styles.notes}>{item.notes}</Text>}
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={[styles.amount, urgent && { color: colors.warning }]}>
                  {formatIDR(item.amount)}
                </Text>
                <Pressable
                  onPress={() =>
                    Alert.alert("Hapus", `Hapus tagihan ${item.name}?`, [
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
                {editing ? "Edit Tagihan" : "Tambah Tagihan"}
              </Text>
              <Pressable onPress={close} hitSlop={10}>
                <Feather name="x" size={22} color={colors.onSurface} />
              </Pressable>
            </View>
            <TextInput
              placeholder="Nama (misal: Listrik PLN)"
              value={form.name}
              onChangeText={(v) => setForm({ ...form, name: v })}
              style={styles.input}
              placeholderTextColor={colors.muted}
              testID="bill-name-input"
            />
            <TextInput
              placeholder="Jumlah (Rp)"
              value={form.amount}
              onChangeText={(v) => {
                const clean = v.replace(/[^0-9]/g, "");
                setForm({
                  ...form,
                  amount: clean.replace(/\B(?=(\d{3})+(?!\d))/g, "."),
                });
              }}
              keyboardType="number-pad"
              style={styles.input}
              placeholderTextColor={colors.muted}
              testID="bill-amount-input"
            />
            <TextInput
              placeholder="Tanggal Jatuh Tempo (1-28)"
              value={form.due_day}
              onChangeText={(v) => {
                const num = parseInt(v.replace(/[^0-9]/g, "")) || 0;
                setForm({ ...form, due_day: String(Math.min(28, Math.max(0, num))) });
              }}
              keyboardType="number-pad"
              style={styles.input}
              placeholderTextColor={colors.muted}
              testID="bill-day-input"
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
              testID="save-bill-btn"
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
    marginBottom: 8,
  },
  title: { fontSize: 18, fontWeight: "700", color: colors.onSurface },
  sub: { fontSize: 11, color: colors.muted },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },

  card: {
    flexDirection: "row",
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
  meta: { fontSize: 11, color: colors.muted, marginTop: 2 },
  notes: { fontSize: 11, color: colors.muted, marginTop: 2, fontStyle: "italic" },
  amount: { fontSize: 14, fontWeight: "700", color: colors.brand },
  empty: { color: colors.muted, textAlign: "center", padding: 40, fontSize: 12 },

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
