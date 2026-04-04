import AdminAnalytics from "@/components/AdminAnalytics";

export default function AdminAnalyticsPage() {
  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Analytics</h1>
        <p className="text-sm text-white/40">Métricas de uso de la plataforma</p>
      </div>
      <AdminAnalytics />
    </div>
  );
}
