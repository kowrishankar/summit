import * as React from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';

/** Resolve ref target the same way @react-navigation/native useScrollToTop does. */
function getScrollableNode(ref: React.RefObject<unknown>) {
  const cur = ref.current as Record<string, unknown> | null;
  if (cur == null) return null;
  if (
    'scrollToTop' in cur ||
    'scrollTo' in cur ||
    'scrollToOffset' in cur ||
    'scrollResponderScrollTo' in cur
  ) {
    return cur;
  }
  if (typeof cur.getScrollResponder === 'function') {
    return cur.getScrollResponder() as Record<string, unknown>;
  }
  if (typeof cur.getNode === 'function') {
    return cur.getNode() as Record<string, unknown>;
  }
  return cur;
}

/**
 * Scroll to top when a bottom tab fires `tabPress` while this screen is focused.
 * Unlike `useScrollToTop`, this does not require being the first route in a stack
 * (needed for SalesList when InvoicesList is below it in the stack).
 */
export function useTabBarScrollToTop(ref: React.RefObject<unknown>) {
  const navigation = useNavigation();
  const route = useRoute();

  React.useEffect(() => {
    type TabNav = {
      addListener: (e: string, fn: (ev: { defaultPrevented?: boolean }) => void) => () => void;
    };
    const tabNavigations: TabNav[] = [];
    // Walk ancestors to find bottom tab navigator(s); ref typing is loose like useScrollToTop internals.
    let current: TabNav & { getState?: () => { type?: string }; getParent?: () => unknown } = navigation as TabNav & {
      getState?: () => { type?: string };
      getParent?: () => unknown;
    };
    while (current) {
      const st = current.getState?.();
      if (st?.type === 'tab') {
        tabNavigations.push(current);
      }
      const parent = current.getParent?.();
      if (!parent || typeof parent !== 'object') break;
      current = parent as TabNav & { getState?: () => { type?: string }; getParent?: () => unknown };
    }
    if (tabNavigations.length === 0) return undefined;

    const unsubscribers = tabNavigations.map((tab) =>
      tab.addListener('tabPress' as never, (e: { defaultPrevented?: boolean }) => {
        requestAnimationFrame(() => {
          if (e.defaultPrevented || !navigation.isFocused()) return;
          const scrollable = getScrollableNode(ref);
          if (!scrollable) return;
          if ('scrollToTop' in scrollable && typeof scrollable.scrollToTop === 'function') {
            (scrollable.scrollToTop as () => void)();
          } else if ('scrollTo' in scrollable && typeof scrollable.scrollTo === 'function') {
            (scrollable.scrollTo as (o: { y: number; animated: boolean }) => void)({ y: 0, animated: true });
          } else if ('scrollToOffset' in scrollable && typeof scrollable.scrollToOffset === 'function') {
            (scrollable.scrollToOffset as (o: { offset: number; animated: boolean }) => void)({
              offset: 0,
              animated: true,
            });
          } else if (
            'scrollResponderScrollTo' in scrollable &&
            typeof scrollable.scrollResponderScrollTo === 'function'
          ) {
            (scrollable.scrollResponderScrollTo as (o: { y: number; animated: boolean }) => void)({
              y: 0,
              animated: true,
            });
          }
        });
      })
    );

    return () => {
      unsubscribers.forEach((u) => u());
    };
  }, [navigation, ref, route.key]);
}
