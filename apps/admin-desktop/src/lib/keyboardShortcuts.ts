import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUIStore } from '@/stores/uiStore';

const routeMap: Record<string, string> = {
  d: '/dashboard',
  m: '/map',
  u: '/users',
  a: '/emergency',
  n: '/ndrrmc',
  r: '/reports',
  s: '/settings',
  l: '/audit',
  h: '/health',
};

export function useKeyboardShortcuts() {
  const navigate = useNavigate();
  const { closePanel, globalSearchOpen, setGlobalSearchOpen, openConfirmModal } = useUIStore();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closePanel();
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setGlobalSearchOpen(!globalSearchOpen);
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'E') {
        e.preventDefault();
        navigate('/emergency');
        return;
      }

      if (e.shiftKey && e.key === '?') {
        e.preventDefault();
        openConfirmModal({
          title: 'Keyboard Shortcuts',
          message:
            'D Dashboard | M Map | U Users | A Emergency | N NDRRMC | R Reports | S Settings | L Audit | H Health | Esc Close | Ctrl+K Search | Shift+? Help',
          confirmLabel: 'Got it',
          onConfirm: () => {},
        });
        return;
      }

      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      const key = e.key.toLowerCase();
      const route = routeMap[key];
      if (route) {
        e.preventDefault();
        navigate(route);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate, closePanel, globalSearchOpen, setGlobalSearchOpen, openConfirmModal]);
}
