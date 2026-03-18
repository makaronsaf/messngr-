import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import { clsx } from 'clsx';

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
  className?: string;
}

export function EmojiPicker({ onSelect, onClose, className }: EmojiPickerProps) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className={clsx('absolute z-50 shadow-modal rounded-xl overflow-hidden', className || 'bottom-12 left-0')}>
        <Picker
          data={data}
          onEmojiSelect={(e: any) => onSelect(e.native)}
          theme="light"
          set="native"
          skinTonePosition="none"
          previewPosition="none"
          maxFrequentRows={2}
        />
      </div>
    </>
  );
}
