import { useState, useEffect } from "react";
import { Key, Eye, EyeOff, Save, Trash2, CheckCircle2, AlertCircle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import CryptoJS from "crypto-js";

interface APISettingsProps {
  userId: string;
}

// Chave para criptografia local (AES)
const ENCRYPTION_KEY = "ads-intel-hub-2024";

const API_KEYS = [
  { key: "META_APP_ID", label: "Meta App ID", placeholder: "Seu Meta App ID" },
  { key: "META_APP_SECRET", label: "Meta App Secret", placeholder: "Seu Meta App Secret" },
  { key: "META_ACCESS_TOKEN", label: "Meta Access Token", placeholder: "Seu Meta Access Token" },
  { key: "META_PIXEL_ID", label: "Meta Pixel ID", placeholder: "Seu Meta Pixel ID" },
  { key: "GEMINI_API_KEY", label: "Gemini API Key", placeholder: "Sua chave do Google Gemini (IA)" },
];

const APISettings = ({ userId }: APISettingsProps) => {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [visibility, setVisibility] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [adAccounts, setAdAccounts] = useState<string[]>([""]);
  const [adAccountVisibility, setAdAccountVisibility] = useState<boolean[]>([false]);
  const { toast } = useToast();

  const encrypt = (text: string) => {
    return CryptoJS.AES.encrypt(text, ENCRYPTION_KEY).toString();
  };

  const decrypt = (ciphertext: string) => {
    try {
      const bytes = CryptoJS.AES.decrypt(ciphertext, ENCRYPTION_KEY);
      return bytes.toString(CryptoJS.enc.Utf8);
    } catch {
      return "";
    }
  };

  useEffect(() => {
    if (userId) {
      loadSettings();
    }
  }, [userId]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("api_settings")
        .select("*")
        .eq("user_id", userId);

      if (error) throw error;

      const decryptedSettings: Record<string, string> = {};
      data?.forEach((item) => {
        decryptedSettings[item.setting_key] = decrypt(item.encrypted_value);
      });
      setSettings(decryptedSettings);

      // Parse ad accounts from comma-separated string
      if (decryptedSettings.META_AD_ACCOUNT_IDS) {
        const accounts = decryptedSettings.META_AD_ACCOUNT_IDS.split(",").filter(Boolean);
        setAdAccounts(accounts.length > 0 ? accounts : [""]);
        setAdAccountVisibility(accounts.map(() => false));
      }
    } catch (error: any) {
      console.error("Erro ao carregar configurações:", error);
    } finally {
      setLoading(false);
    }
  };

  const saveSetting = async (key: string) => {
    const value = settings[key];
    if (!value?.trim()) {
      toast({
        title: "Erro",
        description: "O campo não pode estar vazio",
        variant: "destructive",
      });
      return;
    }

    setSaving(key);
    try {
      const encrypted = encrypt(value);
      const { error } = await supabase
        .from("api_settings")
        .upsert(
          {
            user_id: userId,
            setting_key: key,
            encrypted_value: encrypted,
          },
          { onConflict: "user_id,setting_key" }
        );

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: `Configuração ${key} salva com segurança.`,
      });
    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(null);
    }
  };

  const deleteSetting = async (key: string) => {
    setSaving(key);
    try {
      const { error } = await supabase
        .from("api_settings")
        .delete()
        .eq("user_id", userId)
        .eq("setting_key", key);

      if (error) throw error;

      setSettings((prev) => {
        const newSettings = { ...prev };
        delete newSettings[key];
        return newSettings;
      });

      toast({
        title: "Removido",
        description: `A chave ${key} foi removida do banco de dados.`,
      });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(null);
    }
  };

  const isConfigured = (key: string) => Boolean(settings[key]?.trim());
  const hasAdAccounts = adAccounts.some((acc) => acc.trim());

  const addAdAccount = () => {
    setAdAccounts([...adAccounts, ""]);
    setAdAccountVisibility([...adAccountVisibility, false]);
  };

  const removeAdAccount = (index: number) => {
    const newAccounts = adAccounts.filter((_, i) => i !== index);
    const newVisibility = adAccountVisibility.filter((_, i) => i !== index);
    setAdAccounts(newAccounts.length > 0 ? newAccounts : [""]);
    setAdAccountVisibility(newVisibility.length > 0 ? newVisibility : [false]);
  };

  const updateAdAccount = (index: number, value: string) => {
    const newAccounts = [...adAccounts];
    newAccounts[index] = value;
    setAdAccounts(newAccounts);
  };

  const toggleAdAccountVisibility = (index: number) => {
    const newVisibility = [...adAccountVisibility];
    newVisibility[index] = !newVisibility[index];
    setAdAccountVisibility(newVisibility);
  };

  const saveAdAccounts = async () => {
    const validAccounts = adAccounts.filter((acc) => acc.trim());
    if (validAccounts.length === 0) {
      toast({
        title: "Erro",
        description: "Adicione pelo menos uma conta de anúncio",
        variant: "destructive",
      });
      return;
    }

    setSaving("META_AD_ACCOUNT_IDS");
    try {
      const encrypted = encrypt(validAccounts.join(","));
      const { error } = await supabase
        .from("api_settings")
        .upsert(
          {
            user_id: userId,
            setting_key: "META_AD_ACCOUNT_IDS",
            encrypted_value: encrypted,
          },
          { onConflict: "user_id,setting_key" }
        );

      if (error) throw error;

      setSettings((prev) => ({
        ...prev,
        META_AD_ACCOUNT_IDS: validAccounts.join(","),
      }));

      toast({
        title: "Sucesso",
        description: `${validAccounts.length} conta(s) de anúncio salva(s) com segurança.`,
      });
    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(null);
    }
  };

  const deleteAllAdAccounts = async () => {
    setSaving("META_AD_ACCOUNT_IDS");
    try {
      const { error } = await supabase
        .from("api_settings")
        .delete()
        .eq("user_id", userId)
        .eq("setting_key", "META_AD_ACCOUNT_IDS");

      if (error) throw error;

      setAdAccounts([""]);
      setAdAccountVisibility([false]);
      setSettings((prev) => {
        const newSettings = { ...prev };
        delete newSettings.META_AD_ACCOUNT_IDS;
        return newSettings;
      });

      toast({
        title: "Removido",
        description: "Todas as contas de anúncio foram removidas.",
      });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
          <Key className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">API Vault</h2>
          <p className="text-sm text-muted-foreground">Criptografia de ponta a ponta para suas chaves</p>
        </div>
      </div>

      <div className="glass-card p-6 space-y-6 border-white/5">
        {API_KEYS.map((apiKey) => (
          <div key={apiKey.key} className="space-y-3 group">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium flex items-center gap-2 group-hover:text-primary transition-colors">
                {apiKey.label}
                {isConfigured(apiKey.key) ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 animate-pulse" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-500" />
                )}
              </Label>
              {isConfigured(apiKey.key) && (
                <span className="text-[10px] uppercase tracking-wider text-emerald-500 font-bold">Ativo</span>
              )}
            </div>
            
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={visibility[apiKey.key] ? "text" : "password"}
                  value={settings[apiKey.key] || ""}
                  onChange={(e) => setSettings({ ...settings, [apiKey.key]: e.target.value })}
                  placeholder={apiKey.placeholder}
                  className="bg-slate-950/50 border-slate-800 focus:border-primary/50 pr-10 font-mono text-sm h-11"
                />
                <button
                  type="button"
                  onClick={() => setVisibility({ ...visibility, [apiKey.key]: !visibility[apiKey.key] })}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                >
                  {visibility[apiKey.key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              
              <Button
                variant="outline"
                size="icon"
                onClick={() => saveSetting(apiKey.key)}
                disabled={saving === apiKey.key}
                className="h-11 w-11 border-slate-800 hover:bg-primary/10 hover:text-primary transition-all"
              >
                <Save className="w-4 h-4" />
              </Button>

              {isConfigured(apiKey.key) && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => deleteSetting(apiKey.key)}
                  disabled={saving === apiKey.key}
                  className="h-11 w-11 border-slate-800 hover:bg-destructive/10 hover:text-destructive transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        ))}

        {/* Multiple Ad Accounts Section */}
        <div className="space-y-3 pt-4 border-t border-slate-800">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium flex items-center gap-2">
              Contas de Anúncio Meta
              {hasAdAccounts && settings.META_AD_ACCOUNT_IDS ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500 animate-pulse" />
              ) : (
                <AlertCircle className="w-4 h-4 text-amber-500" />
              )}
            </Label>
            <div className="flex items-center gap-2">
              {hasAdAccounts && settings.META_AD_ACCOUNT_IDS && (
                <span className="text-[10px] uppercase tracking-wider text-emerald-500 font-bold">
                  {adAccounts.filter((a) => a.trim()).length} Ativa(s)
                </span>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={addAdAccount}
                className="h-8 px-3 border-slate-800 hover:bg-primary/10 hover:text-primary transition-all"
              >
                <Plus className="w-4 h-4 mr-1" />
                Adicionar
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            {adAccounts.map((account, index) => (
              <div key={index} className="flex gap-2 animate-fade-in">
                <div className="relative flex-1">
                  <Input
                    type={adAccountVisibility[index] ? "text" : "password"}
                    value={account}
                    onChange={(e) => updateAdAccount(index, e.target.value)}
                    placeholder={`ID da conta ${index + 1} (ex: act_123456789)`}
                    className="bg-slate-950/50 border-slate-800 focus:border-primary/50 pr-10 font-mono text-sm h-11"
                  />
                  <button
                    type="button"
                    onClick={() => toggleAdAccountVisibility(index)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                  >
                    {adAccountVisibility[index] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                
                {adAccounts.length > 1 && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => removeAdAccount(index)}
                    className="h-11 w-11 border-slate-800 hover:bg-destructive/10 hover:text-destructive transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-2 mt-3">
            <Button
              variant="outline"
              onClick={saveAdAccounts}
              disabled={saving === "META_AD_ACCOUNT_IDS"}
              className="flex-1 h-11 border-slate-800 hover:bg-primary/10 hover:text-primary transition-all"
            >
              <Save className="w-4 h-4 mr-2" />
              Salvar Contas
            </Button>

            {settings.META_AD_ACCOUNT_IDS && (
              <Button
                variant="outline"
                onClick={deleteAllAdAccounts}
                disabled={saving === "META_AD_ACCOUNT_IDS"}
                className="h-11 px-4 border-slate-800 hover:bg-destructive/10 hover:text-destructive transition-all"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Remover Todas
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-lg p-4 bg-amber-500/5 border border-amber-500/20">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-500">Aviso de Segurança</p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              As chaves são armazenadas com criptografia AES-256 no Supabase. 
              Ao salvar o <strong>Meta Access Token</strong>, o sistema poderá baixar automaticamente métricas de anúncios e sincronizar conversões via API.
              <br /><br />
              <strong>Múltiplas Contas:</strong> Você pode adicionar várias contas de anúncio. O dashboard consolidará os dados de todas as contas automaticamente.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default APISettings;