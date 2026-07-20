import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { tabsStore, type IWebTab } from '../state/tabs';

// The tab list overlay. OneKey shows a card grid; a list keeps this readable.

interface ITabSwitcherProps {
  visible: boolean;
  tabs: IWebTab[];
  activeId: string;
  onClose: () => void;
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export function TabSwitcher({
  visible,
  tabs,
  activeId,
  onClose,
}: ITabSwitcherProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Pressable onPress={() => tabsStore.closeAllTabs()} hitSlop={8}>
              <Text style={styles.headerAction}>Close All</Text>
            </Pressable>
            <Text style={styles.headerTitle}>
              {tabs.length} Tab{tabs.length === 1 ? '' : 's'}
            </Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={[styles.headerAction, styles.done]}>Done</Text>
            </Pressable>
          </View>

          <FlatList
            data={tabs}
            keyExtractor={(t) => t.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => {
              const isActive = item.id === activeId;
              return (
                <Pressable
                  style={[styles.row, isActive && styles.rowActive]}
                  onPress={() => {
                    tabsStore.setActiveTab(item.id);
                    onClose();
                  }}
                >
                  <Ionicons
                    name="globe-outline"
                    size={20}
                    color={isActive ? '#4338ca' : '#71717a'}
                  />
                  <View style={styles.rowText}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {item.title || hostOf(item.currentUrl)}
                    </Text>
                    <Text style={styles.rowUrl} numberOfLines={1}>
                      {item.currentUrl}
                    </Text>
                  </View>
                  <Pressable
                    hitSlop={10}
                    onPress={() => tabsStore.closeTab(item.id)}
                  >
                    <Ionicons name="close" size={20} color="#a1a1aa" />
                  </Pressable>
                </Pressable>
              );
            }}
          />

          <Pressable
            style={styles.newTab}
            onPress={() => {
              tabsStore.addTab();
              onClose();
            }}
          >
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={styles.newTabText}>New Tab</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    paddingBottom: 32,
    maxHeight: '75%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerTitle: { fontSize: 16, fontWeight: '700' },
  headerAction: { fontSize: 15, color: '#71717a' },
  done: { color: '#4338ca', fontWeight: '600' },
  list: { paddingHorizontal: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
  },
  rowActive: { backgroundColor: '#eef2ff' },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: '600', color: '#111' },
  rowUrl: { fontSize: 12, color: '#71717a', marginTop: 2 },
  newTab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#111',
    marginHorizontal: 20,
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 12,
  },
  newTabText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
