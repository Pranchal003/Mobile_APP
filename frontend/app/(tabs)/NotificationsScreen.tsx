import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { BACKEND_BASE_URL } from '../../constants/Backend';
import { useUnreadNotifications } from '../../components/UnreadNotificationsContext';
import { useFocusEffect } from '@react-navigation/native';

const PAGE_SIZE = 10;

type Notification = {
  id: number;
  result_text: string;
  status: 'success' | 'failure';
  created_at: string;
};

export default function NotificationsPage() {
  const [page, setPage] = useState(1);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [unreadIds, setUnreadIds] = useState<number[]>([]);
  const { setUnread } = useUnreadNotifications();

  const fetchNotifications = async (pageNum = 1) => {
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_BASE_URL}/notifications?page=${pageNum}&limit=${PAGE_SIZE}`);
      const data = await res.json();
      setNotifications(data.notifications || []);
      setTotalPages(Math.max(1, Math.ceil((data.total || (data.notifications?.length ?? 0)) / PAGE_SIZE)));
      const newUnreadIds = (data.notifications || []).map((n: Notification) => n.id);
      setUnreadIds(newUnreadIds);
      setUnread(newUnreadIds.length > 0);
    } catch (err) {
      Alert.alert('Error', 'Failed to fetch notifications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications(page);
  }, [page]);

  useFocusEffect(
    React.useCallback(() => {
      setUnread(false);
      setUnreadIds([]);
    }, [setUnread])
  );

  const handleDelete = async (id: number) => {
    const originalNotifications = [...notifications];
    setNotifications(notifications.filter(n => n.id !== id));

    try {
      const res = await fetch(`${BACKEND_BASE_URL}/notification/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        Alert.alert('Error', 'Failed to delete notification on the server.');
        setNotifications(originalNotifications);
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to delete notification. Check your connection.');
      setNotifications(originalNotifications);
    }
  };

  const markAsRead = (id: number) => {
    setUnreadIds(unreadIds.filter(unreadId => unreadId !== id));
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Notifications</Text>
      {loading ? (
        <ActivityIndicator size="large" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item, index) => (item.id ? item.id.toString() : index.toString())}
          renderItem={({ item }: { item: Notification }) => {
            const status = (item.status || '').toString().toLowerCase();
            const isSuccess = status === 'success' || item.result_text.toLowerCase().includes('clicked submit button');
            const isFailure = status === 'failure' && !isSuccess;

            return (
              <TouchableOpacity
                style={[
                  styles.card,
                  isSuccess ? styles.greenOutline : styles.redOutline,
                  unreadIds.includes(item.id) && styles.unread
                ]}
                onPress={() => markAsRead(item.id)}
              >
                {isSuccess && (
                  <Text style={{ fontWeight: 'bold', color: 'green', marginBottom: 4 }}>Successful Submission</Text>
                )}
                {isFailure && (
                  <Text style={{ fontWeight: 'bold', color: 'red', marginBottom: 4 }}>Failed Submission</Text>
                )}
                <Text style={styles.result}>{item.result_text}</Text>
                <Text style={styles.timestamp}>{new Date(item.created_at).toLocaleString()}</Text>
                <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.deleteBtn}>
                  <Text style={styles.deleteText}>Delete</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 20 }}>No notifications.</Text>}
        />
      )}
      <View style={styles.pagination}>
        <TouchableOpacity disabled={page === 1} onPress={() => setPage(page - 1)}>
          <Text style={[styles.arrow, page === 1 && styles.disabledArrow]}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.pageNum}>{page} / {totalPages}</Text>
        <TouchableOpacity disabled={page === totalPages} onPress={() => setPage(page + 1)}>
          <Text style={[styles.arrow, page === totalPages && styles.disabledArrow]}>{'>'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 16 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' },
  card: {
    borderWidth: 2,
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
    backgroundColor: '#f9f9f9',
    position: 'relative',
  },
  greenOutline: { borderColor: 'green' },
  redOutline: { borderColor: 'red' },
  result: { fontSize: 16, fontWeight: '500' },
  timestamp: { fontSize: 12, color: '#888', marginTop: 4 },
  deleteBtn: { position: 'absolute', top: 10, right: 10, padding: 4 },
  deleteText: { color: 'red', fontWeight: 'bold' },
  pagination: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 12 },
  arrow: { fontSize: 24, marginHorizontal: 20, color: '#333' },
  disabledArrow: { color: '#ccc' },
  pageNum: { fontSize: 16, fontWeight: 'bold' },
  unread: { backgroundColor: '#e0e0e0' },
}); 