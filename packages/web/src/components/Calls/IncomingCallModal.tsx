import { Phone, PhoneOff, Video } from 'lucide-react';
import { useCallStore } from '../../store/callStore';

export function IncomingCallModal() {
  const { incomingCall, answerCall, declineCall } = useCallStore();
  if (!incomingCall) return null;

  return (
    <div className="fixed inset-x-0 top-4 z-50 flex justify-center px-4">
      <div className="bg-gray-900 rounded-2xl shadow-modal text-white p-5 w-full max-w-sm">
        <div className="text-center mb-5">
          <div className="w-16 h-16 bg-tg-blue rounded-full flex items-center justify-center mx-auto mb-3 text-2xl font-bold">
            {incomingCall.callerName.charAt(0)}
          </div>
          <h3 className="font-semibold text-lg">{incomingCall.callerName}</h3>
          <p className="text-gray-400 text-sm mt-0.5">
            Входящий {incomingCall.type === 'VIDEO' ? 'видео' : 'аудио'}звонок...
          </p>
        </div>

        <div className="flex items-center justify-center gap-8">
          <button
            onClick={declineCall}
            className="w-14 h-14 bg-red-500 hover:bg-red-600 rounded-full flex flex-col items-center justify-center gap-0.5 transition-colors"
          >
            <PhoneOff className="w-6 h-6" />
          </button>

          <button
            onClick={answerCall}
            className="w-14 h-14 bg-green-500 hover:bg-green-600 rounded-full flex flex-col items-center justify-center gap-0.5 transition-colors"
          >
            {incomingCall.type === 'VIDEO'
              ? <Video className="w-6 h-6" />
              : <Phone className="w-6 h-6" />
            }
          </button>
        </div>
      </div>
    </div>
  );
}
