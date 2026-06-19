import { useEffect, useState } from 'react';
import { Download, Share, X } from 'lucide-react';

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const DISMISS_KEY = 'pwa-install-dismissed';

export function InstallAppPrompt() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches;
    const iosStandalone = Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    if (standalone || iosStandalone || localStorage.getItem(DISMISS_KEY) === 'true') return;

    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const isIos = /iPhone|iPad|iPod/i.test(navigator.userAgent);

    function handleInstallPrompt(event: Event) {
      if (!isMobile) return;
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
      setVisible(true);
    }

    window.addEventListener('beforeinstallprompt', handleInstallPrompt);

    if (isMobile && isIos) {
      const timer = window.setTimeout(() => {
        setShowIosHelp(true);
        setVisible(true);
      }, 1200);
      return () => {
        window.clearTimeout(timer);
        window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
      };
    }

    return () => window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, 'true');
    setVisible(false);
  }

  async function install() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === 'accepted') setVisible(false);
    setInstallPrompt(null);
  }

  if (!visible) return null;

  return (
    <aside className="install-prompt" aria-label="Instalar aplicativo">
      <img src="/pwa-192.png" alt="" />
      <div>
        <strong>Instale o Cartao Parcelado</strong>
        <span>
          {showIosHelp
            ? 'Toque em Compartilhar e depois em Adicionar a Tela de Inicio.'
            : 'Acesse suas parcelas como um aplicativo no celular.'}
        </span>
      </div>
      {showIosHelp ? (
        <div className="install-ios-hint"><Share size={18} />Compartilhar</div>
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
