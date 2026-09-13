import { useMemo } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";

const light = {
  surface: "#ffffff",
  onSurface: "#111827",
  surfaceSecondary: "#f8fafc",
  onSurfaceSecondary: "#334155",
  surfaceTertiary: "#f1f5f9",
  onSurfaceTertiary: "#475569",
  surfaceInverse: "#0f172a",
  onSurfaceInverse: "#ffffff",

  brand: "#1a3a5c",
  onBrand: "#ffffff",
  brandPrimary: "#1f8a9e",
  onBrandPrimary: "#ffffff",
  brandSecondary: "#1a3a5c",
  onBrandSecondary: "#ffffff",
  brandTertiary: "#e6f2f5",
  onBrandTertiary: "#1f8a9e",

  success: "#10b981",
  onSuccess: "#ffffff",
  warning: "#f59e0b",
  onWarning: "#ffffff",
  error: "#ef4444",
  onError: "#ffffff",
  info: "#3b82f6",
  onInfo: "#ffffff",

  border: "#e2e8f0",
  borderStrong: "#cbd5e1",
  divider: "#f1f5f9",
  muted: "#64748b",
};

export type ThemeColors = typeof light;

export const defaultScheme = "light" satisfies ColorScheme;

export const themes: { light: ThemeColors; dark?: ThemeColors } = { light };

export function setColorScheme(scheme: ColorScheme | null) {
  Appearance.setColorScheme?.(scheme);
}

setColorScheme?.(themes.dark ? null : defaultScheme);

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const system = useColorScheme();
  const scheme: ColorScheme = system && themes[system] ? system : defaultScheme;
  return { scheme, colors: themes[scheme] ?? themes.light };
}

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}

export const colors = light;
