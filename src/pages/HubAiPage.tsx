import HubAgentTeam from "@/components/hub/HubAgentTeam";

export default function HubAiPage() {
  const accountId = (() => {
    try {
      const raw = sessionStorage.getItem("ner_hub_data");
      return raw ? JSON.parse(raw).account_id : null;
    } catch { return null; }
  })();

  const plan = (() => {
    try {
      const raw = sessionStorage.getItem("ner_hub_data");
      return raw ? JSON.parse(raw).plan : "essential";
    } catch { return "essential"; }
  })();

  if (!accountId) return null;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-foreground">Equipo AI</h1>
        <p className="text-sm text-muted-foreground">Agentes inteligentes y herramientas especializadas</p>
      </div>
      <HubAgentTeam accountId={accountId} plan={plan} />
    </div>
  );
}
