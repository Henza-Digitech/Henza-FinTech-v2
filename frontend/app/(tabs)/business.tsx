import { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  FlatList,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PieChart } from "react-native-gifted-charts";
import Feather from "@react-native-vector-icons/feather";

import { api, formatIDR, shortIDR } from "@/src/api";
import { colors } from "@/src/theme";
import { categoryMeta } from "@/src/categories";

type Tab = "cashflow" | "contacts";

export default function BusinessScreen() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>("cashflow");

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.title}>Bisnis</Text>
        <Text style={styles.sub}>Manajemen Keuangan Perusahaan</Text>
        <View style={styles.segment}>
          <Pressable
            style={[styles.segBtn, tab === "cashflow" && styles.segActive]}
            onPress={() => setTab("cashflow")}
            testID="tab-cashflow"
          >
            <Feather
              name="bar-chart-2"
              size={14}
              color={tab === "cashflow" ? "#fff" : colors.muted}
            />
            <Text style={[styles.segText, tab === "cashflow" && { color: "#fff" }]}>
              Arus Kas
            </Text>
          </Pressable>
          <Pressable
            style={[styles.segBtn, tab === "contacts" && styles.segActive]}
            onPress={() => setTab("contacts")}
            testID="tab-contacts"
          >
            <Feather
              name="users"
              size={14}
              color={tab === "contacts" ? "#fff" : colors.muted}
            />
            <Text style={[styles.segText, tab === "contacts" && { color: "#fff" }]}>
              Kontak
            </Text>
          </Pressable>
        </View>
      </View>

      {tab === "cashflow" ? <CashFlowView /> : <ContactsView />}
    </View>
  );
}

