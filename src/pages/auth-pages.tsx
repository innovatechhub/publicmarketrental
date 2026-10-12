import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { useAuth } from "@/features/auth/auth-context";
import { LoginForm, RegisterForm, ForgotPasswordForm, ResetPasswordForm } from "@/features/auth/forms";
import { isSupabaseConfigured } from "@/integrations/supabase/client";

export function LoginPage() {
  return (
    <div className="mx-auto w-full max-w-[376px] overflow-hidden rounded-lg bg-white shadow-[0_22px_55px_-30px_rgba(15,23,42,0.45)]">
      <div className="bg-gradient-to-br from-[#0aa073] to-[#19ba82] px-7 py-6 text-white">
        <h2 className="text-2xl font-bold">Sign In</h2>
        <p className="mt-2 text-sm font-semibold text-white/90">Access your market portal</p>
      </div>
      <div className="space-y-5 px-7 py-6">
        <LoginForm />
        {!isSupabaseConfigured ? (
          <p className="text-sm text-destructive">
            Supabase is not configured. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env`.
          </p>
        ) : null}
        <div className="border-t border-slate-200 pt-5 text-center">
          <Link className="text-sm font-semibold text-[#2045b8]" to="/forgot-password">
            Forgot password
          </Link>
          <p className="mt-4 text-xs text-slate-500">Don't have an account?</p>
          <Link
            className="mt-3 inline-flex h-9 w-full items-center justify-center rounded-md border border-[#00966f] text-sm font-bold text-[#00966f] transition hover:bg-emerald-50"
            to="/register"
          >
            Apply for Stall Rental
          </Link>
        </div>
      </div>
    </div>
  );
}

export function RegisterPage() {
  return (
    <div className="mx-auto w-full max-w-[596px] overflow-hidden rounded-lg bg-white shadow-[0_22px_55px_-30px_rgba(15,23,42,0.45)]">
      <div className="bg-gradient-to-br from-[#0aa073] to-[#18b982] px-8 py-6 text-white">
        <Link
          className="inline-flex items-center gap-2 text-sm font-bold text-white/80 transition hover:text-white"
          to="/login"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Login
        </Link>
        <h2 className="mt-5 text-2xl font-bold">Apply for Stall Rental</h2>
        <p className="mt-2 text-sm font-semibold text-white/90">Submit your application to rent a market stall</p>
      </div>
      <div className="px-8 py-6">
        <RegisterForm />
      </div>
    </div>
  );
}

export function ResetPasswordPage() {
  const { isAuthenticated, isBootstrapping } = useAuth();

  return (
    <div className="mx-auto w-full max-w-[376px] overflow-hidden rounded-lg bg-white shadow-[0_22px_55px_-30px_rgba(15,23,42,0.45)]">
      <div className="bg-gradient-to-br from-[#0aa073] to-[#18b982] px-7 py-6 text-white">
        <h2 className="text-2xl font-bold">Set New Password</h2>
        <p className="mt-2 text-sm font-semibold text-white/90">Choose a new password for your account</p>
      </div>
      <div className="space-y-5 px-7 py-6">
        {isBootstrapping ? (
          <p className="text-sm text-slate-500">Checking your reset link...</p>
        ) : isAuthenticated ? (
          <ResetPasswordForm />
        ) : (
          <>
            <p className="text-sm text-destructive">This password reset link is invalid or has expired.</p>
            <Link className="text-sm font-semibold text-[#2045b8]" to="/forgot-password">
              Request a new reset email
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

export function ForgotPasswordPage() {
  return (
    <div className="mx-auto w-full max-w-[376px] overflow-hidden rounded-lg bg-white shadow-[0_22px_55px_-30px_rgba(15,23,42,0.45)]">
      <div className="bg-gradient-to-br from-[#0aa073] to-[#18b982] px-7 py-6 text-white">
        <Link
          className="inline-flex items-center gap-2 text-sm font-bold text-white/80 transition hover:text-white"
          to="/login"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Login
        </Link>
        <h2 className="mt-4 text-2xl font-bold">Password Recovery</h2>
        <p className="mt-2 text-sm font-semibold text-white/90">Request a password reset email</p>
      </div>
      <div className="space-y-5 px-7 py-6">
        <ForgotPasswordForm />
      </div>
    </div>
  );
}
