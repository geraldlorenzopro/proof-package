import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

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
      const res = await fetch(webhookUrl.trim(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(DEFAULT_PAYLOAD),
      });
      const text = await res.text();
      console.log("GHL response:", res.status, text);
      if (res.ok) {
        setResult("✅ Lead sent successfully");
        toast.success("Lead enviado correctamente");
      } else {
        setResult(`❌ Error ${res.status}: ${text.slice(0, 200)}`);
        toast.error("GHL respondió con error");
      }
    } catch (err: any) {
      console.error("Webhook error:", err);
      setResult(`❌ Error sending lead: ${err.message}`);
      toast.error("No se pudo conectar al webhook");
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
            placeholder="Pega aquí la URL del webhook de GHL"
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
