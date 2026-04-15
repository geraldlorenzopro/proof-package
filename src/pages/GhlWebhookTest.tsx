import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const DEFAULT_PAYLOAD = {
  first_name: "Test",
  last_name: "User",
  phone: "9549227788",
  email: "test@example.com",
  message: "Testing webhook integration",
};

export default function GhlWebhookTest() {
  const [webhookUrl, setWebhookUrl] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const sendTestLead = async () => {
    if (!webhookUrl.trim()) {
      toast.error("Pega la URL del webhook primero");
      return;
    }
    setSending(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("test-webhook-proxy", {
        body: { webhook_url: webhookUrl.trim(), payload: DEFAULT_PAYLOAD },
      });

      if (error) throw error;

      console.log("Proxy response:", data);
      if (data.ok) {
        setResult(`✅ Lead sent successfully (status ${data.status})`);
        toast.success("Lead enviado correctamente");
      } else if (data.error) {
        setResult(`❌ Error: ${data.error}`);
        toast.error("Error en el webhook");
      } else {
        setResult(`❌ Error ${data.status}: ${data.body?.slice(0, 200)}`);
        toast.error("GHL respondió con error");
      }
    } catch (err: any) {
      console.error("Webhook error:", err);
      setResult(`❌ Error: ${err.message}`);
      toast.error("No se pudo enviar");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>GHL Webhook Test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="Pega aquí la URL del webhook"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
          />
          <pre className="text-xs bg-muted p-3 rounded overflow-auto">
            {JSON.stringify(DEFAULT_PAYLOAD, null, 2)}
          </pre>
          <Button onClick={sendTestLead} disabled={sending} className="w-full">
            {sending ? "Sending…" : "Send Test Lead"}
          </Button>
          {result && (
            <p className={`text-sm font-medium ${result.startsWith("✅") ? "text-green-600" : "text-red-600"}`}>
              {result}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
