import { useState, useEffect } from "react";
import { Key, Eye, EyeOff, Save, Trash2, CheckCircle2, AlertCircle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import CryptoJS from "crypto-js";
import Sidebar from "@/components/dashboard/Sidebar";
import { MobileHeader } from "@/components/dashboard/MobileHeader";
import { useIsMobile } from "@/hooks/use-mobile";

const ENCRYPTION_KEY = "ads-intel-hub-2024";

// Reutilizamos a chave GEMINI_API_KEY no banco para não precisar de migration agora
// Mas na tela aparecerá como Groq/Llama 3
const API_KEYS = [
  { key: "META_APP_ID", label: "Meta App ID", placeholder: "Seu Meta App ID" },
  { key: "META_APP_SECRET", label: "Meta App Secret", placeholder: "Seu Meta App Secret" },
  { key: "META_ACCESS_TOKEN", label: "Meta Access Token", placeholder: "Seu Meta Access Token" },
  { key: "META_PIXEL_ID", label: "Meta Pixel ID", placeholder: "Seu Meta Pixel ID" },
  { key: "GEMINI_API_KEY", label: "Chave da IA (Groq / Llama 3)", placeholder: "Sua chave gsk_..." },
];

const APISettings = () => {
  const isMobile = useIsMobile();
  const [userId, setUserId] = useState<string | null>(null); // Estado local para ID
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [visibility, setVisibility] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [adAccounts, setAdAccounts] = useState<string[]>([""]);
  const [adAccountVisibility, setAdAccountVisibility] = useState<boolean[]>([false]);
  const { toast } = useToast();

  const encrypt = (text: string) => CryptoJS.AES.encrypt(text, ENCRYPTION_KEY).toString();
  const decrypt = (ciphertext: string) => {
    try {
      return CryptoJS.AES.decrypt(ciphertext, ENCRYPTION_KEY).toString(CryptoJS.enc.Utf8);
    } catch { return ""; }
  };

  // 1. Busca o Usuário assim que monta
  useEffect(() => {
    const fetchUserAndSettings = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        setUserId(user.id);
        await loadSettings(user.id);
      } else {
        setLoading(false);
      }
    };
    fetchUserAndSettings();
  }, []);

  const loadSettings = async (uid: string) => {
    try {
      const { data, error } = await supabase
        .from("api_settings")
        .select("*")
        .eq("user_id", uid);

      if (error) throw error;

      const decryptedSettings: Record<string, string> = {};
      data?.forEach((item) => {
        const val = decrypt(item.encrypted_value);
        if (val) decryptedSettings[item.setting_key] = val;
      });
      setSettings(decryptedSettings);

      if (decryptedSettings.META_AD_ACCOUNT_IDS) {
        const accounts = decryptedSettings.META_AD_ACCOUNT_IDS.split(",").filter(Boolean);
        setAdAccounts(accounts.length > 0 ? accounts : [""]);
        setAdAccountVisibility(accounts.map(() => false));
      }
    } catch (error: any) {
      console.error("Erro ao carregar:", error);
      toast({ title: "Erro", description: "Falha ao carregar chaves.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const saveSetting = async (key: string) => {
    if (!userId) return;
    const value = settings[key];
    if (!value?.trim()) return toast({ title: "Erro", description: "Campo vazio.", variant: "destructive" });
    
    setSaving(key);
    try {
      const encrypted = encrypt(value);
      const { error } = await supabase.from("api_settings").upsert(
        { user_id: userId, setting_key: key, encrypted_value: encrypted },
        { onConflict: "user_id,setting_key" }
      );
      if (error) throw error;
      toast({ title: "Sucesso", description: `Chave salva.` });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally { setSaving(null); }
  };

  const deleteSetting = async (key: string) => {
    if (!userId) return;
    setSaving(key);
    try {
      const { error } = await supabase.from("api_settings").delete().eq("user_id", userId).eq("setting_key", key);
      if (error) throw error;
      setSettings(prev => { const n = {...prev}; delete n[key]; return n; });
      toast({ title: "Removido", description: `Chave removida.` });
    } catch (err: any) { toast({ title: "Erro", description: err.message, variant: "destructive" }); } finally { setSaving(null); }
  };

  // Helpers
  const isConfigured = (key: string) => Boolean(settings[key]?.trim());
  const addAdAccount = () => { setAdAccounts([...adAccounts, ""]); setAdAccountVisibility([...adAccountVisibility, false]); };
  const removeAdAccount = (i: number) => { 
    const na = adAccounts.filter((_, idx) => idx !== i); 
    setAdAccounts(na.length ? na : [""]); 
    const nv = adAccountVisibility.filter((_, idx) => idx !== i);
    setAdAccountVisibility(nv.length ? nv : [false]);
  };
  const updateAdAccount = (i: number, val: string) => { const na = [...adAccounts]; na[i] = val; setAdAccounts(na); };
  const toggleAdAccountVisibility = (i: number) => { const nv = [...adAccountVisibility]; nv[i] = !nv[i]; setAdAccountVisibility(nv); };
  
  const saveAdAccounts = async () => {
    if (!userId) return;
    const valid = adAccounts.filter(a => a.trim());
    if(!valid.length) return toast({title: "Erro", description: "Adicione uma conta.", variant: "destructive"});
    setSaving("META_AD_ACCOUNT_IDS");
    try {
        const enc = encrypt(valid.join(","));
        const {error} = await supabase.from("api_settings").upsert({user_id: userId, setting_key: "META_AD_ACCOUNT_IDS", encrypted_value: enc}, {onConflict: "user_id,setting_key"});
        if(error) throw error;
        setSettings(p => ({...p, META_AD_ACCOUNT_IDS: valid.join(",")}));
        toast({title: "Sucesso", description: "Contas salvas."});
    } catch(err: any) { toast({title: "Erro", description: err.message, variant: "destructive"}); } finally { setSaving(null); }
  };

  const deleteAllAdAccounts = async () => {
      if (!userId) return;
      setSaving("META_AD_ACCOUNT_IDS");
      try {
          const {error} = await supabase.from("api_settings").delete().eq("user_id", userId).eq("setting_key", "META_AD_ACCOUNT_IDS");
          if(error) throw error;
          setAdAccounts([""]);
          setSettings(p => { const n = {...p}; delete n.META_AD_ACCOUNT_IDS; return n; });
          toast({title: "Removido", description: "Contas removidas."});
      } catch(err:any) { toast({title: "Erro", description: err.message, variant: "destructive"}); } finally { setSaving(null); }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#0f172a] text-slate-200">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        {isMobile && <MobileHeader />}
        
        <main className="flex-1 overflow-y-auto p-4 md:p-8 animate-fade-in">
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Key className="w-6 h-6 text-[#f90f54]" />
              </div>
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-white">API Vault</h2>
                <p className="text-sm text-slate-400">Gerencie suas chaves com criptografia AES-256.</p>
              </div>
            </div>

            <div className="bg-[#1e293b]/40 backdrop-blur-md border border-slate-700/50 rounded-xl p-6 space-y-6">
              {API_KEYS.map((apiKey) => (
                <div key={apiKey.key} className="space-y-3 group">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium flex items-center gap-2 text-slate-200 group-hover:text-[#f90f54] transition-colors">
                      {apiKey.label}
                      {isConfigured(apiKey.key) ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <AlertCircle className="w-4 h-4 text-amber-500" />}
                    </Label>
                    {isConfigured(apiKey.key) && <span className="text-[10px] uppercase tracking-wider text-emerald-500 font-bold">Ativo</span>}
                  </div>
                  
                  <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); saveSetting(apiKey.key); }}>
                    <div className="relative flex-1">
                      <Input
                        type={visibility[apiKey.key] ? "text" : "password"}
                        value={settings[apiKey.key] || ""}
                        onChange={(e) => setSettings({ ...settings, [apiKey.key]: e.target.value })}
                        placeholder={apiKey.placeholder}
                        autoComplete="off"
                        className="bg-slate-950/50 border-slate-700 focus:border-[#f90f54]/50 pr-10 font-mono text-sm h-11 text-white"
                      />
                      <button type="button" onClick={() => setVisibility({ ...visibility, [apiKey.key]: !visibility[apiKey.key] })} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors">
                        {visibility[apiKey.key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <Button type="submit" variant="outline" size="icon" disabled={saving === apiKey.key} className="h-11 w-11 border-slate-700 bg-slate-800/50 hover:bg-[#f90f54]/10 hover:text-[#f90f54] text-white"><Save className="w-4 h-4" /></Button>
                    {isConfigured(apiKey.key) && <Button type="button" variant="outline" size="icon" onClick={() => deleteSetting(apiKey.key)} disabled={saving === apiKey.key} className="h-11 w-11 border-slate-700 bg-slate-800/50 hover:bg-red-500/10 hover:text-red-500 text-white"><Trash2 className="w-4 h-4" /></Button>}
                  </form>
                </div>
              ))}

              {/* Seção Contas Meta - Mantida Simples */}
              <div className="space-y-3 pt-6 border-t border-slate-700/50 mt-6">
                <Label className="text-sm font-medium text-slate-200">Contas de Anúncio Meta (IDs)</Label>
                {adAccounts.map((account, index) => (
                  <div key={index} className="flex gap-2">
                    <Input value={account} onChange={(e) => {const n=[...adAccounts]; n[index]=e.target.value; setAdAccounts(n)}} placeholder="act_..." className="bg-slate-950/50 border-slate-700 text-white h-10" />
                    {adAccounts.length > 1 && <Button variant="ghost" size="icon" onClick={() => removeAdAccount(index)} className="text-red-500"><Trash2 className="w-4 h-4" /></Button>}
                  </div>
                ))}
                <div className="flex gap-2 mt-2">
                   <Button variant="ghost" size="sm" onClick={addAdAccount} className="text-[#f90f54]"><Plus className="w-4 h-4 mr-1"/> Add</Button>
                   <Button onClick={saveAdAccounts} className="ml-auto bg-[#f90f54] hover:bg-[#d60040] text-white">Salvar Contas</Button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default APISettings;