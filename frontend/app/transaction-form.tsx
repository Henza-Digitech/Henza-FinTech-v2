import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  Image,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Feather from "@react-native-vector-icons/feather";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import DateTimePicker from "@react-native-community/datetimepicker";

import { api } from "@/src/api";
import { colors } from "@/src/theme";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/src/categories";

export default function TransactionForm() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const params = useLocalSearchParams<{
    type?: string;
    id?: string;
    scope?: string;
    category?: string;
    amount?: string;
    description?: string;
    date?: string;
    receipt_photo?: string;
  }>();

  const editingId = params.id || null;

  const [type, setType] = useState<"income" | "expense">(
    (params.type as any) === "income" ? "income" : "expense"
  );
  const [scope, setScope] = useState<"personal" | "business">(
    (params.scope as any) === "business" ? "business" : "personal"
  );
  const [category, setCategory] = useState<string>(
    params.category ||
      ((params.type as any) === "income" ? "pendapatan" : "konsumsi")
  );
  const initialAmount = params.amount
    ? String(parseFloat(params.amount)).replace(/\B(?=(\d{3})+(?!\d))/g, ".")
    : "";
  const [amount, setAmount] = useState(initialAmount);
  const [description, setDescription] = useState(params.description || "");
  const [photo, setPhoto] = useState<string | null>(
    params.receipt_photo || null
  );
  const [date, setDate] = useState<Date>(
    params.date ? new Date(params.date) : new Date()
  );
  const [showPicker, setShowPicker] = useState(false);

  const cats = type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  const save = useMutation({
    mutationFn: () => {
      const body = {
        type,
        scope,
        category,
        amount: parseFloat(amount.replace(/\./g, "").replace(/,/g, ".")) || 0,
        description,
        receipt_photo: photo,
        date: date.toISOString(),
      };
      return editingId
        ? api.updateTransaction(editingId, body)
        : api.createTransaction(body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["summary"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    },
    onError: (e: any) => Alert.alert("Gagal", e.message || "Terjadi kesalahan"),
  });

  const pickImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.4,
      base64: true,
    });
    if (!res.canceled && res.assets[0]) {
      const a = res.assets[0];
      const uri = a.base64 ? `data:image/jpeg;base64,${a.base64}` : a.uri;
      setPhoto(uri);
    }
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Izin ditolak", "Aplikasi memerlukan akses kamera.");
      return;
    }
    const res = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.4,
      base64: true,
    });
    if (!res.canceled && res.assets[0]) {
      const a = res.assets[0];
      const uri = a.base64 ? `data:image/jpeg;base64,${a.base64}` : a.uri;
      setPhoto(uri);
    }
  };

  const canSave = amount.length > 0 && parseFloat(amount.replace(/\./g, "")) > 0;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.surface }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Feather name="arrow-left" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>{editingId ? "Edit Transaksi" : "Tambah Transaksi"}</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Type toggle */}
        <View style={styles.segment}>
          <Pressable
            style={[
              styles.segmentBtn,
              type === "expense" && { backgroundColor: colors.error },
            ]}
            onPress={() => {
              setType("expense");
              setCategory("konsumsi");
            }}
            testID="type-expense"
          >
            <Text
              style={[
                styles.segmentText,
                type === "expense" && { color: "#fff" },
              ]}
            >
              Pengeluaran
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.segmentBtn,
              type === "income" && { backgroundColor: colors.success },
            ]}
            onPress={() => {
              setType("income");
              setCategory("pendapatan");
            }}
            testID="type-income"
          >
            <Text
              style={[
                styles.segmentText,
                type === "income" && { color: "#fff" },
              ]}
            >
              Pemasukan
            </Text>
          </Pressable>
        </View>

        {/* Scope */}
        <Text style={styles.label}>Sumber Dana</Text>
        <View style={styles.segment}>
          <Pressable
            style={[
              styles.segmentBtn,
              scope === "personal" && { backgroundColor: colors.brand },
            ]}
            onPress={() => setScope("personal")}
          >
            <Text
              style={[styles.segmentText, scope === "personal" && { color: "#fff" }]}
            >
              Pribadi
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.segmentBtn,
              scope === "business" && { backgroundColor: colors.brand },
            ]}
            onPress={() => setScope("business")}
          >
            <Text
              style={[styles.segmentText, scope === "business" && { color: "#fff" }]}
            >
              Bisnis
            </Text>
          </Pressable>
        </View>

        {/* Amount */}
        <Text style={styles.label}>Jumlah (Rp)</Text>
        <TextInput
          value={amount}
          onChangeText={(v) => {
            const clean = v.replace(/[^0-9]/g, "");
            const withDots = clean.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
            setAmount(withDots);
          }}
          keyboardType="number-pad"
          placeholder="0"
          placeholderTextColor={colors.muted}
          style={styles.amountInput}
          testID="amount-input"
        />

        {/* Description */}
        <Text style={styles.label}>Deskripsi</Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Contoh: Belanja bulanan"
          placeholderTextColor={colors.muted}
          style={styles.input}
          testID="description-input"
        />

        {/* Date */}
        <Text style={styles.label}>Tanggal Transaksi</Text>
        <Pressable
          style={styles.dateBtn}
          onPress={() => setShowPicker(true)}
          testID="date-picker-btn"
        >
          <Feather name="calendar" size={16} color={colors.brand} />
          <Text style={styles.dateText}>
            {date.toLocaleDateString("id-ID", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </Text>
          <Feather name="chevron-down" size={16} color={colors.muted} />
        </Pressable>

        {showPicker && Platform.OS === "android" && (
          <DateTimePicker
            value={date}
            mode="date"
            maximumDate={new Date()}
            onChange={(_, d) => {
              setShowPicker(false);
              if (d) setDate(d);
            }}
          />
        )}
        {showPicker && Platform.OS === "ios" && (
          <Modal transparent animationType="fade" onRequestClose={() => setShowPicker(false)}>
            <Pressable
              style={styles.pickerBackdrop}
              onPress={() => setShowPicker(false)}
            />
            <View style={[styles.pickerSheet, { paddingBottom: insets.bottom + 12 }]}>
              <View style={styles.pickerHeader}>
                <Text style={styles.pickerTitle}>Pilih Tanggal</Text>
                <Pressable onPress={() => setShowPicker(false)}>
                  <Text style={styles.pickerDone}>Selesai</Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={date}
                mode="date"
                display="spinner"
                maximumDate={new Date()}
                onChange={(_, d) => {
                  if (d) setDate(d);
                }}
              />
            </View>
          </Modal>
        )}
        {showPicker && Platform.OS === "web" && (
          <View style={{ marginTop: 8 }}>
            <input
              type="date"
              value={date.toISOString().slice(0, 10)}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e: any) => {
                const v = e.target.value;
                if (v) setDate(new Date(v));
                setShowPicker(false);
              }}
              style={{
                padding: 10,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: colors.border,
                fontSize: 14,
              } as any}
            />
          </View>
        )}

        {/* Category */}
        <Text style={styles.label}>Kategori</Text>
        <View style={styles.catGrid}>
          {cats.map((c) => (
            <Pressable
              key={c.key}
              style={[
                styles.catItem,
                category === c.key && {
                  borderColor: c.color,
                  backgroundColor: `${c.color}12`,
                },
              ]}
              onPress={() => setCategory(c.key)}
            >
              <View
                style={[styles.catIcon, { backgroundColor: `${c.color}22` }]}
              >
                <Feather name={c.icon as any} size={16} color={c.color} />
              </View>
              <Text style={styles.catLabel}>{c.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* Receipt photo */}
        {type === "expense" && (
          <>
            <Text style={styles.label}>Bukti Pembayaran (Opsional)</Text>
            {photo ? (
              <View>
                <Image source={{ uri: photo }} style={styles.preview} />
                <Pressable
                  style={styles.removePhoto}
                  onPress={() => setPhoto(null)}
                >
                  <Feather name="x" size={14} color="#fff" />
                </Pressable>
              </View>
            ) : (
              <View style={{ flexDirection: "row", gap: 10 }}>
                <Pressable style={styles.photoBtn} onPress={takePhoto} testID="take-photo">
                  <Feather name="camera" size={18} color={colors.brandPrimary} />
                  <Text style={styles.photoBtnText}>Ambil Foto</Text>
                </Pressable>
                <Pressable style={styles.photoBtn} onPress={pickImage} testID="pick-photo">
                  <Feather name="image" size={18} color={colors.brandPrimary} />
                  <Text style={styles.photoBtnText}>Galeri</Text>
                </Pressable>
              </View>
            )}
          </>
        )}
      </ScrollView>

      <View
        style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}
      >
        <Pressable
          style={[styles.saveBtn, !canSave && { opacity: 0.5 }]}
          disabled={!canSave || save.isPending}
          onPress={() => save.mutate()}
          testID="save-tx-btn"
        >
          <Text style={styles.saveText}>
            {save.isPending ? "Menyimpan..." : "Simpan Transaksi"}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { fontSize: 16, fontWeight: "700", color: colors.onSurface },
  segment: {
    flexDirection: "row",
    backgroundColor: colors.surfaceTertiary,
    borderRadius: 10,
    padding: 4,
    marginTop: 6,
  },
  segmentBtn: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentText: { fontSize: 13, fontWeight: "600", color: colors.onSurfaceSecondary },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.muted,
    marginTop: 20,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
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
  amountInput: {
    height: 60,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    color: colors.onSurface,
    fontSize: 24,
    fontWeight: "700",
    backgroundColor: colors.surface,
  },
  catGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  catItem: {
    width: "31%",
    padding: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: "center",
    gap: 6,
  },
  catIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  catLabel: { fontSize: 11, color: colors.onSurface, textAlign: "center" },
  photoBtn: {
    flex: 1,
    height: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1.5,
    borderColor: colors.brandPrimary,
    borderStyle: "dashed",
    borderRadius: 10,
  },
  photoBtnText: { color: colors.brandPrimary, fontWeight: "600", fontSize: 13 },
  preview: { width: "100%", height: 200, borderRadius: 12, resizeMode: "cover" },
  removePhoto: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  saveBtn: {
    height: 50,
    backgroundColor: colors.brand,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  saveText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  dateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: 46,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.surface,
  },
  dateText: { flex: 1, color: colors.onSurface, fontSize: 13, fontWeight: "500" },
  pickerBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  pickerSheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  pickerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pickerTitle: { fontSize: 15, fontWeight: "700", color: colors.onSurface },
  pickerDone: { fontSize: 14, fontWeight: "700", color: colors.brand },
});
