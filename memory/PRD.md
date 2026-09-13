# HENZA FINTECH - Product Requirements Document

## Overview
Personal + business finance tracker for Indonesian users. Currency: IDR (Rupiah). Language: Bahasa Indonesia.
Single-user (no auth). (Renamed from "HENZA DIGITECH" → "HENZA FINTECH" on 2026-09-13.)

## Core Features
1. **Beranda (Home Dashboard)**
   - Total Kekayaan Bersih (net wealth = income - expense + other cash assets)
   - Rasio Pengeluaran (expense ratio) with visual bar
   - Quick actions: Pemasukan, Pengeluaran, Aset, Tagihan
   - AI Tips Hemat (via Emergent LLM key, openai gpt-5.4-mini) - Indonesian saving tips based on user patterns
   - Arus Kas 6 Bulan bar chart (income vs expense)
   - Upcoming bills alert
   - Recent transactions

2. **Transaksi**
   - Excel-style dense list (alt row backgrounds, tight vertical padding, right-aligned amounts)
   - Filters: type (all/income/expense), scope (all/personal/business), category chips (Konsumsi, Transportasi, Gaji Karyawan, Kesehatan, Hiburan, Cicilan, Transfer Keluarga, Operasional, Lainnya)
   - Search by description
   - Add via /transaction-form (amount, description, category, scope, photo receipt via camera/gallery)
   - Row tap → bottom sheet with details + receipt photo + delete

3. **Bisnis**
   - Segmented: Arus Kas / Kontak
   - Arus Kas: 4 stat cards (pemasukan, pengeluaran, arus kas bersih, rasio) filtered by scope=business; expense distribution donut chart
   - Kontak: searchable directory (Nama, Alamat, Telepon, Catatan) with add/edit/delete

4. **Lainnya (More)**
   - Aset Kas Lain (bank accounts, e-wallet, receivables, cash, company): full CRUD, balance accumulated into total wealth
   - Tagihan Rutin: recurring bills with due_day, in-app reminders (upcoming <=7 days badge on More menu + Home card)
   - **Jadwal Transfer (Transfer Schedule)** [added 2026-09-13]: plan money transfers to someone. Fields: Nama, Jumlah, Tanggal, No. rekening/bank, Catatan. Drag rows up/down to reorder (react-native-draglist) + "Urutkan tanggal terdekat" button (not-done first, earliest date). Mark "Selesai" toggle keeps item as history. Badge on More menu + summary strip when a transfer is <=3 days away. Persisted via /api/schedules (order field) + /api/schedules/reorder. Included in backup export/import.

## Backend Endpoints (all prefixed /api)
- CRUD: /transactions, /assets, /bills, /contacts, /schedules
- POST /schedules/reorder {ids:[...]} — persist manual drag order
- GET /summary?scope=business
- GET /bills/upcoming?days=7
- POST /ai/tips (uses EMERGENT_LLM_KEY)
- GET /export, POST /import (now include schedules)

## Tech Stack
- Frontend: Expo Router (tabs), react-native-gifted-charts, expo-image-picker, expo-haptics, @react-native-vector-icons/feather
- Backend: FastAPI + MongoDB (Motor)
- AI: emergentintegrations LlmChat with openai/gpt-5.4-mini

## Design
- Brand: HENZA DIGITECH — navy #1a3a5c + teal #1f8a9e
- Currency format: "Rp 1.500.000" (Indonesian locale)
- Photos stored as base64 in MongoDB (local device only per user preference; low quality 0.4)
