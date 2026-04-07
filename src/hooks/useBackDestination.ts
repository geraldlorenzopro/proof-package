import { useEffect, useState } from 'react';

/**
 * Returns the correct "back" destination for tool headers.
 * If the user arrived via the Hub, returns the Hub URL.
 * Otherwise returns /hub (NER always operates within the Hub).
 */
export function useBackDestination(fallback = '/hub') {
  const [destination, setDestination] = useState(fallback);
  const [isHub, setIsHub] = useState(true);

  useEffect(() => {
    const hubReturn = sessionStorage.getItem('ner_hub_return');
    if (hubReturn) {
      setDestination(hubReturn);
    }
    // isHub is always true — NER always operates within the Hub context
  }, []);

  return { destination, isHub };
}
