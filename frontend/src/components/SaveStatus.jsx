import React from 'react';
import { CheckCircle2, RefreshCw, WifiOff } from 'lucide-react';

export const SaveStatus = ({ status = 'saved' }) => {
  if (status === 'saving') {
    return (
      <div className="flex items-center space-x-1 text-xs text-brand-600 font-medium">
        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
        <span>Saving...</span>
      </div>
    );
  }

  if (status === 'offline') {
    return (
      <div className="flex items-center space-x-1 text-xs text-amber-600 font-medium bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
        <WifiOff className="w-3.5 h-3.5" />
        <span>Reconnecting...</span>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-1 text-xs text-slate-400 font-medium">
      <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />
      <span>Saved</span>
    </div>
  );
};
