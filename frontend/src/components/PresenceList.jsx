import React from 'react';

const AVATAR_COLORS = [
  'bg-yellow-500', 'bg-brand-500', 'bg-cyan-500',
  'bg-rose-500', 'bg-emerald-500', 'bg-orange-500'
];

export const PresenceList = ({ activeUsers = [], typingUsers = [] }) => {
  const displayAvatars = activeUsers.slice(0, 3);
  const overflowCount = Math.max(0, activeUsers.length - 3);

  return (
    <div className="flex items-center space-x-2">
      {/* Overlapping Avatars */}
      <div className="flex -space-x-2 overflow-hidden">
        {displayAvatars.map((u, i) => (
          <div
            key={u.user_id || i}
            className={`inline-block h-8 w-8 rounded-full ring-2 ring-white ${AVATAR_COLORS[i % AVATAR_COLORS.length]} text-white flex items-center justify-center text-xs font-bold uppercase relative shadow-sm`}
            title={`${u.name} (${u.role || 'VIEWER'})`}
          >
            {u.name ? u.name[0] : 'U'}
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full" />
          </div>
        ))}

        {overflowCount > 0 && (
          <div className="inline-block h-8 w-8 rounded-full ring-2 ring-white bg-slate-700 text-white flex items-center justify-center text-xs font-bold shadow-sm">
            +{overflowCount}
          </div>
        )}
      </div>

      {typingUsers.length > 0 && (
        <div className="flex items-center space-x-1 text-xs text-brand-600 bg-brand-50 px-2.5 py-1 rounded-full border border-brand-200 animate-pulse">
          <span className="font-medium">{typingUsers.join(', ')} typing...</span>
        </div>
      )}
    </div>
  );
};
