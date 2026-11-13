import React, { useState } from 'react';
import { Eye, EyeOff, Moon, Sun, AlertCircle, Info } from 'lucide-react';
import { useTheme } from '../context/ThemeContext.tsx';
import { api } from '../services/api.ts';
import { AuthUser } from '../types/index.ts';
import { useThrottledSubmit } from '../hooks/useThrottledSubmit.ts';

interface LoginPageProps {
  onLoginSuccess: (user: AuthUser) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const { theme, toggleTheme } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotHelp, setShowForgotHelp] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { isSubmitting, run } = useThrottledSubmit({ minDisabledMs: 500, cooldownMs: 600 });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setErrorMessage('Please enter both your email and password.');
      return;
    }

    try {
      await run(async () => {
        const res = await api.auth.login({
          email: trimmedEmail,
          password,
        });
        onLoginSuccess(res.user);
      });
    } catch (err: any) {
      setErrorMessage(err?.message || 'Invalid email or password.');
    }
  };

  return (
    <div className="min-h-screen bg-[#F2F4F4] dark:bg-[#0F1113] text-[#14161A] dark:text-[#F2F4F5] flex items-center justify-center p-4 sm:p-6 lg:p-10 relative transition-colors duration-200 selection:bg-[#D4F56B] selection:text-[#14161A]">
      {/* Theme Toggle */}
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        className="fixed top-4 right-4 sm:top-6 sm:right-6 z-30 w-10 h-10 rounded-[14px] bg-white dark:bg-[#181B1F] border border-[#E3E6E8] dark:border-[#2A2F35] shadow-xs flex items-center justify-center text-[#14161A] dark:text-[#F6E7A1] hover:border-[#D7DBDF] dark:hover:border-[#373E47] active:scale-95 transition cursor-pointer"
      >
        {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </button>

      {/* Main Split Card Container (larger overall width & height) */}
      <div className="w-full max-w-[1200px] lg:min-h-[680px] bg-white dark:bg-[#181B1F] border border-[#E3E6E8] dark:border-[#2A2F35] rounded-[28px] sm:rounded-[34px] p-4 sm:p-6 lg:p-7 shadow-[0_12px_40px_rgba(20,22,26,0.07)] dark:shadow-[0_16px_48px_rgba(0,0,0,0.48)] grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-stretch relative overflow-hidden">
        {/* Top-Right Glowing Radial Gradient on Outer Card */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-28 -right-28 w-[420px] h-[420px] rounded-full bg-[radial-gradient(circle,rgba(212,245,107,0.42)_0%,rgba(146,226,179,0.28)_38%,rgba(169,200,250,0.16)_65%,transparent_80%)] dark:bg-[radial-gradient(circle,rgba(23,128,125,0.38)_0%,rgba(212,245,107,0.12)_45%,transparent_75%)] blur-2xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-28 -left-24 w-72 h-72 rounded-full bg-[#D4F56B]/20 dark:bg-[#D4F56B]/5 blur-3xl"
        />

        {/* LEFT PANEL: Signature Deep Teal Showcase Card with Top-Right Glow & Transparent Cartoon */}
        <section
          aria-label="Dashboard Highlights"
          className="lg:col-span-6 bg-[#17807D] dark:bg-[#146B69] rounded-[24px] sm:rounded-[28px] p-6 sm:p-8 lg:p-10 flex flex-col justify-between text-white relative overflow-hidden"
        >
          {/* Top-Right Glowing Gradient inside Left Teal Div */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-20 -right-20 w-[340px] h-[340px] rounded-full bg-[radial-gradient(circle,rgba(212,245,107,0.34)_0%,rgba(146,226,179,0.22)_42%,transparent_72%)] blur-2xl"
          />

          <div className="relative z-10">
            <h2 className="text-[24px] sm:text-[30px] lg:text-[38px] xl:text-[42px] font-bold leading-[1.14] tracking-[-0.02em] text-white text-balance max-w-[16ch]">
              Simplify poultry management with our dashboard
            </h2>
            <p className="mt-3 lg:mt-4 text-[14px] sm:text-[15px] lg:text-[16px] font-normal leading-relaxed text-white/85 max-w-[38ch]">
              Simplify your farm and shop management with our user friendly owner dashboard
            </p>
          </div>

          {/* Transparent 3D Illustration */}
          <div className="hidden lg:flex relative z-10 mt-4 items-end justify-center">
            <img
              src="/assets/aistudio/login3d_ef472a21.webp"
              alt="Owner managing poultry farm operations from the Check-In dashboard"
              referrerPolicy="no-referrer"
              className="w-full max-w-[420px] xl:max-w-[460px] h-auto max-h-[380px] xl:max-h-[410px] object-contain drop-shadow-[0_14px_24px_rgba(10,36,35,0.24)]"
            />
          </div>
        </section>

        {/* RIGHT PANEL: Clean Centered Login Form */}
        <main className="lg:col-span-6 flex flex-col justify-center px-2 py-4 sm:px-6 sm:py-8 lg:px-10 relative z-10">
          <div className="w-full max-w-[400px] mx-auto">
            {/* Brand Mark Lockup */}
            <div className="flex items-center justify-center gap-3">
              <img
                src="/assets/aistudio/check-in_ceb7ef49.webp"
                alt="Check-In Poultry Logo"
                referrerPolicy="no-referrer"
                className="w-10 h-10 rounded-[12px] object-cover border border-[#E3E6E8] dark:border-[#2A2F35] bg-[#F3F3F3]"
              />
              <span className="text-[20px] font-bold tracking-[-0.02em] text-[#14161A] dark:text-[#F2F4F5]">
                Check-In Poultry
              </span>
            </div>

            {/* Greeting */}
            <div className="text-center mt-6 mb-8">
              <h1 className="text-[28px] sm:text-[32px] font-bold tracking-[-0.02em] text-[#14161A] dark:text-[#F2F4F5]">
                Welcome Back
              </h1>
              <p className="mt-1.5 text-[14px] font-normal text-[#636B76] dark:text-[#8A929C]">
                Please Login to your account
              </p>
            </div>

            {/* Validation / Auth Error */}
            {errorMessage && (
              <div
                role="alert"
                className="mb-4 rounded-[12px] border border-rose-300 dark:border-rose-800/80 bg-rose-50 dark:bg-rose-950/40 px-3.5 py-2.5 flex items-start gap-2.5 text-xs text-rose-800 dark:text-rose-200"
              >
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <span className="font-medium leading-snug">{errorMessage}</span>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div>
                <label htmlFor="login-email" className="sr-only">
                  Email
                </label>
                <input
                  id="login-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                  disabled={isSubmitting}
                  className="w-full h-[52px] px-4 rounded-[14px] bg-[#F3F5F6] dark:bg-[#1F2328] border border-transparent focus:border-[#17807D] dark:focus:border-[#D4F56B] focus:bg-white dark:focus:bg-[#181B1F] text-sm font-normal text-[#14161A] dark:text-[#F2F4F5] placeholder:text-[#636B76] dark:placeholder:text-[#8A929C] focus:outline-none transition disabled:opacity-60"
                />
              </div>

              <div className="relative">
                <label htmlFor="login-password" className="sr-only">
                  Password
                </label>
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  disabled={isSubmitting}
                  className="w-full h-[52px] pl-4 pr-11 rounded-[14px] bg-[#F3F5F6] dark:bg-[#1F2328] border border-transparent focus:border-[#17807D] dark:focus:border-[#D4F56B] focus:bg-white dark:focus:bg-[#181B1F] text-sm font-normal text-[#14161A] dark:text-[#F2F4F5] placeholder:text-[#636B76] dark:placeholder:text-[#8A929C] focus:outline-none transition disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-[#636B76] dark:text-[#8A929C] hover:text-[#14161A] dark:hover:text-[#F2F4F5] transition cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <div className="flex justify-end pt-0.5">
                <button
                  type="button"
                  onClick={() => setShowForgotHelp((prev) => !prev)}
                  className="text-xs font-medium text-[#636B76] dark:text-[#8A929C] hover:text-[#14161A] dark:hover:text-[#F2F4F5] transition cursor-pointer"
                >
                  Forgot Password
                </button>
              </div>

              {showForgotHelp && (
                <div className="rounded-[12px] border border-[#E3E6E8] dark:border-[#2A2F35] bg-[#F3F5F6] dark:bg-[#1F2328] px-3.5 py-2.5 flex items-start gap-2.5 text-xs text-[#4A515B] dark:text-[#A3AAB3]">
                  <Info className="w-4 h-4 text-[#17807D] dark:text-[#D4F56B] shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    Please contact your shop administrator to reset your owner account password in the database.
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-[52px] mt-1 rounded-[14px] bg-[#D4F56B] hover:bg-[#C9EE55] disabled:opacity-60 disabled:cursor-not-allowed text-[#14161A] font-bold text-sm tracking-wide shadow-xs dark:shadow-none active:scale-[0.99] transition cursor-pointer"
              >
                {isSubmitting ? 'Logging in...' : 'Login'}
              </button>
            </form>

            {/* Footer Separator */}
            <div className="mt-7 sm:mt-8 flex items-center gap-3">
              <div className="h-px flex-1 bg-[#E3E6E8] dark:bg-[#2A2F35]" />
              <span className="text-xs text-[#636B76] dark:text-[#8A929C] whitespace-nowrap">
                Al-Madina Poultry Traders
              </span>
              <div className="h-px flex-1 bg-[#E3E6E8] dark:bg-[#2A2F35]" />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};
