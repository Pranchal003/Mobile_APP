import React, { createContext, useState, useContext, ReactNode } from 'react';

type UnreadContextType = {
  unread: boolean;
  setUnread: (unread: boolean) => void;
};

const UnreadNotificationsContext = createContext<UnreadContextType | undefined>(undefined);

export const UnreadNotificationsProvider = ({ children }: { children: ReactNode }) => {
  const [unread, setUnread] = useState(false);

  return (
    <UnreadNotificationsContext.Provider value={{ unread, setUnread }}>
      {children}
    </UnreadNotificationsContext.Provider>
  );
};

export const useUnreadNotifications = () => {
  const context = useContext(UnreadNotificationsContext);
  if (context === undefined) {
    throw new Error('useUnreadNotifications must be used within an UnreadNotificationsProvider');
  }
  return context;
}; 