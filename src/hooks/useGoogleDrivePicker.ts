import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

interface PickedFile {
  id: string;
  name: string;
  mimeType: string;
  url: string;
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

export function useGoogleDrivePicker(onFilesPicked: (files: File[]) => void) {
  const [loading, setLoading] = useState(false);
  const credentialsRef = useRef<{ apiKey: string; clientId: string } | null>(null);
  const tokenClientRef = useRef<any>(null);

  // Load credentials from backend
  const getCredentials = useCallback(async () => {
    if (credentialsRef.current) return credentialsRef.current;

    const { data, error } = await supabase.functions.invoke('get-google-credentials');
    if (error || !data?.apiKey) {
      console.error('Failed to get Google credentials:', error);
      return null;
    }
    credentialsRef.current = data;
    return data;
  }, []);

  // Load Google scripts
  const loadGoogleScripts = useCallback(async () => {
    await Promise.all([
      loadScript('https://apis.google.com/js/api.js'),
      loadScript('https://accounts.google.com/gsi/client'),
    ]);

    await new Promise<void>((resolve) => {
      window.gapi.load('picker', resolve);
    });
  }, []);

  const openPicker = useCallback(async () => {
    setLoading(true);
    try {
      const creds = await getCredentials();
      if (!creds) {
        alert('No se pudieron obtener las credenciales de Google. Intenta de nuevo.');
        setLoading(false);
        return;
      }

      await loadGoogleScripts();

      // Create token client for OAuth
      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: creds.clientId,
        scope: 'https://www.googleapis.com/auth/drive.readonly',
        callback: async (tokenResponse: any) => {
          if (tokenResponse.error) {
            console.error('OAuth error:', tokenResponse);
            setLoading(false);
            return;
          }

          const accessToken = tokenResponse.access_token;

          // Build and show picker
          const picker = new window.google.picker.PickerBuilder()
            .addView(window.google.picker.ViewId.DOCS_IMAGES_AND_VIDEOS)
            .addView(window.google.picker.ViewId.DOCUMENTS)
            .enableFeature(window.google.picker.Feature.MULTISELECT_ENABLED)
            .setOAuthToken(accessToken)
            .setDeveloperKey(creds.apiKey)
            .setCallback(async (data: any) => {
              if (data.action === window.google.picker.Action.PICKED) {
                const files: File[] = [];
                for (const doc of data.docs) {
                  try {
                    const response = await fetch(
                      `https://www.googleapis.com/drive/v3/files/${doc.id}?alt=media`,
                      { headers: { Authorization: `Bearer ${accessToken}` } }
                    );
                    const blob = await response.blob();
                    const file = new File([blob], doc.name, { type: doc.mimeType });
                    files.push(file);
                  } catch (err) {
                    console.error('Error downloading file:', doc.name, err);
                  }
                }
                if (files.length > 0) {
                  onFilesPicked(files);
                }
              }
              setLoading(false);
            })
            .build();

          picker.setVisible(true);
        },
      });

      tokenClient.requestAccessToken({ prompt: 'consent' });
    } catch (err) {
      console.error('Google Picker error:', err);
      setLoading(false);
    }
  }, [getCredentials, loadGoogleScripts, onFilesPicked]);

  return { openPicker, loading };
}
