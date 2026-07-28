import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Locale = "en" | "es" | "de" | "ja" | "hi";

export const LOCALES: { code: Locale; label: string; flag: string }[] = [
  { code: "en", label: "English",  flag: "🇬🇧" },
  { code: "es", label: "Español",  flag: "🇪🇸" },
  { code: "de", label: "Deutsch",  flag: "🇩🇪" },
  { code: "ja", label: "日本語",    flag: "🇯🇵" },
  { code: "hi", label: "हिन्दी",     flag: "🇮🇳" },
];

// Translation dictionaries. Keys mirror English strings so `t("Dashboard")`
// falls back gracefully to the key itself if a translation is missing.
type Dict = Record<string, string>;

const en: Dict = {}; // identity — keys are English

const es: Dict = {
  // Sidebar sections
  Overview: "Resumen", Customers: "Clientes", People: "Personas",
  Operations: "Operaciones", Commerce: "Comercio", Intelligence: "Inteligencia",
  System: "Sistema", Platform: "Plataforma", Plant: "Planta", Planning: "Planificación",
  Warehouse: "Almacén", Procurement: "Compras", Quality: "Calidad",
  Maintenance: "Mantenimiento", Finance: "Finanzas", Reports: "Informes",
  "My Shift": "Mi Turno", "My Account": "Mi Cuenta", Audit: "Auditoría",
  // Nav items
  Dashboard: "Panel", Notifications: "Notificaciones", "My Company": "Mi Empresa",
  Plants: "Plantas", Departments: "Departamentos", "Order Approvals": "Aprobaciones de Pedidos",
  "Customer Requests": "Solicitudes de Clientes", Materials: "Materiales",
  Employees: "Empleados", Roles: "Roles", Whitelist: "Lista Blanca",
  Inventory: "Inventario", Production: "Producción", Products: "Productos",
  BOM: "Lista de Materiales", Machines: "Máquinas", Suppliers: "Proveedores",
  CRM: "CRM", HR: "RRHH", Analytics: "Analítica", "AI Center": "Centro de IA",
  "Knowledge Center": "Centro de Conocimiento", Settings: "Configuración",
  "Plant Overview": "Vista de Planta", "Plant Performance": "Rendimiento de Planta",
  "Approved Orders": "Pedidos Aprobados", "Production Planning": "Planificación de Producción",
  "Production Orders": "Órdenes de Producción", "Work Orders": "Órdenes de Trabajo",
  Scheduling: "Programación", "Capacity Planning": "Planificación de Capacidad",
  Warehouses: "Almacenes", "Stock Movement": "Movimiento de Stock",
  Transfers: "Transferencias", Receiving: "Recepción", Dispatch: "Envío",
  "Cycle Count": "Recuento Cíclico", "Purchase Requests": "Solicitudes de Compra",
  "Purchase Orders": "Órdenes de Compra", RFQ: "Solicitud de Cotización",
  "Vendor Comparison": "Comparación de Proveedores", "Goods Receipt": "Recepción de Bienes",
  "Incoming Inspection": "Inspección de Entrada", "In-Process Inspection": "Inspección en Proceso",
  "Final Inspection": "Inspección Final", Defects: "Defectos", CAPA: "CAPA",
  Schedules: "Horarios", "Machine History": "Historial de Máquinas",
  Breakdowns: "Averías", "Spare Parts": "Repuestos", Invoices: "Facturas",
  Expenses: "Gastos", Payroll: "Nómina", Taxes: "Impuestos", Budgets: "Presupuestos",
  "Profit & Loss": "Pérdidas y Ganancias", Attendance: "Asistencia",
  Leaves: "Permisos", Recruitment: "Reclutamiento", Training: "Capacitación",
  Performance: "Rendimiento", Tasks: "Tareas", "Production Logs": "Registros de Producción",
  "Report Issue": "Reportar Problema", "My Machines": "Mis Máquinas",
  Orders: "Pedidos", Shipments: "Envíos", Support: "Soporte", Documents: "Documentos",
  Deliveries: "Entregas", Payments: "Pagos", "Audit Logs": "Registros de Auditoría",
  Compliance: "Cumplimiento",
  // Top bar / common
  "Search…": "Buscar…", "Signed in": "Conectado", "Sign out": "Cerrar sesión",
  "Your Company": "Su Empresa", Loading: "Cargando", Save: "Guardar", Cancel: "Cancelar",
  Profile: "Perfil", Preferences: "Preferencias", Theme: "Tema", Language: "Idioma",
};

