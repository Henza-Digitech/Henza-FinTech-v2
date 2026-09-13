import { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  ScrollView,
  Image,
  Modal,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Feather from "@react-native-vector-icons/feather";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { api, formatIDR } from "@/src/api";
import { colors } from "@/src/theme";
import { EXPENSE_CATEGORIES, categoryMeta } from "@/src/categories";
import { CategoryIcon } from "@/src/components/CategoryIcon";

type Filter = "all" | "income" | "expense";
type Scope = "all" | "personal" | "business";
type Sort =
  | "date_desc"
  | "date_asc"
  | "amount_desc"
  | "amount_asc"
  | "category_asc";

const SORT_OPTIONS: { key: Sort; label: string; icon: string }[] = [
  { key: "date_desc", label: "Terbaru", icon: "arrow-down" },
  { key: "date_asc", label: "Terlama", icon: "arrow-up" },
  { key: "amount_desc", label: "Jumlah Terbesar", icon: "chevrons-down" },
  { key: "amount_asc", label: "Jumlah Terkecil", icon: "chevrons-up" },
  { key: "category_asc", label: "Kategori (A-Z)", icon: "align-left" },
];

export default function TransactionsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>("all");
  const [scope, setScope] = useState<Scope>("all");
  const [category, setCategory] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("date_desc");
  const [showSort, setShowSort] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);

  const { data = [], refetch } = useQuery({
    queryKey: ["transactions", filter, scope, category, q, sort],
    queryFn: () =>
      api.listTransactions({
        ...(filter !== "all" ? { type: filter } : {}),
        ...(scope !== "all" ? { scope } : {}),
        ...(category ? { category } : {}),
        ...(q ? { q } : {}),
        sort,
      }),
  });

  const del = useMutation({
    mutationFn: (id: string) => api.deleteTransaction(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["summary"] });
      setSelected(null);
    },
  });

  const total = useMemo(() => {
    let inc = 0;
    let exp = 0;
    for (const t of data) {
      if (t.type === "income") inc += t.amount;
      else exp += t.amount;
    }
    return { inc, exp };
  }, [data]);

  return (
    <View style={styles.container}>
      {/* Sticky header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>Transaksi</Text>
          <Pressable
            style={styles.addBtn}
            onPress={() => {
              Haptics.selectionAsync();
              router.push("/transaction-form");
            }}
            testID="add-transaction-btn"
          >
            <Feather name="plus" size={18} color="#fff" />
          </Pressable>
        </View>

        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Feather name="search" size={16} color={colors.muted} />
            <TextInput
              placeholder="Cari deskripsi..."
              value={q}
              onChangeText={setQ}
              style={styles.searchInput}
              placeholderTextColor={colors.muted}
              testID="search-tx-input"
            />
          </View>
          <Pressable
            style={styles.sortBtn}
            onPress={() => setShowSort(true)}
            testID="sort-btn"
          >
            <Feather name="sliders" size={16} color={colors.brand} />
            <Text style={styles.sortBtnText} numberOfLines={1}>
              {SORT_OPTIONS.find((s) => s.key === sort)?.label}
            </Text>
          </Pressable>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryPill}>
            <Text style={styles.summaryLabel}>Masuk</Text>
            <Text style={[styles.summaryVal, { color: colors.success }]}>
              {formatIDR(total.inc)}
            </Text>
          </View>
          <View style={styles.summaryPill}>
            <Text style={styles.summaryLabel}>Keluar</Text>
            <Text style={[styles.summaryVal, { color: colors.error }]}>
              {formatIDR(total.exp)}
            </Text>
          </View>
        </View>

        {/* Chips row 1 */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
        >
          {(["all", "income", "expense"] as const).map((f) => (
            <Chip
              key={f}
              label={f === "all" ? "Semua" : f === "income" ? "Masuk" : "Keluar"}
              active={filter === f}
              onPress={() => setFilter(f)}
            />
          ))}
          <View style={styles.sep} />
          {(["all", "personal", "business"] as const).map((s) => (
            <Chip
              key={s}
              label={s === "all" ? "Semua Sumber" : s === "personal" ? "Pribadi" : "Bisnis"}
              active={scope === s}
              onPress={() => setScope(s)}
            />
          ))}
        </ScrollView>

        {/* Chips row 2: categories */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
        >
          <Chip
            label="Semua Kategori"
            active={!category}
            onPress={() => setCategory(null)}
          />
          {EXPENSE_CATEGORIES.map((c) => (
            <Chip
              key={c.key}
              label={c.label}
              active={category === c.key}
              onPress={() => setCategory(c.key)}
            />
          ))}
        </ScrollView>

        {/* Excel-style column header */}
        <View style={styles.tableHead}>
          <Text style={[styles.thText, { flex: 0.7 }]}>Tgl</Text>
          <Text style={[styles.thText, { flex: 2.4 }]}>Deskripsi</Text>
          <Text style={[styles.thText, { flex: 1.2, textAlign: "right" }]}>
            Jumlah
          </Text>
        </View>
      </View>

      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 32 }}
        ListEmptyComponent={
          <Text style={styles.emptyText}>Belum ada transaksi.</Text>
        }
        renderItem={({ item, index }) => {
          const meta = categoryMeta(item.category);
          const d = new Date(item.date || item.created_at);
          const day = `${d.getDate()}/${d.getMonth() + 1}`;
          return (
            <Pressable
              style={[
                styles.row,
                { backgroundColor: index % 2 === 0 ? colors.surface : colors.surfaceSecondary },
              ]}
              onPress={() => setSelected(item)}
              testID={`tx-row-${item.id}`}
            >
              <Text style={[styles.cell, { flex: 0.7, color: colors.muted, fontSize: 11 }]}>
                {day}
              </Text>
              <View style={{ flex: 2.4, flexDirection: "row", alignItems: "center", gap: 8 }}>
                <CategoryIcon name={meta.icon} color={meta.color} size={13} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.desc} numberOfLines={1}>
                    {item.description || meta.label}
                  </Text>
                  <Text style={styles.metaText}>
                    {meta.label} • {item.scope === "business" ? "Bisnis" : "Pribadi"}
                  </Text>
                </View>
              </View>
              <Text
                style={[
                  styles.amount,
                  { flex: 1.2, color: item.type === "income" ? colors.success : colors.error },
                ]}
              >
                {item.type === "income" ? "+" : "-"}
                {formatIDR(item.amount).replace("Rp ", "")}
              </Text>
            </Pressable>
          );
        }}
      />

      {/* Sort sheet */}
      <Modal
        visible={showSort}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSort(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowSort(false)}
        >
          <View
            style={[styles.sortSheet, { paddingBottom: insets.bottom + 20 }]}
            onStartShouldSetResponder={() => true}
          >
            <Text style={styles.sortTitle}>Urutkan Berdasarkan</Text>
            {SORT_OPTIONS.map((opt) => {
              const active = sort === opt.key;
              return (
                <Pressable
                  key={opt.key}
                  style={[styles.sortRow, active && styles.sortRowActive]}
                  onPress={() => {
                    setSort(opt.key);
                    setShowSort(false);
                  }}
                  testID={`sort-${opt.key}`}
                >
                  <Feather
                    name={opt.icon as any}
                    size={16}
                    color={active ? colors.brand : colors.muted}
                  />
                  <Text
                    style={[
                      styles.sortLabel,
                      active && { color: colors.brand, fontWeight: "700" },
                    ]}
                  >
                    {opt.label}
                  </Text>
                  {active && (
                    <Feather
                      name="check"
                      size={16}
                      color={colors.brand}
                      style={{ marginLeft: "auto" }}
                    />
                  )}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>

      {/* Detail modal */}
      <Modal
        visible={!!selected}
        transparent
        animationType="slide"
        onRequestClose={() => setSelected(null)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={{ flex: 1 }} onPress={() => setSelected(null)} />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
            {selected && (
              <>
                <View style={styles.sheetHead}>
                  <Text style={styles.sheetTitle}>Detail Transaksi</Text>
                  <Pressable onPress={() => setSelected(null)} hitSlop={10}>
                    <Feather name="x" size={22} color={colors.onSurface} />
                  </Pressable>
                </View>
                <DetailRow label="Deskripsi" value={selected.description || "-"} />
                <DetailRow label="Kategori" value={categoryMeta(selected.category).label} />
                <DetailRow
                  label="Sumber"
                  value={selected.scope === "business" ? "Bisnis" : "Pribadi"}
                />
                <DetailRow
                  label="Tipe"
                  value={selected.type === "income" ? "Pemasukan" : "Pengeluaran"}
                />
                <DetailRow
                  label="Jumlah"
                  value={formatIDR(selected.amount)}
                  bold
                  color={selected.type === "income" ? colors.success : colors.error}
                />
                <DetailRow
                  label="Tanggal"
                  value={new Date(selected.date).toLocaleDateString("id-ID")}
                />
                {selected.receipt_photo && (
                  <View style={{ marginTop: 12 }}>
                    <Text style={styles.detailLabel}>Bukti Pembayaran</Text>
                    <Image
                      source={{ uri: selected.receipt_photo }}
                      style={styles.receipt}
                    />
                  </View>
                )}
                <Pressable
                  style={styles.editBtn}
                  onPress={() => {
                    const t = selected;
                    setSelected(null);
                    router.push({
                      pathname: "/transaction-form",
                      params: {
                        id: t.id,
                        type: t.type,
                        scope: t.scope,
                        category: t.category,
                        amount: String(t.amount),
                        description: t.description || "",
                        date: t.date,
                        receipt_photo: t.receipt_photo || "",
                      },
                    });
                  }}
                  testID="edit-tx-btn"
                >
                  <Feather name="edit-2" size={16} color="#fff" />
                  <Text style={styles.editText}>Edit Transaksi</Text>
                </Pressable>
                <Pressable
                  style={styles.deleteBtn}
                  onPress={() => {
                    Alert.alert("Hapus", "Yakin ingin menghapus transaksi ini?", [
                      { text: "Batal", style: "cancel" },
                      {
                        text: "Hapus",
                        style: "destructive",
                        onPress: () => del.mutate(selected.id),
                      },
                    ]);
                  }}
                  testID="delete-tx-btn"
                >
                  <Feather name="trash-2" size={16} color="#fff" />
                  <Text style={styles.deleteText}>Hapus Transaksi</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[
        styles.chip,
        active && { backgroundColor: colors.brand, borderColor: colors.brand },
      ]}
      onPress={onPress}
    >
      <Text
        style={[
          styles.chipText,
          active && { color: "#fff" },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function DetailRow({
  label,
  value,
  bold,
  color,
}: {
  label: string;
  value: string;
  bold?: boolean;
  color?: string;
}) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text
        style={[
          styles.detailValue,
          bold && { fontWeight: "700" },
          color && { color },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  title: { fontSize: 22, fontWeight: "700", color: colors.onSurface },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  searchRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceTertiary,
    paddingHorizontal: 12,
    borderRadius: 10,
    height: 40,
    gap: 8,
  },
  sortBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 40,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: colors.brandTertiary,
    maxWidth: 130,
  },
  sortBtnText: { fontSize: 11, color: colors.brand, fontWeight: "600" },
  searchInput: { flex: 1, color: colors.onSurface, fontSize: 13 },

  sortSheet: {
    marginTop: "auto",
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 30,
  },
  sortTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.onSurface,
    marginBottom: 12,
  },
  sortRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  sortRowActive: { backgroundColor: colors.brandTertiary },
  sortLabel: { fontSize: 14, color: colors.onSurface },

  summaryRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  summaryPill: {
    flex: 1,
    backgroundColor: colors.surfaceSecondary,
    padding: 10,
    borderRadius: 10,
  },
  summaryLabel: { fontSize: 10, color: colors.muted },
  summaryVal: { fontSize: 13, fontWeight: "700", marginTop: 2 },

  chipsRow: {
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 2,
    alignItems: "center",
  },
  chip: {
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: "center",
    backgroundColor: colors.surface,
    flexShrink: 0,
  },
  chipText: { fontSize: 12, color: colors.onSurfaceSecondary, fontWeight: "500" },
  sep: { width: 1, height: 20, backgroundColor: colors.border, marginHorizontal: 4 },

  tableHead: {
    flexDirection: "row",
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
    paddingHorizontal: 12,
    marginTop: 4,
  },
  thText: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  cell: { fontSize: 12 },
  desc: { fontSize: 13, fontWeight: "600", color: colors.onSurface },
  metaText: { fontSize: 10, color: colors.muted, marginTop: 1 },
  amount: { fontSize: 13, fontWeight: "700", textAlign: "right" },

  emptyText: { textAlign: "center", padding: 40, color: colors.muted },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
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
    marginBottom: 16,
  },
  sheetTitle: { fontSize: 18, fontWeight: "700", color: colors.onSurface },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  detailLabel: { fontSize: 12, color: colors.muted },
  detailValue: {
    fontSize: 13,
    color: colors.onSurface,
    fontWeight: "600",
    maxWidth: "60%",
    textAlign: "right",
  },
  receipt: {
    width: "100%",
    height: 220,
    borderRadius: 12,
    marginTop: 8,
    resizeMode: "cover",
  },
  deleteBtn: {
    marginTop: 10,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.error,
    paddingVertical: 12,
    borderRadius: 12,
  },
  deleteText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  editBtn: {
    marginTop: 16,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.brand,
    paddingVertical: 12,
    borderRadius: 12,
  },
  editText: { color: "#fff", fontWeight: "700", fontSize: 13 },
});
