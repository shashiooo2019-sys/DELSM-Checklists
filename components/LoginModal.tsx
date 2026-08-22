'use client';

import React, { useState } from 'react';
import { UserAccount, UserRole } from '@/types/aviation';
import { authenticateUserAsync } from '@/lib/storage';
import { User, ShieldCheck, Sliders, AlertCircle, ArrowRight, Plane, Loader2, Lock } from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: UserAccount, mustChangePassword: boolean) => void;
}

export function LoginModal({ isOpen, onClose, onSuccess }: LoginModalProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [requestedRole, setRequestedRole] = useState<UserRole>('USER');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanInput = username.trim();
    if (!cleanInput) {
      setError('Please enter your Username or U-Number.');
      return;
    }

    const cleanPassword = password.trim();
    if (!cleanPassword) {
      setError('Please enter your password.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await authenticateUserAsync(cleanInput, cleanPassword, requestedRole);
      if (!result.success || !result.user) {
        setError(result.error || 'User account not found. Please verify your U-Number or contact your supervisor.');
        setIsLoading(false);
        return;
      }
      setIsLoading(false);
      onSuccess(result.user, result.mustChangePassword || false);
    } catch (err: any) {
      setError('Authentication error. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div 
        id="login-modal-container" 
        className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden text-slate-900"
      >
        {/* Modal Header */}
        <div className="p-6 bg-white border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm shadow-blue-600/20">
              <Plane className="w-5 h-5 transform -rotate-45" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">DEL Ground Ops Login</h2>
              <p className="text-xs text-slate-500">Turnaround Checklists Control</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-xs font-bold px-2 py-1 rounded-lg hover:bg-slate-100 transition"
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-start gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Username / U-Number
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  id="input-login-username"
                  type="text"
                  placeholder="Enter U-Number (e.g. admin, supervisor, or staff U-ID)"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    if (error) setError(null);
                  }}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white font-mono placeholder:text-slate-400 transition"
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="input-login-password"
                  type="password"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white font-mono placeholder:text-slate-400 transition"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Target Sign-In Role
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setRequestedRole('USER');
                    if (error) setError(null);
                  }}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition flex flex-col items-center gap-1 ${
                    requestedRole === 'USER'
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-800 ring-2 ring-emerald-500/20'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <User className="w-4 h-4 text-emerald-600" />
                  <span>User</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setRequestedRole('SUPERVISOR');
                    if (error) setError(null);
                  }}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition flex flex-col items-center gap-1 ${
                    requestedRole === 'SUPERVISOR'
                      ? 'bg-amber-50 border-amber-500 text-amber-800 ring-2 ring-amber-500/20'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4 text-amber-600" />
                  <span>SUPERVISOR</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setRequestedRole('ADMIN');
                    if (error) setError(null);
                  }}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition flex flex-col items-center gap-1 ${
                    requestedRole === 'ADMIN'
                      ? 'bg-purple-50 border-purple-500 text-purple-800 ring-2 ring-purple-500/20'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Sliders className="w-4 h-4 text-purple-600" />
                  <span>ADMIN</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-500 mt-2 leading-tight">
                🔒 <strong>Authorization Rules:</strong> Admin accounts can sign in as any role. Supervisor accounts can sign in as Supervisor or User. User accounts can only sign in as User.
              </p>
            </div>

            <button
              id="btn-login-submit"
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold text-sm rounded-xl shadow-sm shadow-blue-600/20 flex items-center justify-center gap-2 transition cursor-pointer mt-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying Roster ID & Role Permissions...</span>
                </>
              ) : (
                <>
                  <span>Sign In as {requestedRole}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