const de: Dict = {
  Overview: "Übersicht", Customers: "Kunden", People: "Personen",
  Operations: "Betrieb", Commerce: "Handel", Intelligence: "Intelligenz",
  System: "System", Platform: "Plattform", Plant: "Werk", Planning: "Planung",
  Warehouse: "Lager", Procurement: "Beschaffung", Quality: "Qualität",
  Maintenance: "Wartung", Finance: "Finanzen", Reports: "Berichte",
  "My Shift": "Meine Schicht", "My Account": "Mein Konto", Audit: "Audit",
  Dashboard: "Dashboard", Notifications: "Benachrichtigungen", "My Company": "Mein Unternehmen",
  Plants: "Werke", Departments: "Abteilungen", "Order Approvals": "Auftragsfreigaben",
  "Customer Requests": "Kundenanfragen", Materials: "Materialien",
  Employees: "Mitarbeiter", Roles: "Rollen", Whitelist: "Whitelist",
  Inventory: "Bestand", Production: "Produktion", Products: "Produkte",
  BOM: "Stückliste", Machines: "Maschinen", Suppliers: "Lieferanten",
  CRM: "CRM", HR: "Personal", Analytics: "Analytik", "AI Center": "KI-Zentrum",
  "Knowledge Center": "Wissenszentrum", Settings: "Einstellungen",
  "Plant Overview": "Werksübersicht", "Plant Performance": "Werksleistung",
  "Approved Orders": "Freigegebene Aufträge", "Production Planning": "Produktionsplanung",
  "Production Orders": "Produktionsaufträge", "Work Orders": "Arbeitsaufträge",
  Scheduling: "Terminplanung", "Capacity Planning": "Kapazitätsplanung",
  Warehouses: "Lager", "Stock Movement": "Bestandsbewegung",
  Transfers: "Umlagerungen", Receiving: "Wareneingang", Dispatch: "Versand",
  "Cycle Count": "Zykluszählung", "Purchase Requests": "Bestellanforderungen",
  "Purchase Orders": "Bestellungen", RFQ: "Angebotsanfrage",
  "Vendor Comparison": "Lieferantenvergleich", "Goods Receipt": "Wareneingang",
  "Incoming Inspection": "Wareneingangsprüfung", "In-Process Inspection": "Prozessprüfung",
  "Final Inspection": "Endprüfung", Defects: "Defekte", CAPA: "CAPA",
  Schedules: "Zeitpläne", "Machine History": "Maschinenhistorie",
  Breakdowns: "Ausfälle", "Spare Parts": "Ersatzteile", Invoices: "Rechnungen",
  Expenses: "Ausgaben", Payroll: "Gehaltsabrechnung", Taxes: "Steuern", Budgets: "Budgets",
  "Profit & Loss": "Gewinn & Verlust", Attendance: "Anwesenheit",
  Leaves: "Urlaub", Recruitment: "Rekrutierung", Training: "Schulung",
  Performance: "Leistung", Tasks: "Aufgaben", "Production Logs": "Produktionsprotokolle",
  "Report Issue": "Problem melden", "My Machines": "Meine Maschinen",
  Orders: "Aufträge", Shipments: "Sendungen", Support: "Support", Documents: "Dokumente",
  Deliveries: "Lieferungen", Payments: "Zahlungen", "Audit Logs": "Audit-Protokolle",
  Compliance: "Compliance",
  "Search…": "Suchen…", "Signed in": "Angemeldet", "Sign out": "Abmelden",
  "Your Company": "Ihr Unternehmen", Loading: "Laden", Save: "Speichern", Cancel: "Abbrechen",
  Profile: "Profil", Preferences: "Einstellungen", Theme: "Thema", Language: "Sprache",
};

