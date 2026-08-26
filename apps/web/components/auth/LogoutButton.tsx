"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/components/shared/AuthContext";
import { routes } from "@/components/site/routes";
import { useToast } from "@/components/shared/Toast";
import { LogOut, Loader2, ShieldCheck, AlertTriangle, X, Clock } from "lucide-react";
import { ConfirmModal } from "@/components/shared/Dialogs";

export function LogoutButton({ variant = "button", className = "" }: { variant?: "button" | "dropdown"; className?: string }) {
  const router = useRouter();
  const { logout, status } = useSession();
  const { error: toastError, success: toastSuccess } = useToast();

  const [showConfirm, setShowConfirm] = React.useState(false);
  const [loggingOut, setLoggingOut] = React.useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      logout();
      toastSuccess("You have been logged out");
      router.push("/login");
    } catch {
      // Handle error if needed
    } finally {
      setLoggingOut(false);
      setShowConfirm(false);
    }
  };

  if (variant === "dropdown") {
    return (
      <div className="relative">
        <button
          onClick={() => setShowConfirm(true)}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold text-obligon-navy hover:bg-obligon-mist ${className}`}
          disabled={loggingOut}
        >
          <LogOut size={18} />
          <span>Sign Out</span>
        </button>

        <ConfirmModal
          open={showConfirm}
          onClose={() => setShowConfirm(false)}
          onConfirm={handleLogout}
          title="Sign Out?"
          message="Are you sure you want to sign out? You will need to sign in again to access your account."
          confirmLabel="Sign Out"
          cancelLabel="Cancel"
          tone="red"
        />
      </div>
    );
  }

  return (
    <button
      onClick={() => setShowConfirm(true)}
      className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold text-obligon-navy hover:bg-obligon-mist ${className}`}
      disabled={loggingOut}
    >
      <LogOut size={18} />
      <span>Sign Out</span>
    </button>
  );
}

export function SessionExpiryWarning({ onExtend, onLogout, timeRemaining }: { onExtend?: () => void; onLogout?: () => void; timeRemaining: number }) {
  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;

  return (
    <div className="fixed bottom-4 right-4 z-50 rounded-xl border border-obligon-border bg-white p-4 shadow-xl animate-slide-up">
      <div className="flex items-start gap-3">
        <div className="grid size-10 place-items-center rounded-full bg-[#fff3d8] text-[#9a6300]">
          <Clock size={20} />
        </div>
        <div className="flex-1">
          <p className="font-bold text-obligon-navy">Session expiring soon</p>
          <p className="mt-1 text-sm text-obligon-text">
            Your session will expire in {minutes}:{seconds.toString().padStart(2, "0")}.
          </p>
        </div>
        <button
          onClick={onExtend}
          className="flex-shrink-0 rounded-lg bg-obligon-green px-3 py-1 text-xs font-bold text-white"
        >
          Extend Session
        </button>
      </div>
    </div>
  );
}

export function SessionExpiredOverlay({ onReauth, onLogout }: { onReauth?: () => void; onLogout?: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-obligon-border bg-white p-6 shadow-xl">
        <div className="mx-auto grid size-16 place-items-center rounded-full bg-[#fff3d8] text-[#9a6300]">
          <Clock size={32} />
        </div>
        <h2 className="mt-6 text-center font-display text-2xl font-extrabold text-obligon-navy">
          Session Expired
        </h2>
        <p className="mt-3 text-center text-obligon-text">
          Your session has expired for security. Please sign in again to continue.
        </p>
        <div className="mt-6 flex gap-3">
          <button
            onClick={onLogout}
            className="flex-1 h-11 rounded-lg border border-obligon-border text-sm font-bold text-obligon-navy hover:bg-obligon-mist"
          >
            Sign Out
          </button>
          <button
            onClick={onReauth}
            className="flex-1 h-11 rounded-lg bg-obligon-green text-white font-bold"
          >
            Sign In Again
          </button>
        </div>
      </div>
    </div>
  );
}