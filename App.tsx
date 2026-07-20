import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ApprovalModal } from './src/ui/ApprovalModal';
import { BrowserScreen } from './src/ui/BrowserScreen';

export default function App() {
  return (
    <SafeAreaProvider>
      <View style={styles.root}>
        <StatusBar style="dark" />
        <BrowserScreen />
        {/* Mounted once at the root; renders whenever a provider awaits approval. */}
        <ApprovalModal />
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
