import { useEffect, useState } from 'react';

/**
 * Returns the correct "back" destination for tool headers.
 * If the user arrived via the Hub, returns the Hub URL.
 * Otherwise returns the default fallback (landing page).
 */
export function useBackDestination(fallback = '/') {
  const [destination, setDestination] = useState(fallback);
  const [isHub, setIsHub] = useState(false);

  useEffect(() => {
    const hubReturn = sessionStorage.getItem('ner_hub_return');
    if (hubReturn) {
      setDestination(hubReturn);
      setIsHub(true);
    }
  }, []);

  return { destination, isHub };
}