function CashFlowView() {
  const { data } = useQuery({
    queryKey: ["summary", "business"],
    queryFn: () => api.summary("business"),
  });

  const pie = useMemo(() => {
    if (!data?.by_category) return [];
    const entries = Object.entries(data.by_category) as [string, number][];
    return entries.map(([k, v]) => {
      const meta = categoryMeta(k);
      return { value: v, color: meta.color, text: meta.label };
    });
  }, [data]);

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <View style={styles.grid}>
        <StatCard
          label="Pemasukan Bisnis"
          value={data ? shortIDR(data.total_income) : "-"}
          icon="trending-up"
          color={colors.success}
        />
        <StatCard
          label="Pengeluaran Bisnis"
          value={data ? shortIDR(data.total_expense) : "-"}
          icon="trending-down"
          color={colors.error}
        />
        <StatCard
          label="Arus Kas Bersih"
          value={data ? shortIDR(data.net_cash) : "-"}
          icon="dollar-sign"
          color={colors.brand}
        />
        <StatCard
          label="Rasio Pengeluaran"
          value={data ? `${Math.round((data.expense_ratio || 0) * 100)}%` : "-"}
          icon="percent"
          color={colors.warning}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Distribusi Pengeluaran Bisnis</Text>
        {pie.length > 0 ? (
          <View style={{ alignItems: "center", marginTop: 12 }}>
            <PieChart
              data={pie}
              donut
              radius={80}
              innerRadius={50}
              centerLabelComponent={() => (
                <View style={{ alignItems: "center" }}>
                  <Text style={{ fontSize: 10, color: colors.muted }}>Total</Text>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: colors.onSurface }}>
                    {data ? shortIDR(data.total_expense) : "-"}
                  </Text>
                </View>
              )}
            />
            <View style={styles.pieLegend}>
              {pie.map((p) => (
                <View key={p.text} style={styles.legendItem}>
                  <View style={[styles.dot, { backgroundColor: p.color }]} />
                  <Text style={styles.legendText}>
                    {p.text}: {formatIDR(p.value)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <Text style={styles.empty}>Belum ada pengeluaran bisnis.</Text>
        )}
      </View>
    </ScrollView>
  );
}

function ContactsView() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [selected, setSelected] = useState<any | null>(null);
  const [form, setForm] = useState({ name: "", address: "", phone: "", notes: "" });

  const { data = [] } = useQuery({
    queryKey: ["contacts", q],
    queryFn: () => api.listContacts(q),
  });

  const save = useMutation({
    mutationFn: () =>
      editing ? api.updateContact(editing.id, form) : api.createContact(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contacts"] });
      closeForm();
    },
  });

  const del = useMutation({
    mutationFn: (id: string) => api.deleteContact(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contacts"] });
      setSelected(null);
    },
  });

  function openAdd() {
    setEditing(null);
    setForm({ name: "", address: "", phone: "", notes: "" });
    setShowForm(true);
  }

  function openEdit(c: any) {
    setSelected(null);
    setEditing(c);
    setForm({
      name: c.name || "",
      address: c.address || "",
      phone: c.phone || "",
      notes: c.notes || "",
    });
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditing(null);
    setForm({ name: "", address: "", phone: "", notes: "" });
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 16, paddingVertical: 8, flexDirection: "row", gap: 8 }}>
        <View style={styles.searchBox}>
          <Feather name="search" size={16} color={colors.muted} />
          <TextInput
            placeholder="Cari nama, telepon, alamat..."
            value={q}
            onChangeText={setQ}
            style={{ flex: 1, color: colors.onSurface, fontSize: 13 }}
            placeholderTextColor={colors.muted}
            testID="search-contact-input"
          />
        </View>
        <Pressable
          style={styles.addBtn}
          onPress={openAdd}
          testID="add-contact-btn"
        >
          <Feather name="plus" size={18} color="#fff" />
        </Pressable>
      </View>

      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 32 }}
        ListEmptyComponent={
          <Text style={styles.empty}>Belum ada kontak. Tambah untuk mulai.</Text>
        }
        renderItem={({ item }) => (
          <Pressable style={styles.contactRow} onPress={() => setSelected(item)}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {item.name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.contactName}>{item.name}</Text>
              {!!item.phone && (
                <Text style={styles.contactMeta}>{item.phone}</Text>
              )}
              {!!item.address && (
                <Text style={styles.contactMeta} numberOfLines={1}>
                  {item.address}
                </Text>
              )}
            </View>
            <Feather name="chevron-right" size={18} color={colors.muted} />
          </Pressable>
        )}
      />

      {/* Add / Edit modal */}
      <Modal
        visible={showForm}
        transparent
        animationType="slide"
        onRequestClose={closeForm}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" }}
        >
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>
                {editing ? "Edit Kontak" : "Tambah Kontak"}
              </Text>
              <Pressable onPress={closeForm} hitSlop={10}>
                <Feather name="x" size={22} color={colors.onSurface} />
              </Pressable>
            </View>
            <TextInput
              placeholder="Nama"
              value={form.name}
              onChangeText={(v) => setForm({ ...form, name: v })}
              style={styles.input}
              placeholderTextColor={colors.muted}
              testID="contact-name-input"
            />
            <TextInput
              placeholder="Nomor Telepon"
              value={form.phone}
              onChangeText={(v) => setForm({ ...form, phone: v })}
              style={styles.input}
              keyboardType="phone-pad"
              placeholderTextColor={colors.muted}
            />
            <TextInput
              placeholder="Alamat"
              value={form.address}
              onChangeText={(v) => setForm({ ...form, address: v })}
              style={styles.input}
              placeholderTextColor={colors.muted}
            />
            <TextInput
              placeholder="Catatan"
              value={form.notes}
              onChangeText={(v) => setForm({ ...form, notes: v })}
              style={[styles.input, { height: 80, textAlignVertical: "top" }]}
              multiline
              placeholderTextColor={colors.muted}
            />
            <Pressable
              style={[styles.saveBtn, !form.name && { opacity: 0.5 }]}
              disabled={!form.name || save.isPending}
              onPress={() => save.mutate()}
              testID="save-contact-btn"
            >
              <Text style={styles.saveText}>
                {save.isPending ? "Menyimpan..." : "Simpan"}
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Detail modal */}
      <Modal
        visible={!!selected}
        transparent
        animationType="slide"
        onRequestClose={() => setSelected(null)}
      >
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <Pressable style={{ flex: 1 }} onPress={() => setSelected(null)} />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
            {selected && (
              <>
                <View style={styles.sheetHead}>
                  <Text style={styles.sheetTitle}>{selected.name}</Text>
                  <Pressable onPress={() => setSelected(null)} hitSlop={10}>
                    <Feather name="x" size={22} color={colors.onSurface} />
                  </Pressable>
                </View>
                <InfoRow icon="phone" label="Telepon" value={selected.phone || "-"} />
                <InfoRow icon="map-pin" label="Alamat" value={selected.address || "-"} />
                <InfoRow icon="file-text" label="Catatan" value={selected.notes || "-"} />
                <Pressable
                  style={styles.saveBtn}
                  onPress={() => openEdit(selected)}
                  testID="edit-contact-btn"
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Feather name="edit-2" size={14} color="#fff" />
                    <Text style={styles.saveText}>Edit Kontak</Text>
                  </View>
                </Pressable>
                <Pressable
                  style={[styles.saveBtn, { backgroundColor: colors.error, marginTop: 10 }]}
                  onPress={() => {
                    Alert.alert("Hapus", "Hapus kontak ini?", [
                      { text: "Batal", style: "cancel" },
                      {
                        text: "Hapus",
                        style: "destructive",
                        onPress: () => del.mutate(selected.id),
                      },
                    ]);
                  }}
                  testID="delete-contact-btn"
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Feather name="trash-2" size={14} color="#fff" />
                    <Text style={styles.saveText}>Hapus</Text>
                  </View>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: string;
  color: string;
}) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIconBox, { backgroundColor: `${color}18` }]}>
        <Feather name={icon as any} size={16} color={color} />
      </View>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoRow}>
      <Feather name={icon as any} size={16} color={colors.brandPrimary} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 11, color: colors.muted }}>{label}</Text>
        <Text style={{ fontSize: 13, color: colors.onSurface, marginTop: 2 }}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surfaceSecondary },
  header: {
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { fontSize: 22, fontWeight: "700", color: colors.onSurface },
  sub: { fontSize: 12, color: colors.muted, marginTop: 2, marginBottom: 12 },
  segment: {
    flexDirection: "row",
    backgroundColor: colors.surfaceTertiary,
    padding: 4,
    borderRadius: 10,
  },
  segBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 36,
    borderRadius: 8,
  },
  segActive: { backgroundColor: colors.brand },
  segText: { fontSize: 12, fontWeight: "600", color: colors.muted },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  statCard: {
    width: "47.5%",
    backgroundColor: colors.surface,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statIconBox: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  statLabel: { fontSize: 10, color: colors.muted },
  statValue: { fontSize: 16, fontWeight: "700", color: colors.onSurface, marginTop: 2 },
  card: {
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 12,
  },
  cardTitle: { fontSize: 13, fontWeight: "700", color: colors.onSurface },
  pieLegend: { marginTop: 16, gap: 6, alignSelf: "stretch" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 12, color: colors.onSurfaceSecondary },
  empty: { color: colors.muted, textAlign: "center", padding: 24, fontSize: 12 },

  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.surfaceTertiary,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },

  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: colors.brand, fontWeight: "700", fontSize: 15 },
  contactName: { fontSize: 14, fontWeight: "600", color: colors.onSurface },
  contactMeta: { fontSize: 11, color: colors.muted, marginTop: 2 },

  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  sheetHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sheetTitle: { fontSize: 18, fontWeight: "700", color: colors.onSurface },
  input: {
    height: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    color: colors.onSurface,
    fontSize: 13,
    marginTop: 8,
  },
  saveBtn: {
    height: 46,
    backgroundColor: colors.brand,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  saveText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
});
