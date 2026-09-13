import Feather from "@react-native-vector-icons/feather";
import { View, StyleSheet } from "react-native";

export function CategoryIcon({
  name,
  color,
  size = 20,
  bg,
}: {
  name: string;
  color: string;
  size?: number;
  bg?: string;
}) {
  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: bg ?? `${color}22`,
          width: size * 2,
          height: size * 2,
          borderRadius: (size * 2) / 4,
        },
      ]}
    >
      <Feather name={name as any} size={size} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
  },
});
