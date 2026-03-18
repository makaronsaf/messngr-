import { useState } from 'react';
import { X, Plus, Trash2, BarChart2 } from 'lucide-react';
import { api } from '../../utils/api';

interface PollCreateProps {
  chatId: string;
  onClose: () => void;
}

export function PollCreate({ chatId, onClose }: PollCreateProps) {
  const [question, setQuestion]       = useState('');
  const [options, setOptions]         = useState(['', '']);
  const [isMultiple, setIsMultiple]   = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError]             = useState('');

  const addOption = () => {
    if (options.length >= 10) return;
    setOptions([...options, '']);
  };

  const removeOption = (idx: number) => {
    if (options.length <= 2) return;
    setOptions(options.filter((_, i) => i !== idx));
  };

  const updateOption = (idx: number, value: string) => {
    const updated = [...options];
    updated[idx] = value;
    setOptions(updated);
  };

  const handleSubmit = async () => {
    if (!question.trim()) { setError('Question is required'); return; }
    const validOptions = options.map((o) => o.trim()).filter(Boolean);
    if (validOptions.length < 2) { setError('At least 2 options required'); return; }

    setIsSubmitting(true);
    setError('');
    try {
      await api.post('/polls', {
        chatId,
        question: question.trim(),
        options: validOptions,
        isMultiple,
        isAnonymous,
      });
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to create poll');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
        <div className="bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-lg max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
            <div className="flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-tg-blue" />
              <h2 className="font-semibold text-gray-900 dark:text-white">New Poll</h2>
            </div>
            <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Question */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                Question
              </label>
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                maxLength={300}
                rows={2}
                autoFocus
                className="w-full bg-gray-50 dark:bg-gray-800 dark:text-white rounded-xl px-4 py-2.5 outline-none text-sm resize-none border border-transparent focus:border-tg-blue transition-colors"
                placeholder="Ask a question..."
              />
            </div>

            {/* Options */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
                Options
              </label>
              <div className="space-y-2">
                {options.map((opt, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={opt}
                      onChange={(e) => updateOption(idx, e.target.value)}
                      maxLength={100}
                      placeholder={`Option ${idx + 1}`}
                      className="flex-1 bg-gray-50 dark:bg-gray-800 dark:text-white rounded-xl px-4 py-2.5 outline-none text-sm border border-transparent focus:border-tg-blue transition-colors"
                    />
                    {options.length > 2 && (
                      <button
                        onClick={() => removeOption(idx)}
                        className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {options.length < 10 && (
                <button
                  onClick={addOption}
                  className="mt-2 flex items-center gap-2 text-sm text-tg-blue hover:underline"
                >
                  <Plus className="w-4 h-4" />
                  Add option
                </button>
              )}
            </div>

            {/* Settings */}
            <div className="space-y-3 pt-1">
              <Toggle
                label="Multiple answers"
                description="Allow voters to choose more than one option"
                value={isMultiple}
                onChange={setIsMultiple}
              />
              <Toggle
                label="Anonymous voting"
                description="Hide who voted for what"
                value={isAnonymous}
                onChange={setIsAnonymous}
              />
            </div>

            {error && (
              <div className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-xl px-4 py-2.5">
                {error}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex gap-3 px-5 pb-5 flex-shrink-0">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex-1 py-2.5 rounded-xl bg-tg-blue text-white text-sm font-medium hover:bg-tg-blue-dark transition-colors disabled:opacity-60"
            >
              {isSubmitting ? 'Creating...' : 'Create Poll'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function Toggle({ label, description, value, onChange }: {
  label: string; description: string;
  value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 rounded-xl px-4 py-3">
      <div>
        <div className="text-sm font-medium text-gray-900 dark:text-white">{label}</div>
        <div className="text-xs text-gray-500 dark:text-gray-400">{description}</div>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`w-11 h-6 rounded-full transition-colors ${value ? 'bg-tg-blue' : 'bg-gray-300 dark:bg-gray-600'}`}
      >
        <span className={`block w-5 h-5 rounded-full bg-white shadow transition-transform mx-0.5 ${value ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
    </div>
  );
}
