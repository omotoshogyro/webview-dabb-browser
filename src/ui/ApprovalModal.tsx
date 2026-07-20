import { useSyncExternalStore } from 'react';

import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  approvalService,
  type IApprovalRequest,
} from '../background/approvalService';

// Subscribes to the approval queue and renders the head entry (OneKey surfaces
// the same thing as a bottom-sheet via `serviceDApp.openConnectionModal`).

function usePendingApprovals(): IApprovalRequest[] {
  return useSyncExternalStore(
    approvalService.subscribe,
    approvalService.getPending,
    approvalService.getPending,
  );
}

const TITLES: Record<IApprovalRequest['type'], string> = {
  connect: 'Connection request',
  sign: 'Signature request',
  tx: 'Transaction request',
};

const ACTIONS: Record<IApprovalRequest['type'], string> = {
  connect: 'Connect',
  sign: 'Sign',
  tx: 'Confirm',
};

export function ApprovalModal() {
  const pending = usePendingApprovals();
  const current = pending[0];
  const visible = Boolean(current);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={() => current && approvalService.reject(current.id)}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          {current ? (
            <>
              <Text style={styles.title}>{TITLES[current.type]}</Text>
              <Text style={styles.origin}>{current.origin}</Text>
              <Text style={styles.method}>{current.method}</Text>

              {current.payload != null ? (
                <ScrollView style={styles.payloadBox}>
                  <Text style={styles.payload}>
                    {JSON.stringify(current.payload, null, 2)}
                  </Text>
                </ScrollView>
              ) : null}

              {pending.length > 1 ? (
                <Text style={styles.queue}>
                  {pending.length - 1} more request
                  {pending.length - 1 > 1 ? 's' : ''} queued
                </Text>
              ) : null}

              <View style={styles.row}>
                <Pressable
                  style={[styles.btn, styles.reject]}
                  onPress={() => approvalService.reject(current.id)}
                >
                  <Text style={styles.rejectText}>Reject</Text>
                </Pressable>
                <Pressable
                  style={[styles.btn, styles.approve]}
                  onPress={() => approvalService.approve(current.id)}
                >
                  <Text style={styles.approveText}>{ACTIONS[current.type]}</Text>
                </Pressable>
              </View>
            </>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
  },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 4 },
  origin: { fontSize: 14, color: '#2563eb', marginBottom: 12 },
  method: {
    fontSize: 13,
    fontFamily: 'Courier',
    color: '#111',
    marginBottom: 12,
  },
  payloadBox: {
    maxHeight: 160,
    backgroundColor: '#f4f4f5',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  payload: { fontSize: 12, fontFamily: 'Courier', color: '#333' },
  queue: { fontSize: 12, color: '#888', marginBottom: 12 },
  row: { flexDirection: 'row', gap: 12, marginTop: 4 },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  reject: { backgroundColor: '#f4f4f5' },
  rejectText: { color: '#111', fontWeight: '600', fontSize: 16 },
  approve: { backgroundColor: '#111' },
  approveText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
