'use client';

import React, { useState, useEffect } from 'react';
import { AuditLogEntry, UserAccount } from '@/types/aviation';
import { loadAuditLogs } from '@/lib/storage';
import { subscribeToAuditLogs } from '@/lib/firestoreService';
import { X, History, User, Clock, Shield, Search, Radio } from 'lucide-react';

interface AuditLogDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AuditLogDrawer({ isOpen, onClose }: AuditLogDrawerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [logs, setLogs] = useState<AuditLogEntry[]>(() => loadAuditLogs());

  useEffect(() => {
    if (!isOpen) return;

    const unsubscribe = subscribeToAuditLogs((remoteLogs) => {
      if (remoteLogs && remoteLogs.length > 0) {
        setLogs(remoteLogs);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredLogs = logs.filter(
    (l) =>
      l.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.uNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.details.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div 
        id="audit-log-modal-container"
        className="w-full max-w-3xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col text-slate-900 max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 bg-white border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center shadow-2xs">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                  DEL Operational Audit Log
                </h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Live Firestore
                </span>
              </div>
              <p className="text-xs text-slate-500">Chronological telemetry of all system actions & sign-offs (30-day compliance)</p>
            </div>
          </div>

          <button
            id="btn-close-audit-logs"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search audit trail by user, action, or details..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-transparent text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />
        </div>

        {/* Log Entries */}
        <div className="p-4 sm:p-6 flex-1 overflow-y-auto space-y-2.5 font-mono text-xs bg-slate-50/50">
          {filteredLogs.length === 0 ? (
            <div className="text-center py-10 text-slate-400">No matching audit logs found.</div>
          ) : (
            filteredLogs.map((log) => (
              <div
                key={log.id}
                className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1 hover:border-slate-300 transition shadow-2xs"
              >
                <div className="flex items-center justify-between text-slate-500 flex-wrap gap-1 text-[11px]">
                  <div className="flex items-center gap-2">
                    <span className="text-sky-700 font-bold">{log.action}</span>
                    <span className="text-slate-300">·</span>
                    <span className="text-slate-800 font-medium">
                      {log.userName} ({log.uNumber})
                    </span>
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded-full uppercase font-bold border ${
                        log.userRole === 'ADMIN'
                          ? 'bg-purple-50 text-purple-700 border-purple-200'
                          : log.userRole === 'SUPERVISOR'
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}
                    >
                      {log.userRole}
                    </span>
                  </div>
                  <span className="text-slate-400 text-[10px]">
                    {new Date(log.timestamp).toLocaleString([], { hour12: false })}
                  </span>
                </div>
                <div className="text-slate-800 font-sans text-xs pt-0.5">{log.details}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
