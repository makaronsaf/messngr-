import { FileText, Download } from 'lucide-react';
import { formatFileSize } from '../../utils/chatUtils';

interface FileMessageProps {
  url: string;
  name: string;
  size?: number;
}

export function FileMessage({ url, name, size }: FileMessageProps) {
  const ext = name.split('.').pop()?.toUpperCase() || 'FILE';

  return (
    <a
      href={url}
      download
      className="flex items-center gap-3 min-w-[200px] max-w-[280px] p-1 hover:opacity-80 transition-opacity"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="w-10 h-10 bg-tg-blue/20 rounded-lg flex items-center justify-center flex-shrink-0">
        <FileText className="w-5 h-5 text-tg-blue" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{name}</div>
        <div className="text-xs text-gray-400">
          {size ? formatFileSize(size) : ''} · {ext}
        </div>
      </div>
      <Download className="w-4 h-4 text-gray-400 flex-shrink-0" />
    </a>
  );
}
