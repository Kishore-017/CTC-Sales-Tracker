import React, { useState } from 'react';
import {
  Building2,
  ShieldCheck,
  User,
  LogOut,
  Database,
  CheckCircle2,
  FileCode2,
  Copy,
  Check,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../common/Button';
import { useToast } from '../../context/ToastContext';

export const SettingsView: React.FC = () => {
  const { user, profile, signOut } = useAuth();
  const toast = useToast();
  const [copiedSql, setCopiedSql] = useState(false);

  const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string) || 'Not configured';
  const hasAnonKey = Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY);

  const handleCopySchemaPath = () => {
    navigator.clipboard.writeText('supabase_tracker_schema.sql');
    setCopiedSql(true);
    toast.success('Schema filename copied to clipboard.');
    setTimeout(() => setCopiedSql(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Page Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <span className="text-xs font-bold text-brand-600 uppercase tracking-wider">
          Configuration
        </span>
        <h2 className="text-xl font-black text-slate-900 tracking-tight mt-0.5">
          Settings &amp; System Info
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Business profile, authentication session, and database connectivity
        </p>
      </div>

      {/* ────────────────── 1. BUSINESS PROFILE CARD ────────────────── */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Business Entity</h3>
            <p className="text-xs text-slate-500">Shop details used across all invoice records</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Official Business Name
            </span>
            <span className="font-extrabold text-slate-900 mt-1 block">
              Chelladurai Tradings Corporation
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Short Name / Brand
            </span>
            <span className="font-extrabold text-brand-600 mt-1 block">
              CTC (Paint &amp; Hardware)
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Application Identifier
            </span>
            <span className="font-semibold text-slate-700 mt-1 block">
              CTC Sales &amp; Money Tracker V1.0
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Currency &amp; Locale
            </span>
            <span className="font-semibold text-slate-700 mt-1 block">
              Indian Rupee (INR — ₹) • en-IN
            </span>
          </div>
        </div>
      </div>

      {/* ────────────────── 2. USER ACCOUNT INFORMATION ────────────────── */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <User className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">User &amp; Account</h3>
            <p className="text-xs text-slate-500">Currently signed in operator profile</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Email Address
            </span>
            <span className="font-bold text-slate-900 mt-1 block truncate" title={user?.email || ''}>
              {user?.email || 'N/A'}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Authorization Role
            </span>
            <div className="mt-1 flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold uppercase tracking-wider">
                {profile?.role || 'Admin'}
              </span>
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
            </div>
          </div>
        </div>

        <div className="pt-2 flex justify-start">
          <Button
            variant="danger"
            size="sm"
            onClick={() => signOut()}
            icon={<LogOut className="w-4 h-4" />}
          >
            Sign Out of Application
          </Button>
        </div>
      </div>

      {/* ────────────────── 3. SUPABASE DATABASE INFO & SQL SETUP ────────────────── */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Database &amp; Supabase Project</h3>
            <p className="text-xs text-slate-500">Backend connection and database schema status</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-600">Supabase Project Endpoint:</span>
              <span className="font-mono text-slate-800 bg-white px-2 py-1 rounded border border-slate-200 truncate max-w-xs">
                {supabaseUrl}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-600">Anon Client API Key:</span>
              <span className={`flex items-center gap-1.5 font-bold ${hasAnonKey ? 'text-emerald-600' : 'text-rose-600'}`}>
                <CheckCircle2 className="w-4 h-4" />
                <span>{hasAnonKey ? 'Configured & Active' : 'Not Configured'}</span>
              </span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-brand-50/60 border border-brand-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-start gap-2.5">
              <FileCode2 className="w-5 h-5 text-brand-600 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-brand-900 block">
                  Database Schema &amp; RLS Script: supabase_tracker_schema.sql
                </span>
                <span className="text-brand-700/80">
                  Run this SQL in your Supabase Dashboard SQL Editor to initialize all 4 tables &amp; RLS policies.
                </span>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleCopySchemaPath}
              icon={copiedSql ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              className="bg-white whitespace-nowrap"
            >
              {copiedSql ? 'Copied' : 'Copy File Name'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