const ja: Dict = {
  Overview: "概要", Customers: "顧客", People: "人材",
  Operations: "運用", Commerce: "商取引", Intelligence: "インテリジェンス",
  System: "システム", Platform: "プラットフォーム", Plant: "工場", Planning: "計画",
  Warehouse: "倉庫", Procurement: "調達", Quality: "品質",
  Maintenance: "保守", Finance: "財務", Reports: "レポート",
  "My Shift": "私のシフト", "My Account": "マイアカウント", Audit: "監査",
  Dashboard: "ダッシュボード", Notifications: "通知", "My Company": "私の会社",
  Plants: "工場", Departments: "部門", "Order Approvals": "注文承認",
  "Customer Requests": "顧客リクエスト", Materials: "資材",
  Employees: "従業員", Roles: "役割", Whitelist: "ホワイトリスト",
  Inventory: "在庫", Production: "生産", Products: "製品",
  BOM: "部品表", Machines: "機械", Suppliers: "サプライヤー",
  CRM: "CRM", HR: "人事", Analytics: "分析", "AI Center": "AIセンター",
  "Knowledge Center": "ナレッジセンター", Settings: "設定",
  "Plant Overview": "工場概要", "Plant Performance": "工場パフォーマンス",
  "Approved Orders": "承認済み注文", "Production Planning": "生産計画",
  "Production Orders": "製造指図", "Work Orders": "作業指図",
  Scheduling: "スケジューリング", "Capacity Planning": "能力計画",
  Warehouses: "倉庫", "Stock Movement": "在庫移動",
  Transfers: "移送", Receiving: "受入", Dispatch: "出荷",
  "Cycle Count": "循環棚卸", "Purchase Requests": "購買依頼",
  "Purchase Orders": "発注書", RFQ: "見積依頼",
  "Vendor Comparison": "ベンダー比較", "Goods Receipt": "入荷",
  "Incoming Inspection": "受入検査", "In-Process Inspection": "工程内検査",
  "Final Inspection": "最終検査", Defects: "不良", CAPA: "是正措置",
  Schedules: "スケジュール", "Machine History": "機械履歴",
  Breakdowns: "故障", "Spare Parts": "予備部品", Invoices: "請求書",
  Expenses: "経費", Payroll: "給与", Taxes: "税金", Budgets: "予算",
  "Profit & Loss": "損益", Attendance: "勤怠",
  Leaves: "休暇", Recruitment: "採用", Training: "研修",
  Performance: "業績", Tasks: "タスク", "Production Logs": "生産ログ",
  "Report Issue": "問題を報告", "My Machines": "私の機械",
  Orders: "注文", Shipments: "出荷", Support: "サポート", Documents: "ドキュメント",
  Deliveries: "納品", Payments: "支払い", "Audit Logs": "監査ログ",
  Compliance: "コンプライアンス",
  "Search…": "検索…", "Signed in": "サインイン中", "Sign out": "サインアウト",
  "Your Company": "あなたの会社", Loading: "読み込み中", Save: "保存", Cancel: "キャンセル",
  Profile: "プロフィール", Preferences: "環境設定", Theme: "テーマ", Language: "言語",
};

