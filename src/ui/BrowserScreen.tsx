import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { setDappEmitter, walletDebug } from '../background/ProviderApiEthereum';
import { HOME_URL, tabsStore } from '../state/tabs';
import { emitToAllTabs, getWebviewRef } from '../webview/webviewRefs';
import { BrowserTab } from './BrowserTab';
import { TabSwitcher } from './TabSwitcher';

// Turn address-bar text into a URL (OneKey's `gotoSite` / `validateUrl`).
function normalizeToUrl(input: string): string {
  const text = input.trim();
  if (!text) return HOME_URL;
  if (/^https?:\/\//i.test(text)) return text;
  if (/^[\w-]+(\.[\w-]+)+.*$/.test(text)) return `https://${text}`;
  return `https://www.google.com/search?q=${encodeURIComponent(text)}`;
}

export function BrowserScreen() {
  const { tabs, activeId } = useSyncExternalStore(
    tabsStore.subscribe,
    tabsStore.getSnapshot,
    tabsStore.getSnapshot,
  );

  const activeTab = tabs.find((t) => t.id === activeId);

  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  // OneKey's connectBridge + requestToAllCS: wallet-initiated events go to EVERY tab.
  useEffect(() => {
    setDappEmitter((method, params) => emitToAllTabs('ethereum', method, params));
  }, []);

  const submit = useCallback(() => {
    getWebviewRef(activeId)?.loadURL(normalizeToUrl(draft));
    setEditing(false);
  }, [activeId, draft]);

  const startEditing = useCallback(() => {
    setDraft(activeTab?.currentUrl ?? '');
    setEditing(true);
  }, [activeTab?.currentUrl]);

  const displayUrl = activeTab?.currentUrl ?? '';

  return (
    <SafeAreaView style={styles.root}>
      {/* ---- address bar ---- */}
      <View style={styles.toolbar}>
        <TextInput
          style={styles.address}
          value={editing ? draft : displayUrl}
          onChangeText={setDraft}
          onFocus={startEditing}
          onBlur={() => setEditing(false)}
          onSubmitEditing={submit}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          returnKeyType="go"
          selectTextOnFocus
          placeholder="Search or enter dapp URL"
        />
        <Pressable
          style={styles.iconBtn}
          onPress={() => getWebviewRef(activeId)?.reload()}
        >
          <Ionicons name="reload" size={20} color="#111" />
        </Pressable>
      </View>

      {/* ---- all tabs stay mounted; inactive ones are frozen ---- */}
      <View style={styles.content}>
        {tabs.map((tab) => (
          <BrowserTab key={tab.id} tab={tab} isActive={tab.id === activeId} />
        ))}
      </View>

      {/* ---- bottom toolbar ---- */}
      <View style={styles.bottomBar}>
        <Pressable
          style={styles.barBtn}
          disabled={!activeTab?.canGoBack}
          onPress={() => getWebviewRef(activeId)?.goBack()}
        >
          <Ionicons
            name="chevron-back"
            size={26}
            color={activeTab?.canGoBack ? '#111' : '#d4d4d8'}
          />
        </Pressable>

        <Pressable
          style={styles.barBtn}
          disabled={!activeTab?.canGoForward}
          onPress={() => getWebviewRef(activeId)?.goForward()}
        >
          <Ionicons
            name="chevron-forward"
            size={26}
            color={activeTab?.canGoForward ? '#111' : '#d4d4d8'}
          />
        </Pressable>

        <Pressable
          style={styles.barBtn}
          onPress={() => getWebviewRef(activeId)?.loadURL(HOME_URL)}
        >
          <Ionicons name="home-outline" size={24} color="#111" />
        </Pressable>

        {/* tab count -> opens the switcher */}
        <Pressable style={styles.barBtn} onPress={() => setSwitcherOpen(true)}>
          <View style={styles.tabCount}>
            <Text style={styles.tabCountText}>{tabs.length}</Text>
          </View>
        </Pressable>

        <Pressable style={styles.barBtn} onPress={() => tabsStore.addTab()}>
          <Ionicons name="add" size={26} color="#111" />
        </Pressable>
      </View>

      {/* Dev-only: prove the reverse (wallet -> dapp) event path reaches every tab. */}
      <View style={styles.devBar}>
        <Pressable
          style={styles.devBtn}
          onPress={() =>
            walletDebug.switchChain(
              walletDebug.state.chainId === '0x1' ? '0xaa36a7' : '0x1',
            )
          }
        >
          <Text style={styles.devText}>emit chainChanged</Text>
        </Pressable>
        <Pressable style={styles.devBtn} onPress={() => walletDebug.disconnectAll()}>
          <Text style={styles.devText}>disconnect</Text>
        </Pressable>
      </View>

      <TabSwitcher
        visible={switcherOpen}
        tabs={tabs}
        activeId={activeId}
        onClose={() => setSwitcherOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e5e5',
  },
  iconBtn: { paddingHorizontal: 6, paddingVertical: 2 },
  address: {
    flex: 1,
    height: 40,
    backgroundColor: '#f4f4f5',
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  content: { flex: 1 },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e5e5',
  },
  barBtn: { paddingHorizontal: 16, paddingVertical: 4 },
  tabCount: {
    minWidth: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  tabCountText: { fontSize: 13, fontWeight: '700', color: '#111' },
  devBar: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 8,
    paddingBottom: 6,
  },
  devBtn: {
    backgroundColor: '#eef2ff',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  devText: { fontSize: 12, color: '#4338ca' },
});
