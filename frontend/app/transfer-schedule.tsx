import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Feather from "@react-native-vector-icons/feather";
import { useRouter } from "expo-router";
import DateTimePicker from "@react-native-community/datetimepicker";
import DragList from "react-native-draglist";

import { api, formatIDR } from "@/src/api";
import { colors } from "@/src/theme";

type Sched = {
  id: string;
  name: string;
  amount: number;
  date: string;
  account: string;
  notes: string;
  done: boolean;
  order?: number;
  days_left?: number | null;
};

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("id-ID", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function groupSep(v: string) {
  return v.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export default function TransferSchedule() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();

  const [items, setItems] = useState<Sched[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [editing, setEditing] = useState<Sched | null>(null);
  const [form, setForm] = useState({
    name: "",
    amount: "",
    account: "",
    notes: "",
    date: new Date(),
  });

  const schedules = useQuery<Sched[]>({
    queryKey: ["schedules"],
    queryFn: () => api.listSchedules(),
  });

  // keep local drag order in sync with server data
  useEffect(() => {
    if (schedules.data) setItems(schedules.data);
  }, [schedules.data]);

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name.trim(),
        amount: parseFloat(form.amount.replace(/\./g, "")) || 0,
        account: form.account.trim(),
        notes: form.notes.trim(),
        date: form.date.toISOString(),
        done: editing ? editing.done : false,
      };
      return editing
        ? api.updateSchedule(editing.id, payload)
        : api.createSchedule(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["schedules"] });
      close();
    },
  });

  const toggleDone = useMutation({
    mutationFn: (s: Sched) =>
      api.updateSchedule(s.id, {
        name: s.name,
        amount: s.amount,
        account: s.account,
        notes: s.notes,
        date: s.date,
        done: !s.done,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["schedules"] }),
  });

  const del = useMutation({
    mutationFn: (id: string) => api.deleteSchedule(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["schedules"] }),
  });

  const reorder = useMutation({
    mutationFn: (ids: string[]) => api.reorderSchedules(ids),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["schedules"] }),
  });

  const pendingTotal = useMemo(
    () => items.filter((s) => !s.done).reduce((sum, s) => sum + (s.amount || 0), 0),
    [items]
  );
  const soonCount = useMemo(
    () =>
      items.filter(
        (s) => !s.done && s.days_left != null && s.days_left <= 3
      ).length,
    [items]
  );

  function open(s: Sched | null = null) {
    if (s) {
      setEditing(s);
      setForm({
        name: s.name,
        amount: groupSep(String(Math.round(s.amount))),
        account: s.account || "",
        notes: s.notes || "",
        date: s.date ? new Date(s.date) : new Date(),
      });
    } else {
      setEditing(null);
      setForm({ name: "", amount: "", account: "", notes: "", date: new Date() });
    }
    setShowForm(true);
  }

  function close() {
    setShowForm(false);
    setEditing(null);
    setShowPicker(false);
  }

  async function onReordered(fromIndex: number, toIndex: number) {
    const copy = [...items];
    const [removed] = copy.splice(fromIndex, 1);
    copy.splice(toIndex, 0, removed);
    setItems(copy);
    reorder.mutate(copy.map((s) => s.id));
  }

  function sortByNearest() {
    const copy = [...items].sort((a, b) => {
      // not-done first, then earliest date
      if (a.done !== b.done) return a.done ? 1 : -1;
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });
    setItems(copy);
    reorder.mutate(copy.map((s) => s.id));
  }

  function confirmDelete(s: Sched) {
    if (Platform.OS === "web") {
      // Alert.alert has no buttons on react-native-web
      if (window.confirm(`Hapus transfer ke ${s.name}?`)) del.mutate(s.id);
      return;
    }
    Alert.alert("Hapus Jadwal", `Hapus transfer ke ${s.name}?`, [
      { text: "Batal", style: "cancel" },
      { text: "Hapus", style: "destructive", onPress: () => del.mutate(s.id) },
    ]);
  }

  function keyExtractor(item: Sched) {
    return item.id;
  }

  function renderItem(info: any) {
    const { item, onDragStart, onDragEnd, isActive } = info as {
      item: Sched;
      onDragStart: () => void;
      onDragEnd: () => void;
      isActive: boolean;
    };
    const dl = item.days_left;
    const urgent = !item.done && dl != null && dl <= 3;
    const overdue = !item.done && dl != null && dl < 0;

    let badgeText = "";
    if (item.done) badgeText = "Selesai";
    else if (dl == null) badgeText = fmtDate(item.date);
    else if (dl < 0) badgeText = `Terlewat ${Math.abs(dl)} hari`;
    else if (dl === 0) badgeText = "Hari ini!";
    else badgeText = `${dl} hari lagi`;

    return (
      <View
        style={[
          styles.card,
          isActive && styles.cardActive,
          item.done && styles.cardDone,
        ]}
        testID={`schedule-card-${item.id}`}
      >
        {/* Drag handle */}
        <Pressable
          onPressIn={onDragStart}
          onPressOut={onDragEnd}
          hitSlop={10}
          style={styles.handle}
          testID={`schedule-drag-${item.id}`}
        >
          <Feather name="menu" size={18} color={colors.muted} />
        </Pressable>

        {/* Done toggle */}
        <Pressable
          onPress={() => toggleDone.mutate(item)}
          hitSlop={8}
          style={[styles.check, item.done && styles.checkDone]}
          testID={`schedule-toggle-${item.id}`}
        >
          {item.done && <Feather name="check" size={14} color="#fff" />}
        </Pressable>

        {/* Body -> edit */}
        <Pressable style={{ flex: 1 }} onPress={() => open(item)}>
          <View style={styles.rowTop}>
            <Text
              style={[styles.name, item.done && styles.strike]}
              numberOfLines={1}
            >
              {item.name}
            </Text>
            <Text style={[styles.amount, item.done && styles.amountDone]}>
              {formatIDR(item.amount)}
            </Text>
          </View>
          {!!item.account && (
            <Text style={styles.account} numberOfLines={1}>
              <Feather name="credit-card" size={11} color={colors.muted} />{" "}
              {item.account}
            </Text>
          )}
          {!!item.notes && (
            <Text style={styles.notes} numberOfLines={1}>
              {item.notes}
            </Text>
          )}
          <View style={styles.rowBottom}>
            <View
              style={[
                styles.dateChip,
                urgent && !overdue && styles.dateChipUrgent,
                overdue && styles.dateChipOverdue,
                item.done && styles.dateChipDone,
              ]}
            >
              <Feather
                name={item.done ? "check-circle" : "clock"}
                size={11}
                color={
                  item.done
                    ? colors.success
                    : overdue || urgent
                    ? colors.error
                    : colors.brand
                }
              />
              <Text
                style={[
                  styles.dateChipText,
                  {
                    color: item.done
                      ? colors.success
                      : overdue || urgent
                      ? colors.error
                      : colors.brand,
                  },
                ]}
              >
                {badgeText}
              </Text>
            </View>
            {!item.done && (
              <Text style={styles.dateSmall}>{fmtDate(item.date)}</Text>
            )}
          </View>
        </Pressable>

        {/* Delete */}
        <Pressable
          onPress={() => confirmDelete(item)}
          hitSlop={8}
          style={styles.delBtn}
          testID={`schedule-delete-${item.id}`}
        >
          <Feather name="trash-2" size={15} color={colors.error} />
        </Pressable>
      </View>
    );
  }

  const empty = !schedules.isLoading && items.length === 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceSecondary }}>
      {/* Sticky header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={10} testID="back-btn">
            <Feather name="arrow-left" size={22} color={colors.onSurface} />
          </Pressable>
          <Text style={styles.title}>Jadwal Transfer</Text>
          <Pressable
            style={styles.addBtn}
            onPress={() => open()}
            testID="add-schedule-btn"
          >
            <Feather name="plus" size={18} color="#fff" />
          </Pressable>
        </View>

        {/* Summary strip */}
        <View style={styles.summaryStrip}>
          <View style={{ flex: 1 }}>
            <Text style={styles.summaryLabel}>Belum ditransfer</Text>
            <Text style={styles.summaryValue}>{formatIDR(pendingTotal)}</Text>
          </View>
          {soonCount > 0 && (
            <View style={styles.soonBadge}>
              <Feather name="alert-circle" size={13} color={colors.error} />
              <Text style={styles.soonText}>{soonCount} segera (≤3 hari)</Text>
            </View>
          )}
        </View>

        {/* Sort + hint */}
        <View style={styles.toolRow}>
          <Pressable
            style={styles.sortBtn}
            onPress={sortByNearest}
            testID="sort-nearest-btn"
          >
            <Feather name="arrow-down" size={14} color={colors.brand} />
            <Text style={styles.sortText}>Urutkan tanggal terdekat</Text>
          </Pressable>
          <Text style={styles.hint}>Tahan & geser untuk atur</Text>
        </View>
      </View>

      {schedules.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brand} />
        </View>
      ) : empty ? (
        <View style={styles.center}>
          <Feather name="send" size={40} color={colors.borderStrong} />
          <Text style={styles.emptyTitle}>Belum ada jadwal transfer</Text>
          <Text style={styles.emptySub}>
            Catat rencana transfer ke seseorang beserta tanggalnya, lalu geser
            kartu untuk mengurutkan sesuai prioritas.
          </Text>
          <Pressable style={styles.emptyCta} onPress={() => open()} testID="empty-add-btn">
            <Feather name="plus" size={16} color="#fff" />
            <Text style={styles.emptyCtaText}>Tambah Jadwal</Text>
          </Pressable>
        </View>
      ) : (
        <DragList
          data={items}
          keyExtractor={keyExtractor}
          onReordered={onReordered}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
        />
      )}

      {/* Form modal */}
      <Modal visible={showForm} transparent animationType="slide" onRequestClose={close}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" }}
        >
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>
                {editing ? "Edit Jadwal Transfer" : "Tambah Jadwal Transfer"}
              </Text>
              <Pressable onPress={close} hitSlop={10} testID="close-form-btn">
                <Feather name="x" size={22} color={colors.onSurface} />
              </Pressable>
            </View>

            <Text style={styles.label}>Nama Penerima</Text>
            <TextInput
              placeholder="Misal: Budi Santoso"
              value={form.name}
              onChangeText={(v) => setForm({ ...form, name: v })}
              style={styles.input}
              placeholderTextColor={colors.muted}
              testID="schedule-name-input"
            />

            <Text style={styles.label}>Jumlah (Rp)</Text>
            <TextInput
              placeholder="1.500.000"
              value={form.amount}
              onChangeText={(v) =>
                setForm({ ...form, amount: groupSep(v.replace(/[^0-9]/g, "")) })
              }
              keyboardType="number-pad"
              style={styles.input}
              placeholderTextColor={colors.muted}
              testID="schedule-amount-input"
            />

            <Text style={styles.label}>Tanggal Transfer</Text>
            <Pressable
              style={styles.dateBtn}
              onPress={() => setShowPicker(true)}
              testID="schedule-date-btn"
            >
              <Feather name="calendar" size={16} color={colors.brand} />
              <Text style={styles.dateText}>
                {form.date.toLocaleDateString("id-ID", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </Text>
              <Feather name="chevron-down" size={16} color={colors.muted} />
            </Pressable>

            <Text style={styles.label}>No. Rekening / Bank</Text>
            <TextInput
              placeholder="Misal: BCA 1234567890"
              value={form.account}
              onChangeText={(v) => setForm({ ...form, account: v })}
              style={styles.input}
              placeholderTextColor={colors.muted}
              testID="schedule-account-input"
            />

            <Text style={styles.label}>Catatan (opsional)</Text>
            <TextInput
              placeholder="Misal: DP proyek, cicilan ke-2"
              value={form.notes}
              onChangeText={(v) => setForm({ ...form, notes: v })}
              style={styles.input}
              placeholderTextColor={colors.muted}
              testID="schedule-notes-input"
            />

            <Pressable
              style={[styles.saveBtn, (!form.name.trim() || save.isPending) && { opacity: 0.5 }]}
              disabled={!form.name.trim() || save.isPending}
              onPress={() => save.mutate()}
              testID="save-schedule-btn"
            >
              {save.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveText}>Simpan</Text>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>

        {showPicker && Platform.OS === "android" && (
          <DateTimePicker
            value={form.date}
            mode="date"
            onChange={(_, d) => {
              setShowPicker(false);
              if (d) setForm((f) => ({ ...f, date: d }));
            }}
          />
        )}
        {showPicker && Platform.OS === "ios" && (
          <Modal transparent animationType="fade" onRequestClose={() => setShowPicker(false)}>
            <Pressable style={styles.pickerBackdrop} onPress={() => setShowPicker(false)} />
            <View style={[styles.pickerSheet, { paddingBottom: insets.bottom + 12 }]}>
              <View style={styles.pickerHeader}>
                <Text style={styles.pickerTitle}>Pilih Tanggal</Text>
                <Pressable onPress={() => setShowPicker(false)}>
                  <Text style={styles.pickerDone}>Selesai</Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={form.date}
                mode="date"
                display="spinner"
                onChange={(_, d) => {
                  if (d) setForm((f) => ({ ...f, date: d }));
                }}
              />
            </View>
          </Modal>
        )}
        {showPicker && Platform.OS === "web" && (
          <View style={styles.webPickerWrap}>
            <View style={styles.webPickerCard}>
              <Text style={styles.pickerTitle}>Pilih Tanggal</Text>
              <input
                type="date"
                value={form.date.toISOString().slice(0, 10)}
                onChange={(e: any) => {
                  const v = e.target.value;
                  if (v) setForm((f) => ({ ...f, date: new Date(v) }));
                  setShowPicker(false);
                }}
                style={{
                  padding: 12,
                  borderRadius: 8,
                  border: `1px solid ${colors.border}`,
                  fontSize: 15,
                  marginTop: 12,
                  width: "100%",
                } as any}
              />
              <Pressable
                style={[styles.saveBtn, { marginTop: 12 }]}
                onPress={() => setShowPicker(false)}
              >
                <Text style={styles.saveText}>Tutup</Text>
              </Pressable>
            </View>
          </View>
        )}
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
  summaryStrip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.brandTertiary,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  summaryLabel: { fontSize: 11, color: colors.onBrandTertiary, fontWeight: "600" },
  summaryValue: { fontSize: 18, color: colors.brand, fontWeight: "800", marginTop: 2 },
  soonBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: `${colors.error}18`,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  soonText: { fontSize: 11, color: colors.error, fontWeight: "700" },

  toolRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
  },
  sortBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.brandTertiary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  sortText: { fontSize: 12, color: colors.brand, fontWeight: "700" },
  hint: { fontSize: 10, color: colors.muted, fontStyle: "italic" },

  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.onSurface,
    marginTop: 14,
  },
  emptySub: {
    fontSize: 12,
    color: colors.muted,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 18,
  },
  emptyCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.brand,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 20,
  },
  emptyCtaText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.surface,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
  },
  cardActive: {
    borderColor: colors.brandPrimary,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 6,
    transform: [{ scale: 1.02 }],
  },
  cardDone: { opacity: 0.7, backgroundColor: colors.surfaceTertiary },
  handle: { paddingVertical: 4, paddingRight: 2 },
  check: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  checkDone: { backgroundColor: colors.success, borderColor: colors.success },

  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  name: { fontSize: 14, fontWeight: "700", color: colors.onSurface, flex: 1 },
  strike: { textDecorationLine: "line-through", color: colors.muted },
  amount: { fontSize: 14, fontWeight: "800", color: colors.brand },
  amountDone: { color: colors.muted },
  account: { fontSize: 11, color: colors.muted, marginTop: 3 },
  notes: { fontSize: 11, color: colors.muted, marginTop: 2, fontStyle: "italic" },
  rowBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  dateChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.brandTertiary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  dateChipUrgent: { backgroundColor: `${colors.error}18` },
  dateChipOverdue: { backgroundColor: `${colors.error}22` },
  dateChipDone: { backgroundColor: `${colors.success}18` },
  dateChipText: { fontSize: 11, fontWeight: "700" },
  dateSmall: { fontSize: 10, color: colors.muted },
  delBtn: { padding: 4 },

  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  sheetHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  sheetTitle: { fontSize: 18, fontWeight: "700", color: colors.onSurface },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.onSurfaceSecondary,
    marginTop: 14,
    marginBottom: 6,
  },
  input: {
    height: 46,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    color: colors.onSurface,
    fontSize: 14,
    backgroundColor: colors.surface,
  },
  dateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: 46,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  dateText: { flex: 1, fontSize: 14, color: colors.onSurface },
  saveBtn: {
    height: 50,
    backgroundColor: colors.brand,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },
  saveText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  pickerBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  pickerSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  pickerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
  },
  pickerTitle: { fontSize: 15, fontWeight: "700", color: colors.onSurface },
  pickerDone: { fontSize: 15, fontWeight: "700", color: colors.brandPrimary },
  webPickerWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: 24,
  },
  webPickerCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    width: "100%",
    maxWidth: 360,
  },
});
