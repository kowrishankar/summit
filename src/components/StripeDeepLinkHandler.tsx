import { useEffect } from 'react';
import { Linking } from 'react-native';
import { useStripe } from '@stripe/stripe-react-native';

/**
 * For 3D Secure / bank auth, Stripe opens a browser or SFSafariViewController that redirects to
 * `returnURL` (e.g. summit://stripe-redirect). This hands the URL to the native SDK so it can
 * finish the flow and dismiss the browser.
 */
export default function StripeDeepLinkHandler() {
  const { handleURLCallback } = useStripe();

  useEffect(() => {
    const onUrl = ({ url }: { url: string }) => {
      void handleURLCallback(url);
    };
    const sub = Linking.addEventListener('url', onUrl);
    void Linking.getInitialURL().then((url) => {
      if (url) void handleURLCallback(url);
    });
    return () => sub.remove();
  }, [handleURLCallback]);

  return null;
}
