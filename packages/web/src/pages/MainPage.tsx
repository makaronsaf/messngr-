import { useEffect, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Sidebar } from '../components/Layout/Sidebar';
import { ChatWindow } from '../components/Chat/ChatWindow';
import { CallOverlay } from '../components/Calls/CallOverlay';
import { useChatStore } from '../store/chatStore';
import { useSocketEvents } from '../hooks/useSocketEvents';
import { useCallStore } from '../store/callStore';

export function MainPage() {
  const { loadChats } = useChatStore();
  const [showSidebar, setShowSidebar] = useState(true);
  const { activeCall } = useCallStore();

  // Initialize socket events
  useSocketEvents();

  useEffect(() => {
    loadChats();
  }, [loadChats]);

  return (
    <div className="flex h-full w-full overflow-hidden bg-tg-chat-bg">
      {/* Sidebar */}
      <div
        className={`
          flex-shrink-0 w-80 h-full border-r border-tg-divider
          ${showSidebar ? 'flex' : 'hidden md:flex'}
        `}
      >
        <Sidebar onChatSelect={() => setShowSidebar(false)} />
      </div>

      {/* Main content */}
      <div className="flex-1 h-full overflow-hidden">
        <Routes>
          <Route
            path="/"
            element={
              <div className="h-full flex items-center justify-center bg-tg-chat-bg">
                <div className="text-center text-gray-500">
                  <div className="w-24 h-24 bg-tg-blue/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg viewBox="0 0 24 24" fill="none" className="w-12 h-12 text-tg-blue" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-700 mb-2">Select a chat</h3>
                  <p className="text-sm">Choose a conversation or start a new one</p>
                </div>
              </div>
            }
          />
          <Route
            path="/chat/:chatId"
            element={<ChatWindow onBack={() => setShowSidebar(true)} />}
          />
        </Routes>
      </div>

      {/* Active call overlay */}
      {activeCall && <CallOverlay />}
    </div>
  );
}