const hi: Dict = {
  Overview: "अवलोकन", Customers: "ग्राहक", People: "लोग",
  Operations: "संचालन", Commerce: "वाणिज्य", Intelligence: "इंटेलिजेंस",
  System: "सिस्टम", Platform: "प्लेटफ़ॉर्म", Plant: "प्लांट", Planning: "योजना",
  Warehouse: "गोदाम", Procurement: "खरीद", Quality: "गुणवत्ता",
  Maintenance: "रखरखाव", Finance: "वित्त", Reports: "रिपोर्ट",
  "My Shift": "मेरी शिफ्ट", "My Account": "मेरा खाता", Audit: "ऑडिट",
  Dashboard: "डैशबोर्ड", Notifications: "सूचनाएँ", "My Company": "मेरी कंपनी",
  Plants: "प्लांट्स", Departments: "विभाग", "Order Approvals": "ऑर्डर अनुमोदन",
  "Customer Requests": "ग्राहक अनुरोध", Materials: "सामग्री",
  Employees: "कर्मचारी", Roles: "भूमिकाएँ", Whitelist: "व्हाइटलिस्ट",
  Inventory: "इन्वेंट्री", Production: "उत्पादन", Products: "उत्पाद",
  BOM: "बीओएम", Machines: "मशीनें", Suppliers: "आपूर्तिकर्ता",
  CRM: "सीआरएम", HR: "एचआर", Analytics: "विश्लेषण", "AI Center": "एआई केंद्र",
  "Knowledge Center": "ज्ञान केंद्र", Settings: "सेटिंग्स",
  "Plant Overview": "प्लांट अवलोकन", "Plant Performance": "प्लांट प्रदर्शन",
  "Approved Orders": "स्वीकृत ऑर्डर", "Production Planning": "उत्पादन योजना",
  "Production Orders": "उत्पादन ऑर्डर", "Work Orders": "कार्य आदेश",
  Scheduling: "समय-निर्धारण", "Capacity Planning": "क्षमता योजना",
  Warehouses: "गोदाम", "Stock Movement": "स्टॉक संचलन",
  Transfers: "स्थानांतरण", Receiving: "प्राप्ति", Dispatch: "प्रेषण",
  "Cycle Count": "चक्र गणना", "Purchase Requests": "खरीद अनुरोध",
  "Purchase Orders": "खरीद आदेश", RFQ: "आरएफक्यू",
  "Vendor Comparison": "विक्रेता तुलना", "Goods Receipt": "माल प्राप्ति",
  "Incoming Inspection": "आवक निरीक्षण", "In-Process Inspection": "प्रक्रिया निरीक्षण",
  "Final Inspection": "अंतिम निरीक्षण", Defects: "दोष", CAPA: "कापा",
  Schedules: "अनुसूची", "Machine History": "मशीन इतिहास",
  Breakdowns: "ब्रेकडाउन", "Spare Parts": "स्पेयर पार्ट्स", Invoices: "चालान",
  Expenses: "व्यय", Payroll: "पेरोल", Taxes: "कर", Budgets: "बजट",
  "Profit & Loss": "लाभ और हानि", Attendance: "उपस्थिति",
  Leaves: "अवकाश", Recruitment: "भर्ती", Training: "प्रशिक्षण",
  Performance: "प्रदर्शन", Tasks: "कार्य", "Production Logs": "उत्पादन लॉग",
  "Report Issue": "समस्या रिपोर्ट करें", "My Machines": "मेरी मशीनें",
  Orders: "ऑर्डर", Shipments: "शिपमेंट", Support: "सहायता", Documents: "दस्तावेज़",
  Deliveries: "डिलीवरी", Payments: "भुगतान", "Audit Logs": "ऑडिट लॉग",
  Compliance: "अनुपालन",
  "Search…": "खोजें…", "Signed in": "साइन इन", "Sign out": "साइन आउट",
  "Your Company": "आपकी कंपनी", Loading: "लोड हो रहा है", Save: "सहेजें", Cancel: "रद्द करें",
  Profile: "प्रोफ़ाइल", Preferences: "प्राथमिकताएँ", Theme: "थीम", Language: "भाषा",
};

const DICTS: Record<Locale, Dict> = { en, es, de, ja, hi };

interface I18nCtx {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string) => string;
}

const Ctx = createContext<I18nCtx>({ locale: "en", setLocale: () => {}, t: (k) => k });

const STORAGE_KEY = "factoryos_locale";

export function I18nProvider({ children, forceLocale }: { children: ReactNode; forceLocale?: Locale }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (forceLocale) return forceLocale;
    if (typeof window === "undefined") return "en";
    const stored = window.localStorage.getItem(STORAGE_KEY) as Locale | null;
    return stored && DICTS[stored] ? stored : "en";
  });

  useEffect(() => {
    if (forceLocale && locale !== forceLocale) setLocaleState(forceLocale);
  }, [forceLocale, locale]);

  const setLocale = (l: Locale) => {
    if (forceLocale) return; // locked
    setLocaleState(l);
    try { window.localStorage.setItem(STORAGE_KEY, l); } catch {}
  };

  const value = useMemo<I18nCtx>(() => ({
    locale,
    setLocale,
    t: (key: string) => DICTS[locale]?.[key] ?? key,
  }), [locale]); // eslint-disable-line react-hooks/exhaustive-deps

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n() { return useContext(Ctx); }
