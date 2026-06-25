import { useEffect, useState } from 'react';
import { Download, MoreVertical, Share, X } from 'lucide-react';

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const DISMISS_KEY = 'pwa-install-dismissed-at';
const DISMISS_DURATION = 7 * 24 * 60 * 60 * 1000;

export function InstallAppPrompt() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [platformHelp, setPlatformHelp] = useState<'ios' | 'android' | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches;
    const iosStandalone = Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
    const recentlyDismissed = Date.now() - dismissedAt < DISMISS_DURATION;
    if (standalone || iosStandalone || recentlyDismissed) return;

    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const isIos = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (!isMobile) return;

    function handleInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
      setPlatformHelp(null);
      setVisible(true);
    }

    function handleInstalled() {
      localStorage.removeItem(DISMISS_KEY);
      setVisible(false);
      setInstallPrompt(null);
    }

    window.addEventListener('beforeinstallprompt', handleInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);

    const timer = window.setTimeout(() => {
      setPlatformHelp(isIos ? 'ios' : 'android');
      setVisible(true);
    }, 1500);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  }

  async function install() {
    if (!installPrompt) {
      setPlatformHelp(/iPhone|iPad|iPod/i.test(navigator.userAgent) ? 'ios' : 'android');
      return;
    }
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      localStorage.removeItem(DISMISS_KEY);
      setVisible(false);
    } else {
      setPlatformHelp('android');
      setVisible(true);
    }
    setInstallPrompt(null);
  }

  if (!visible) return null;

  const helpText =
    platformHelp === 'ios'
      ? 'No Safari, toque em Compartilhar e depois em Adicionar a Tela de Inicio.'
      : platformHelp === 'android'
        ? 'Abra o menu do navegador e toque em Instalar app ou Adicionar a tela inicial.'
        : 'Acesse suas parcelas como um aplicativo no celular.';

  return (
    <aside className="install-prompt" aria-label="Instalar aplicativo">
      <img src="/pwa-192.png" alt="" />
      <div>
        <strong>Instale o Cartao Parcelado</strong>
        <span>{helpText}</span>
      </div>
      {platformHelp ? (
        <div className="install-platform-hint">
          {platformHelp === 'ios' ? <Share size={18} /> : <MoreVertical size={18} />}
          {platformHelp === 'ios' ? 'Compartilhar' : 'Menu do navegador'}
        </div>
      ) : (
        <button className="install-button" type="button" onClick={install}>
          <Download size={18} />Instalar
        </button>
      )}
      <button className="install-close" type="button" aria-label="Fechar" onClick={dismiss}>
        <X size={18} />
      </button>
    </aside>
  );
}
