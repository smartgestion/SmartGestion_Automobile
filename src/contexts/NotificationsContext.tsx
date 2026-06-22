import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from './AuthContext'
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { ensureLowStockNotifications, updateStockAndNotify } from '@/lib/notifications'

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  is_read: boolean;
  link?: string;
  created_at: string;
}

interface NotificationsContextType {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  addNotification: (notification: Omit<Notification, 'id' | 'user_id' | 'created_at' | 'is_read'>) => Promise<void>;
  refreshNotifications: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchNotifications = useCallback(async () => {
    if (!user?.id) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.warn('Error fetching notifications:', error);
        setNotifications([]);
      } else {
        setNotifications(data || []);
      }
    } catch (err) {
      console.warn('Error fetching notifications:', err);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Initial fetch and stock check
  useEffect(() => {
    fetchNotifications();
    if (user?.id) {
      ensureLowStockNotifications(user.id);
    }
  }, [fetchNotifications, user?.id]);

  // Real-time subscription via Supabase Realtime
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('notifications-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload: RealtimePostgresChangesPayload<Notification>) => {
          if (payload.eventType === 'INSERT' && payload.new) {
            const newNotif = payload.new as Notification;
            setNotifications(prev => [newNotif, ...prev]);
          } else if (payload.eventType === 'UPDATE' && payload.new) {
            const updated = payload.new as Notification;
            setNotifications(prev =>
              prev.map(n => n.id === updated.id ? { ...n, ...updated } : n)
            );
          } else if (payload.eventType === 'DELETE' && payload.old) {
            const deleted = payload.old as Notification;
            setNotifications(prev =>
              prev.filter(n => n.id !== deleted.id)
            );
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // Real-time subscription on produits table for instant stock-change alerts
  useEffect(() => {
    if (!user?.id) return;

    const produitsChannel = supabase
      .channel('produits-stock-realtime')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'produits',
          filter: `user_id=eq.${user.id}`,
        },
        (payload: RealtimePostgresChangesPayload<any>) => {
          const oldRow: any = payload.old;
          const newRow: any = payload.new;
          const oldStock = Number(oldRow?.stock_actuel ?? -1);
          const newStock = Number(newRow?.stock_actuel ?? -1);

          if (oldStock >= 0 && newStock >= 0 && newStock < oldStock) {
            const threshold = Math.max(Number(newRow?.stock_min) || 0, 5);
            if (newStock <= threshold) {
              ensureLowStockNotifications(user.id, [newRow.id]);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(produitsChannel);
    };
  }, [user?.id]);

  // Polling fallback (every 15s) for environments without real-time support
  useEffect(() => {
    if (!user?.id) return;

    pollingRef.current = setInterval(() => {
      fetchNotifications();
    }, 15000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [user?.id, fetchNotifications]);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const markAsRead = async (id: string) => {
    if (!user?.id) return;

    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, is_read: true } : n)
    );

    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id)
        .eq('user_id', user.id);
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  const markAllAsRead = async () => {
    if (!user?.id) return;

    setNotifications(prev =>
      prev.map(n => ({ ...n, is_read: true }))
    );

    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);
    } catch (err) {
      console.error('Error marking all as read:', err);
    }
  };

  const addNotification = async (notification: Omit<Notification, 'id' | 'user_id' | 'created_at' | 'is_read'>) => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('notifications')
        .insert({
          user_id: user.id,
          ...notification,
          is_read: false
        })
        .select()
        .single();

      if (!error && data) {
        setNotifications(prev => [data, ...prev]);
      }
    } catch (err) {
      console.error('Error adding notification:', err);
    }
  };

  return (
    <NotificationsContext.Provider 
      value={{ 
        notifications, 
        unreadCount, 
        loading, 
        markAsRead, 
        markAllAsRead,
        addNotification,
        refreshNotifications: fetchNotifications
      }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}

export const useNotifications = () => {
  const context = useContext(NotificationsContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationsProvider');
  }
  return context;
};
