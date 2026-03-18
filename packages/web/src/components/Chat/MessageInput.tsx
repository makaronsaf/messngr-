import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Paperclip, Mic, Send, Image, FileText, X, Smile,
  Video, Square, BarChart2, Clock,
} from 'lucide-react';
import { useChatStore } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../utils/api';
import { EmojiPicker } from './EmojiPicker';
import { PollCreate } from './PollCreate';

interface MessageInputProps {
  chatId: string;
}

type RecordingState = 'idle' | 'recording-voice' | 'recording-video';

export function MessageInput({ chatId }: MessageInputProps) {
  const [text, setText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [recordingTime, setRecordingTime] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showPollCreate, setShowPollCreate] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduledAt, setScheduledAt] = useState('');

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval>>();

  const { sendMessage, replyingTo, setReplyingTo, setTyping } = useChatStore();
  const { user } = useAuthStore();

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
    }
  }, [text]);

  // Typing indicator
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    setTyping(chatId, true);
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => setTyping(chatId, false), 3000);
  };

  const handleSend = useCallback(async () => {
    if (!text.trim() || !user) return;
    setTyping(chatId, false);

    // Schedule message if time is set
    if (showSchedule && scheduledAt) {
      try {
        await api.post('/scheduled', {
          chatId,
          content: text.trim(),
          type: 'TEXT',
          scheduledAt,
        });
        setText('');
        setScheduledAt('');
        setShowSchedule(false);
        setReplyingTo(null);
        textareaRef.current?.focus();
      } catch (err) {
        console.error('Schedule failed:', err);
      }
      return;
    }

    sendMessage(chatId, {
      type: 'TEXT',
      content: text.trim(),
      senderId: user.id,
      sender: user as any,
      replyToMessageId: replyingTo?.id,
      replyToMessage: replyingTo || undefined,
    });

    setText('');
    setReplyingTo(null);
    textareaRef.current?.focus();
  }, [text, chatId, user, replyingTo, sendMessage, setReplyingTo, setTyping, showSchedule, scheduledAt]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // File upload
  const handleFileUpload = async (file: File) => {
    if (!user) return;
    setIsUploading(true);
    setUploadProgress(0);
    setShowAttach(false);

    try {
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');
      const isAudio = file.type.startsWith('audio/');

      let type: string;
      let endpoint: string;

      if (isImage) { type = 'IMAGE'; endpoint = '/media/upload'; }
      else if (isVideo) { type = 'VIDEO'; endpoint = '/media/upload'; }
      else if (isAudio) { type = 'AUDIO'; endpoint = '/media/upload'; }
      else { type = 'FILE'; endpoint = '/media/upload'; }

      const res = await api.upload(endpoint, file, setUploadProgress);
      const { url, thumbnailUrl, size, width, height, mimeType } = res.data;

      sendMessage(chatId, {
        type: type as any,
        mediaUrl: url,
        mediaThumbnail: thumbnailUrl,
        mediaType: mimeType || file.type,
        mediaSize: size || file.size,
        mediaWidth: width,
        mediaHeight: height,
        senderId: user.id,
        sender: user as any,
      });
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  // Voice recording
  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg';
      const recorder = new MediaRecorder(stream, { mimeType });

      recordingChunksRef.current = [];
      recorder.ondataavailable = (e) => recordingChunksRef.current.push(e.data);

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(recordingChunksRef.current, { type: mimeType });
        const file = new File([blob], `voice_${Date.now()}.ogg`, { type: mimeType });
        await uploadVoiceFile(file);
      };

      recorder.start(100);
      mediaRecorderRef.current = recorder;
      setRecordingState('recording-voice');
      setRecordingTime(0);
      recordingTimerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
    } catch (err) {
      console.error('Failed to start recording:', err);
    }
  };

  const stopRecording = () => {
    clearInterval(recordingTimerRef.current);
    mediaRecorderRef.current?.stop();
    setRecordingState('idle');
    setRecordingTime(0);
  };

  const cancelRecording = () => {
    clearInterval(recordingTimerRef.current);
    mediaRecorderRef.current?.stop();
    recordingChunksRef.current = [];
    setRecordingState('idle');
    setRecordingTime(0);
  };

  const uploadVoiceFile = async (file: File) => {
    if (!user) return;
    setIsUploading(true);
    try {
      const res = await api.upload('/media/voice', file);
      const { url, size } = res.data;
      sendMessage(chatId, {
        type: 'VOICE',
        mediaUrl: url,
        mediaType: 'audio/ogg',
        mediaSize: size,
        mediaDuration: recordingTime,
        senderId: user.id,
        sender: user as any,
      });
    } catch (err) {
      console.error('Voice upload failed:', err);
    } finally {
      setIsUploading(false);
    }
  };

  // Video note recording
  const startVideoNote = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      const mimeType = MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : 'video/mp4';
      const recorder = new MediaRecorder(stream, { mimeType });

      recordingChunksRef.current = [];
      recorder.ondataavailable = (e) => recordingChunksRef.current.push(e.data);

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(recordingChunksRef.current, { type: mimeType });
        const file = new File([blob], `video_note_${Date.now()}.mp4`, { type: mimeType });
        await uploadVideoNote(file);
      };

      recorder.start(100);
      mediaRecorderRef.current = recorder;
      setRecordingState('recording-video');
      setRecordingTime(0);
      recordingTimerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
    } catch (err) {
      console.error('Failed to start video note recording:', err);
    }
  };

  const uploadVideoNote = async (file: File) => {
    if (!user) return;
    setIsUploading(true);
    try {
      const res = await api.upload('/media/video-note', file);
      const { url, thumbnailUrl, size } = res.data;
      sendMessage(chatId, {
        type: 'VIDEO_NOTE',
        mediaUrl: url,
        mediaThumbnail: thumbnailUrl,
        mediaType: 'video/mp4',
        mediaSize: size,
        mediaDuration: recordingTime,
        senderId: user.id,
        sender: user as any,
      });
    } catch (err) {
      console.error('Video note upload failed:', err);
    } finally {
      setIsUploading(false);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (recordingState !== 'idle') {
    return (
      <div className="flex-shrink-0 bg-white dark:bg-gray-900 border-t border-tg-divider dark:border-gray-700 px-4 py-3">
        <div className="flex items-center gap-4">
          <button onClick={cancelRecording} className="text-red-500 hover:text-red-600">
            <X className="w-6 h-6" />
          </button>

          <div className="flex-1 flex items-center gap-3">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            <div className="flex gap-0.5 items-end h-8">
              {Array.from({ length: 20 }).map((_, i) => (
                <div
                  key={i}
                  className="w-1 bg-tg-blue rounded-full"
                  style={{ height: `${Math.random() * 24 + 8}px`, animationDelay: `${i * 0.05}s` }}
                />
              ))}
            </div>
            <span className="text-tg-red font-mono text-sm">{formatTime(recordingTime)}</span>
          </div>

          <button
            onClick={stopRecording}
            className="w-10 h-10 bg-tg-blue rounded-full flex items-center justify-center text-white hover:bg-tg-blue-dark transition-colors"
          >
            <Square className="w-4 h-4 fill-current" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-shrink-0 bg-white dark:bg-gray-900 border-t border-tg-divider dark:border-gray-700">
      {/* Reply preview */}
      {replyingTo && (
        <div className="flex items-center gap-3 px-4 py-2 border-b border-tg-divider dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <div className="border-l-2 border-tg-blue pl-2 flex-1 min-w-0">
            <div className="text-xs font-semibold text-tg-blue">{replyingTo.sender.displayName}</div>
            <div className="text-xs text-gray-500 truncate">
              {replyingTo.content || `[${replyingTo.type}]`}
            </div>
          </div>
          <button
            onClick={() => setReplyingTo(null)}
            className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      )}

      {/* Upload progress */}
      {isUploading && (
        <div className="h-0.5 bg-gray-100 dark:bg-gray-700">
          <div
            className="h-full bg-tg-blue transition-all duration-300"
            style={{ width: `${uploadProgress}%` }}
          />
        </div>
      )}

      {/* Main input row */}
      <div className="flex items-end gap-2 px-3 py-2">
        {/* Emoji button */}
        <div className="relative">
          <button
            onClick={() => setShowEmoji(!showEmoji)}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors self-end mb-0.5"
          >
            <Smile className="w-5 h-5" />
          </button>
          {showEmoji && (
            <EmojiPicker
              onSelect={(emoji) => { setText((prev) => prev + emoji); setShowEmoji(false); }}
              onClose={() => setShowEmoji(false)}
              className="bottom-12 left-0"
            />
          )}
        </div>

        {/* Attach */}
        <div className="relative">
          <button
            onClick={() => setShowAttach(!showAttach)}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors self-end mb-0.5"
          >
            <Paperclip className="w-5 h-5" />
          </button>

          {showAttach && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowAttach(false)} />
              <div className="absolute bottom-12 left-0 z-50 bg-white dark:bg-gray-800 rounded-xl shadow-modal border border-gray-100 dark:border-gray-700 py-2 min-w-[180px]">
                <button
                  className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm"
                  onClick={() => { fileInputRef.current?.setAttribute('accept', 'image/*'); fileInputRef.current?.click(); setShowAttach(false); }}
                >
                  <Image className="w-5 h-5 text-tg-blue" />
                  <span>Photo or Video</span>
                </button>
                <button
                  className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm"
                  onClick={() => { fileInputRef.current?.setAttribute('accept', '*/*'); fileInputRef.current?.click(); setShowAttach(false); }}
                >
                  <FileText className="w-5 h-5 text-tg-green" />
                  <span>File</span>
                </button>
                <button
                  className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm"
                  onClick={() => { startVideoNote(); setShowAttach(false); }}
                >
                  <Video className="w-5 h-5 text-tg-red" />
                  <span>Video Message</span>
                </button>
                <button
                  className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm"
                  onClick={() => { setShowPollCreate(true); setShowAttach(false); }}
                >
                  <BarChart2 className="w-5 h-5 text-purple-500" />
                  <span>Poll</span>
                </button>
                <button
                  className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm"
                  onClick={() => { setShowSchedule(!showSchedule); setShowAttach(false); }}
                >
                  <Clock className="w-5 h-5 text-orange-500" />
                  <span>Schedule Message</span>
                </button>
              </div>
            </>
          )}
        </div>

        {/* Text input */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          placeholder="Message"
          rows={1}
          className="flex-1 bg-tg-bg-secondary dark:bg-gray-800 dark:text-white rounded-2xl px-4 py-2.5 outline-none text-sm resize-none placeholder:text-gray-400 max-h-32 overflow-y-auto"
          style={{ lineHeight: '1.4' }}
        />

        {/* Send or Voice */}
        {text.trim() ? (
          <button
            onClick={handleSend}
            disabled={isUploading}
            className="w-10 h-10 bg-tg-blue rounded-full flex items-center justify-center text-white hover:bg-tg-blue-dark transition-colors flex-shrink-0 mb-0.5"
          >
            <Send className="w-4 h-4 ml-0.5" />
          </button>
        ) : (
          <button
            onMouseDown={startVoiceRecording}
            onTouchStart={startVoiceRecording}
            className="w-10 h-10 bg-tg-blue rounded-full flex items-center justify-center text-white hover:bg-tg-blue-dark transition-colors flex-shrink-0 mb-0.5"
            title="Hold to record voice"
          >
            <Mic className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Schedule datetime picker */}
      {showSchedule && (
        <div className="flex items-center gap-2 px-4 py-2 border-t border-tg-divider dark:border-gray-700 bg-orange-50 dark:bg-orange-900/20">
          <Clock className="w-4 h-4 text-orange-500 flex-shrink-0" />
          <span className="text-xs text-orange-700 dark:text-orange-300 flex-shrink-0">Send at:</span>
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
            className="flex-1 text-xs bg-transparent outline-none text-orange-800 dark:text-orange-200"
          />
          <button onClick={() => { setShowSchedule(false); setScheduledAt(''); }} className="text-gray-400 hover:text-gray-600">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileUpload(file);
          e.target.value = '';
        }}
      />

      {/* Poll creation modal */}
      {showPollCreate && (
        <PollCreate chatId={chatId} onClose={() => setShowPollCreate(false)} />
      )}
    </div>
  );
}
