import React, { useState } from 'react';
import {
  Download,
  Smartphone,
  Share,
  MoreVertical,
  PlusSquare,
  CheckCircle2,
  ExternalLink,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { usePWAInstall } from '../../hooks/usePWAInstall.ts';

export type PWAInstallVariant = 'pill' | 'mobile-icon' | 'menu-item' | 'card';

interface PWAInstallButtonProps {
  variant?: PWAInstallVariant;
  onActionComplete?: () => void;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'pill',
  onActionComplete,
}) => {
  const { isInstallable, isInstalled, isIOS, inIframe, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);
  const [installing, setInstalling] = useState(false);

  const handleInstallClick = async () => {
    if (isInstallable) {
      setInstalling(true);
      try {
        await install();
      } finally {
        setInstalling(false);
        onActionComplete?.();
      }
      return;
    }
    setShowGuide(true);
  };

  if (isInstalled && variant !== 'card') {
    return null;
  }

  const guideModal = (
    <AnimatePresence>
      {showGuide && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.16 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="pwa-install-guide-title"
            className="w-full max-w-md bg-white dark:bg-[#181B1F] rounded-[22px] border border-[#E3E6E8] dark:border-[#2A2F35] p-6 shadow-2xl text-left"
          >
            <div className="flex items-start justify-between gap-3 pb-4 border-b border-[#E3E6E8] dark:border-[#2A2F35]">
              <div className="flex items-center gap-3">
                <img
                  src="/assets/aistudio/check-in_ceb7ef49.webp"
                  alt="Al-Madina Poultry Logo"
                  className="w-11 h-11 rounded-[14px] object-cover border border-[#E3E6E8] dark:border-[#2A2F35] bg-[#F3F3F3] shrink-0"
                />
                <div>
                  <h3
                    id="pwa-install-guide-title"
                    className="font-bold text-sm text-[#14161A] dark:text-[#F2F4F5]"
                  >
                    Add Al-Madina to Home Screen
                  </h3>
                  <p className="text-xs text-[#636B76] dark:text-[#8A929C]">
                    Quick launch like a mobile & desktop app
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                aria-label="Close install guide"
                className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-[#636B76] dark:text-[#8A929C] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-4 space-y-3 text-xs text-[#4A515B] dark:text-[#A3AAB3] leading-relaxed">
              {inIframe && (
                <div className="p-3 rounded-[14px] bg-[#F8F9FA] dark:bg-[#20242A] border border-[#E3E6E8] dark:border-[#2A2F35] space-y-2">
                  <div className="font-semibold text-[#14161A] dark:text-[#F2F4F5]">
                    Open in your own browser tab to install
                  </div>
                  <p>
                    Browsers only show the direct &ldquo;Install&rdquo; button when the app is open in its own tab instead of an embedded preview.
                  </p>
                  <a
                    href={typeof window !== 'undefined' ? window.location.href : '/'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#D4F56B] text-[#14161A] font-bold text-xs hover:bg-[#C9EE55] transition"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open App Tab</span>
                  </a>
                </div>
              )}

              {isIOS ? (
                <ol className="space-y-2.5">
                  <li className="flex items-start gap-2.5">
                    <span className="w-6 h-6 rounded-full bg-[#EDEEEF] dark:bg-[#272C33] text-[#14161A] dark:text-[#F2F4F5] font-bold flex items-center justify-center shrink-0 text-[11px]">
                      1
                    </span>
                    <span>
                      Tap the <strong className="text-[#14161A] dark:text-white inline-flex items-center gap-1"><Share className="w-3.5 h-3.5 inline" /> Share</strong> button in your Safari toolbar.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-6 h-6 rounded-full bg-[#EDEEEF] dark:bg-[#272C33] text-[#14161A] dark:text-[#F2F4F5] font-bold flex items-center justify-center shrink-0 text-[11px]">
                      2
                    </span>
                    <span>
                      Scroll down and tap <strong className="text-[#14161A] dark:text-white inline-flex items-center gap-1"><PlusSquare className="w-3.5 h-3.5 inline" /> Add to Home Screen</strong>, then tap <strong className="text-[#14161A] dark:text-white">Add</strong>.
                    </span>
                  </li>
                </ol>
              ) : (
                <ol className="space-y-2.5">
                  <li className="flex items-start gap-2.5">
                    <span className="w-6 h-6 rounded-full bg-[#EDEEEF] dark:bg-[#272C33] text-[#14161A] dark:text-[#F2F4F5] font-bold flex items-center justify-center shrink-0 text-[11px]">
                      1
                    </span>
                    <span>
                      On <strong className="text-[#14161A] dark:text-white">Android Chrome</strong>, tap <strong className="text-[#14161A] dark:text-white inline-flex items-center gap-0.5"><MoreVertical className="w-3.5 h-3.5 inline" /> Menu</strong> in the top corner and choose <strong className="text-[#14161A] dark:text-white">Add to home screen</strong> or <strong className="text-[#14161A] dark:text-white">Install app</strong>.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-6 h-6 rounded-full bg-[#EDEEEF] dark:bg-[#272C33] text-[#14161A] dark:text-[#F2F4F5] font-bold flex items-center justify-center shrink-0 text-[11px]">
                      2
                    </span>
                    <span>
                      On <strong className="text-[#14161A] dark:text-white">Desktop Chrome / Edge</strong>, click the <strong className="text-[#14161A] dark:text-white">Install</strong> icon in the address bar.
                    </span>
                  </li>
                </ol>
              )}
            </div>

            <div className="pt-3 border-t border-[#E3E6E8] dark:border-[#2A2F35] flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowGuide(false);
                  onActionComplete?.();
                }}
                className="min-h-[40px] px-5 py-2 rounded-full bg-[#D4F56B] text-[#14161A] font-bold text-xs hover:bg-[#C9EE55] transition cursor-pointer"
              >
                Got It
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  if (variant === 'mobile-icon') {
    return (
      <>
        <button
          type="button"
          onClick={() => void handleInstallClick()}
          disabled={installing}
          aria-label={isInstallable ? 'Install App' : 'Add to Home Screen'}
          title={isInstallable ? 'Install App' : 'Add to Home Screen'}
          className={`w-11 h-11 rounded-full border shadow-[0_1px_2px_rgba(20,22,26,0.04),0_6px_18px_rgba(20,22,26,0.06)] flex items-center justify-center active:scale-95 transition cursor-pointer ${
            isInstallable
              ? 'bg-[#D4F56B] border-[#C9EE55] text-[#14161A]'
              : 'bg-white dark:bg-[#181B1F] border-[#E3E6E8] dark:border-[#2A2F35] text-[#14161A] dark:text-white'
          }`}
        >
          <Download className="w-4 h-4 stroke-[2.2]" />
        </button>
        {guideModal}
      </>
    );
  }

  if (variant === 'menu-item') {
    return (
      <>
        <button
          type="button"
          onClick={() => void handleInstallClick()}
          disabled={installing}
          className="w-full text-left px-2.5 py-2 text-xs rounded-lg hover:bg-[#F3F5F6] dark:hover:bg-[#1F2328] font-semibold text-[#14161A] dark:text-[#F2F4F5] flex items-center justify-between gap-2 transition cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <Download className="w-3.5 h-3.5 text-[#2FB67C]" />
            <span>{isInstallable ? 'Install App' : 'Add to Home Screen'}</span>
          </span>
          {isInstallable && (
            <span className="px-1.5 py-0.5 rounded-full bg-[#D4F56B] text-[#14161A] text-[10px] font-bold">
              Quick
            </span>
          )}
        </button>
        {guideModal}
      </>
    );
  }

  if (variant === 'card') {
    return (
      <>
        <div className="bg-white dark:bg-[#181B1F] border border-[#E3E6E8] dark:border-[#2A2F35] rounded-[20px] p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <img
              src="/assets/aistudio/check-in_ceb7ef49.webp"
              alt="Al-Madina Poultry App Icon"
              className="w-12 h-12 rounded-[14px] object-cover border border-[#E3E6E8] dark:border-[#2A2F35] bg-[#F3F3F3] shrink-0"
            />
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#14161A] dark:text-[#F2F4F5]">
                Install App / Home Screen
              </h3>
              <p className="text-xs text-[#636B76] dark:text-[#8A929C] mt-0.5">
                {isInstalled
                  ? 'Already running as an installed home-screen app.'
                  : 'Add Al-Madina Poultry to your phone or computer for fast full-screen launch.'}
              </p>
            </div>
          </div>

          {isInstalled ? (
            <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#D4F56B]/30 text-[#14161A] dark:text-[#D4F56B] text-xs font-bold shrink-0">
              <CheckCircle2 className="w-4 h-4 text-[#2FB67C]" />
              <span>Installed</span>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => void handleInstallClick()}
              disabled={installing}
              className="min-h-[42px] px-5 py-2 text-xs font-bold rounded-full bg-[#D4F56B] text-[#14161A] hover:bg-[#C9EE55] disabled:opacity-50 transition flex items-center justify-center gap-2 shadow-xs shrink-0 cursor-pointer"
            >
              {isInstallable ? (
                <Download className="w-4 h-4" />
              ) : (
                <Smartphone className="w-4 h-4" />
              )}
              <span>
                {installing
                  ? 'Installing...'
                  : isInstallable
                  ? 'Install App Now'
                  : 'Add to Home Screen'}
              </span>
            </button>
          )}
        </div>
        {guideModal}
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void handleInstallClick()}
        disabled={installing}
        title={isInstallable ? 'Install App' : 'Add to Home Screen'}
        className={`h-10 px-3.5 rounded-full border shadow-[0_1px_2px_rgba(20,22,26,0.04),0_8px_24px_rgba(20,22,26,0.06)] flex items-center gap-1.5 text-xs font-bold transition cursor-pointer ${
          isInstallable
            ? 'bg-[#D4F56B] border-[#C9EE55] text-[#14161A] hover:bg-[#C9EE55]'
            : 'bg-white dark:bg-[#181B1F] border-[#E3E6E8] dark:border-[#2A2F35] text-[#14161A] dark:text-[#F2F4F5] hover:bg-[#F3F5F6] dark:hover:bg-[#1F2328]'
        }`}
      >
        <Download className="w-3.5 h-3.5" />
        <span className="hidden 2xl:inline">
          {isInstallable ? 'Install App' : 'Add App'}
        </span>
      </button>
      {guideModal}
    </>
  );
};
