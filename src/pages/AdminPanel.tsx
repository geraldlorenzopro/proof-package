import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Plus, Users, Building2, Loader2, BarChart3, Link2, Copy, Check, Pencil } from 'lucide-react';
import AdminAnalytics from '@/components/AdminAnalytics';

interface NerAccount {
  id: string;
  account_name: string;
  plan: string;
  max_users: number;
  is_active: boolean;
  phone: string | null;
  ghl_contact_id: string | null;
  created_at: string;
}

export default function AdminPanel() {
  const [accounts, setAccounts] = useState<NerAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    account_name: '',
    email: '',
    phone: '',
    plan: 'essential' as string,
    ghl_contact_id: '',
  });
  const [editingGhl, setEditingGhl] = useState<string | null>(null);
  const [ghlInput, setGhlInput] = useState('');
  const [savingGhl, setSavingGhl] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkAdminAccess();
  }, []);

  async function checkAdminAccess() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { sessionStorage.setItem('ner_auth_redirect', window.location.pathname); navigate('/auth', { replace: true }); return; }

    const { data: isOwner } = await supabase.rpc('has_account_role', { _user_id: user.id, _role: 'owner' });
    const { data: isAdmin } = await supabase.rpc('has_account_role', { _user_id: user.id, _role: 'admin' });

    if (!isOwner && !isAdmin) {
      navigate('/dashboard');
      toast({ title: 'Acceso denegado', description: 'No tienes permisos de administrador.', variant: 'destructive' });
      return;
    }

    loadAccounts();
  }

  async function loadAccounts() {
    const { data } = await supabase
      .from('ner_accounts')
      .select('*')
      .order('created_at', { ascending: false });

    setAccounts(data || []);
    setLoading(false);
  }

  async function handleCreate() {
    if (!form.account_name || !form.email) {
      toast({ title: 'Campos requeridos', description: 'Nombre y email son obligatorios.', variant: 'destructive' });
      return;
    }

    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('provision-account', {
        body: {
          account_name: form.account_name,
          email: form.email,
          phone: form.phone || undefined,
          plan: form.plan,
          ghl_contact_id: form.ghl_contact_id || undefined,
          source: 'admin',
        },
      });

      if (error) throw error;

      if (data?.error) {
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      } else {
        if (data.temp_password && navigator.clipboard) {
          await navigator.clipboard.writeText(data.temp_password);
          setTimeout(() => {
            navigator.clipboard.writeText('').catch(() => {});
          }, 30000);
          toast({
            title: 'Cuenta creada',
            description: '🔐 Contraseña temporal copiada. Pégala en un lugar seguro — el portapapeles se borrará en 30 segundos.',
            duration: 10000,
          });
        } else {
          toast({ title: 'Cuenta creada', description: 'Cuenta creada exitosamente.' });
        }
        setForm({ account_name: '', email: '', phone: '', plan: 'essential', ghl_contact_id: '' });
        setShowForm(false);
        loadAccounts();
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Error al crear cuenta', variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  }

  const planColors: Record<string, string> = {
    essential: 'bg-muted text-muted-foreground',
    professional: 'bg-jarvis/20 text-jarvis',
    elite: 'bg-accent/20 text-accent',
  };

  return (
    <div className="min-h-screen bg-background grid-bg">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => navigate('/dashboard')} className="p-2 rounded-lg hover:bg-secondary transition-colors">
            <ArrowLeft className="w-5 h-5 text-muted-foreground" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Panel de Administración</h1>
            <p className="text-sm text-muted-foreground">Cuentas, analytics y control de plataforma</p>
          </div>
        </div>

        <Tabs defaultValue="accounts" className="space-y-6">
          <TabsList className="bg-secondary/50 border border-border">
            <TabsTrigger value="accounts" className="data-[state=active]:bg-jarvis/20 data-[state=active]:text-jarvis">
              <Building2 className="w-4 h-4 mr-2" />
              Cuentas
            </TabsTrigger>
            <TabsTrigger value="analytics" className="data-[state=active]:bg-jarvis/20 data-[state=active]:text-jarvis">
              <BarChart3 className="w-4 h-4 mr-2" />
              Analytics
            </TabsTrigger>
          </TabsList>

          {/* Accounts Tab */}
          <TabsContent value="accounts" className="space-y-6">
            <div className="flex justify-end">
              <Button
                onClick={() => setShowForm(!showForm)}
                className="bg-jarvis/20 text-jarvis border border-jarvis/30 hover:bg-jarvis/30"
              >
                <Plus className="w-4 h-4 mr-2" />
                Nueva Cuenta
              </Button>
            </div>

            {showForm && (
              <Card className="glow-border">
                <CardHeader>
                  <CardTitle className="text-lg text-jarvis font-display tracking-wide">Crear Cuenta Manual</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Nombre de cuenta *</Label>
                      <Input value={form.account_name} onChange={e => setForm(p => ({ ...p, account_name: e.target.value }))} placeholder="Firma Legal XYZ" />
                    </div>
                    <div className="space-y-2">
                      <Label>Email *</Label>
                      <Input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="usuario@firma.com" />
                    </div>
                    <div className="space-y-2">
                      <Label>Teléfono</Label>
                      <Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="+1 555 123 4567" />
                    </div>
                    <div className="space-y-2">
                      <Label>Plan</Label>
                      <Select value={form.plan} onValueChange={v => setForm(p => ({ ...p, plan: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="essential">Essential ($29.99)</SelectItem>
                          <SelectItem value="professional">Professional ($59.99)</SelectItem>
                          <SelectItem value="elite">Elite ($99.99)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label>NER Contact ID</Label>
                      <Input value={form.ghl_contact_id} onChange={e => setForm(p => ({ ...p, ghl_contact_id: e.target.value }))} placeholder="l9G97rwZhv1OFxQjAg5U (opcional)" />
                      <p className="text-[10px] text-muted-foreground">Se usa para generar el enlace seguro del Hub</p>
                    </div>
                  </div>
                  <div className="flex justify-end gap-3 pt-2">
                    <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
                    <Button onClick={handleCreate} disabled={creating} className="gradient-gold text-accent-foreground">
                      {creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Crear Cuenta
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-jarvis" />
              </div>
            ) : accounts.length === 0 ? (
              <Card className="text-center py-12">
                <Building2 className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground">No hay cuentas creadas aún</p>
              </Card>
            ) : (
              <div className="space-y-3">
                {accounts.map(acc => (
                  <Card key={acc.id} className="glow-border hover:border-jarvis/30 transition-colors">
                    <CardContent className="py-4 px-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-jarvis/10 border border-jarvis/20 flex items-center justify-center">
                            <Building2 className="w-5 h-5 text-jarvis" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-foreground text-sm">{acc.account_name}</h3>
                            <p className="text-xs text-muted-foreground">{new Date(acc.created_at).toLocaleDateString('es-ES')}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge className={planColors[acc.plan] || planColors.essential}>{acc.plan}</Badge>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Users className="w-3.5 h-3.5" />
                            <span>{acc.max_users}</span>
                          </div>
                          <div className={`w-2 h-2 rounded-full ${acc.is_active ? 'bg-emerald-500' : 'bg-destructive'}`} />
                        </div>
                      </div>

                      {/* NER Contact ID row */}
                      <div className="flex items-center gap-2 pl-14">
                        <Link2 className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
                        {editingGhl === acc.id ? (
                          <>
                            <Input
                              value={ghlInput}
                              onChange={e => setGhlInput(e.target.value)}
                              placeholder="NER Contact ID"
                              className="h-7 text-xs max-w-[220px]"
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs text-jarvis"
                              disabled={savingGhl}
                              onClick={async () => {
                                setSavingGhl(true);
                                await supabase.functions.invoke('provision-account', {
                                  body: { __update_ghl: true, account_id: acc.id, ghl_contact_id: ghlInput || null },
                                });
                                setEditingGhl(null);
                                setSavingGhl(false);
                                loadAccounts();
                                toast({ title: 'GHL ID actualizado' });
                              }}
                            >
                              {savingGhl ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                            </Button>
                          </>
                        ) : (
                          <>
                            <span className="text-xs text-muted-foreground font-mono truncate max-w-[200px]">
                              {acc.ghl_contact_id || '—sin vincular—'}
                            </span>
                            {acc.ghl_contact_id && (
                              <button
                                onClick={async () => {
                                  await navigator.clipboard.writeText(
                                    `https://ner.recursosmigratorios.com/hub?cid=${acc.ghl_contact_id}`
                                  );
                                  setCopiedId(acc.id);
                                  setTimeout(() => setCopiedId(null), 2000);
                                  toast({ title: 'URL copiada al portapapeles' });
                                }}
                                className="p-1 rounded hover:bg-secondary transition-colors"
                                title="Copiar URL del Hub"
                              >
                                {copiedId === acc.id ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3 text-muted-foreground" />}
                              </button>
                            )}
                            <button
                              onClick={() => { setEditingGhl(acc.id); setGhlInput(acc.ghl_contact_id || ''); }}
                              className="p-1 rounded hover:bg-secondary transition-colors"
                              title="Editar NER Contact ID"
                            >
                              <Pencil className="w-3 h-3 text-muted-foreground" />
                            </button>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics">
            <AdminAnalytics />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
