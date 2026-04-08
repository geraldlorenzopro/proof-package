import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Returns the correct "back" destination for tool headers.
 * If the user arrived via the Hub, returns the Hub URL.
 * If on a public /tools/* route, returns /features.
 * Otherwise returns /hub (NER always operates within the Hub).
 */
export function useBackDestination(fallback = '/hub') {
  const location = useLocation();
  const isPublicTool = location.pathname.startsWith('/tools/');
  const defaultDest = isPublicTool ? '/features' : fallback;

  const [destination, setDestination] = useState(defaultDest);
  const [isHub, setIsHub] = useState(!isPublicTool);

  useEffect(() => {
    if (isPublicTool) {
      setDestination('/features');
      setIsHub(false);
      return;
    }
    const hubReturn = sessionStorage.getItem('ner_hub_return');
    if (hubReturn) {
      setDestination(hubReturn);
    }
    // isHub is true when not on public tool route
  }, [isPublicTool]);

  return { destination, isHub };
}
