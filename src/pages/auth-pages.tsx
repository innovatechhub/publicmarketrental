import type { ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { BriefcaseBusiness, ChevronLeft, UserRound } from "lucide-react";
import { LoginForm, RegisterForm, ForgotPasswordForm } from "@/features/auth/forms";
import { isSupabaseConfigured } from "@/integrations/supabase/client";

export function LoginPage() {
  const [searchParams] = useSearchParams();
  const portal = searchParams.get("portal") === "vendor" ? "vendor" : searchParams.get("portal") === "admin" ? "admin" : null;

  if (!portal) {
    return (
      <div className="mx-auto grid max-w-[640px] gap-7 sm:grid-cols-2">
        <RoleCard
          description="Full system access for market management"
          details={["Manage all stalls", "Process applications", "View reports & analytics"]}
          icon={<UserRound className="h-9 w-9" />}
          title="Administrator"
          to="/login?portal=admin"
          variant="admin"
        />
        <RoleCard
          description="Access your stall and payment information"
          details={["View your stall details", "Check payment status", "Submit applications"]}
          icon={<BriefcaseBusiness className="h-9 w-9" />}
          title="Vendor/Renter"
          to="/login?portal=vendor"
          variant="vendor"
        />
      </div>
    );
  }

  const isVendor = portal === "vendor";

  return (
    <div className="mx-auto w-full max-w-[376px] overflow-hidden rounded-lg bg-white shadow-[0_22px_55px_-30px_rgba(15,23,42,0.45)]">
      <div className="bg-gradient-to-br from-[#0aa073] to-[#19ba82] px-7 py-6 text-white">
        <Link
          className="inline-flex items-center gap-2 text-sm font-bold text-white/80 transition hover:text-white"
          to="/login"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </Link>
        <h2 className="mt-4 text-2xl font-bold">{isVendor ? "Vendor Login" : "Administrator Login"}</h2>
        <p className="mt-2 text-sm font-semibold text-white/90">
          {isVendor ? "Access your stall information" : "Access market management tools"}
        </p>
      </div>
      <div className="space-y-5 px-7 py-6">
      <LoginForm portal={portal} />
      {!isSupabaseConfigured ? (
        <p className="text-sm text-destructive">
          Supabase is not configured. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env`.
        </p>
      ) : null}
        <div className="border-t border-slate-200 pt-5 text-center">
          <Link className="text-sm font-semibold text-[#2045b8]" to="/forgot-password">
          Forgot password
        </Link>
          {isVendor ? (
            <>
              <p className="mt-4 text-xs text-slate-500">Don't have an account?</p>
              <Link
                className="mt-3 inline-flex h-9 w-full items-center justify-center rounded-md border border-[#00966f] text-sm font-bold text-[#00966f] transition hover:bg-emerald-50"
                to="/register"
              >
                Apply for Stall Rental
              </Link>
              <p className="mt-2 text-xs text-slate-500">Demo credentials:</p>
              <p className="text-[11px] text-slate-400">vendor@culasi.gov.ph / culasi123</p>
            </>
          ) : (
            <p className="mt-3 text-[11px] text-slate-400">admin@culasi.gov.ph / culasi123</p>
          )}
        </div>
      </div>
    </div>
  );
}

function RoleCard({
  description,
  details,
  icon,
  title,
  to,
  variant,
}: {
  description: string;
  details: string[];
  icon: ReactNode;
  title: string;
  to: string;
  variant: "admin" | "vendor";
}) {
  const isAdmin = variant === "admin";

  return (
    <Link
      className={`flex min-h-[290px] flex-col items-center justify-center rounded-lg px-8 py-9 text-center text-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl ${
        isAdmin
          ? "bg-gradient-to-br from-[#294cc2] to-[#3c83f0]"
          : "bg-gradient-to-br from-[#0aa073] to-[#19b783]"
      }`}
      to={to}
    >
      <span className="flex h-[58px] w-[58px] items-center justify-center rounded-full bg-white/20">
        {icon}
      </span>
      <h2 className="mt-7 text-2xl font-bold">{title}</h2>
      <p className="mt-4 max-w-[14rem] text-sm font-bold leading-6 text-white/90">{description}</p>
      <ul className="mt-6 space-y-1 text-xs font-semibold text-white/80">
        {details.map((item) => (
          <li key={item}>• {item}</li>
        ))}
      </ul>
    </Link>
  );
}

export function RegisterPage() {
  return (
    <div className="mx-auto w-full max-w-[596px] overflow-hidden rounded-lg bg-white shadow-[0_22px_55px_-30px_rgba(15,23,42,0.45)]">
      <div className="bg-gradient-to-br from-[#0aa073] to-[#18b982] px-8 py-6 text-white">
        <Link
          className="inline-flex items-center gap-2 text-sm font-bold text-white/80 transition hover:text-white"
          to="/login?portal=vendor"
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

export function ForgotPasswordPage() {
  return (
    <div className="mx-auto w-full max-w-[376px] overflow-hidden rounded-lg bg-white shadow-[0_22px_55px_-30px_rgba(15,23,42,0.45)]">
      <div className="bg-gradient-to-br from-[#0aa073] to-[#18b982] px-7 py-6 text-white">
        <Link
          className="inline-flex items-center gap-2 text-sm font-bold text-white/80 transition hover:text-white"
          to="/login?portal=vendor"
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
