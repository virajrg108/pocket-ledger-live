import { useState, useRef } from "react";
import { useCollectionData } from "react-firebase-hooks/firestore";
import { addDoc, deleteDoc, doc, setDoc, query, where, getDocs, writeBatch } from "firebase/firestore";
import {
    Plus,
    Trash2,
    Wallet,
    Download,
    Upload,
    FileSpreadsheet,
    Pencil,
    X,
    Sparkles,
    Search
} from "lucide-react";

import { getUserCollections, buildRuleDocId, type MerchantMapping, type TransactionType } from "../db";
import { db as firestoreDb } from "../lib/firebase";
import { useAuthStore } from "../store/useAuthStore";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function escapeCsv(val: string | undefined): string {
    if (!val) return "";
    if (val.includes(",") || val.includes('"') || val.includes("\n")) {
        return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
}

function parseCsvLine(line: string): string[] {
    const tokens: string[] = [];
    let sb = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') {
            if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
                sb += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (c === ',' && !inQuotes) {
            tokens.push(sb.trim());
            sb = "";
        } else {
            sb += c;
        }
    }
    tokens.push(sb.trim());
    return tokens;
}

export function Settings() {
    const { user, signOut } = useAuthStore();
    const collections = getUserCollections(user?.uid);

    // ==========================================
    // Accounts State & Logic
    // ==========================================
    const [newName, setNewName] = useState("");
    const [newBalance, setNewBalance] = useState("");
    const [accounts] = useCollectionData(collections?.accounts);
    const [transactions] = useCollectionData(collections?.transactions);

    const handleAddAccount = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newName.trim() || !user || !collections) return;

        const balanceNum = parseFloat(newBalance) || 0;

        try {
            const q = query(collections.accounts, where('name', '==', newName.trim()));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
                alert("An account with this name already exists.");
                return;
            }

            await addDoc(collections.accounts, {
                name: newName.trim(),
                initialBalance: balanceNum
            });

            setNewName("");
            setNewBalance("");
        } catch (error) {
            console.error("Failed to add account", error);
            alert("Failed to add account.");
        }
    };

    const handleDeleteAccount = async (id: string, name: string) => {
        if (!user) return;
        const inUse = transactions?.some(t => t.source === name || t.toSource === name);
        if (inUse) {
            alert(`Cannot delete '${name}' because there are transactions associated with it. Please reassign or delete those transactions first.`);
            return;
        }

        if (window.confirm(`Are you sure you want to delete the account '${name}'?`)) {
            await deleteDoc(doc(firestoreDb, 'users', user.uid, 'accounts', id));
        }
    };

    // ==========================================
    // Merchant Mappings (AI DB) State & Logic
    // ==========================================
    const [mappings, loadingMappings] = useCollectionData(collections?.merchantMappings);
    const [rulesSearch, setRulesSearch] = useState("");

    // Form state for creating / editing a rule
    const [editingRule, setEditingRule] = useState<MerchantMapping | null>(null);
    const [ruleMerchant, setRuleMerchant] = useState("");
    const [ruleType, setRuleType] = useState<TransactionType>("Debit");
    const [ruleAmount, setRuleAmount] = useState("");
    const [ruleTitle, setRuleTitle] = useState("");
    const [ruleCategory, setRuleCategory] = useState<string>("Need");
    const [isSavingRule, setIsSavingRule] = useState(false);

    const ruleFormRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleEditRule = (rule: MerchantMapping) => {
        setEditingRule(rule);
        setRuleMerchant(rule.merchantName);
        setRuleType(rule.type);
        setRuleAmount(rule.amount > 0 ? String(rule.amount) : "");
        setRuleTitle(rule.title);
        setRuleCategory(rule.category || "Need");
        ruleFormRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    };

    const handleCancelEdit = () => {
        setEditingRule(null);
        setRuleMerchant("");
        setRuleType("Debit");
        setRuleAmount("");
        setRuleTitle("");
        setRuleCategory("Need");
    };

    const handleSaveRule = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !ruleMerchant.trim() || !ruleTitle.trim()) return;

        setIsSavingRule(true);
        const parsedAmount = parseFloat(ruleAmount) || 0;
        const cleanAmount = Math.round(parsedAmount * 100) / 100;
        const newDocId = buildRuleDocId(ruleMerchant.trim(), ruleType, cleanAmount);

        try {
            const docRef = doc(firestoreDb, 'users', user.uid, 'merchant_mappings', newDocId);
            await setDoc(docRef, {
                merchantName: ruleMerchant.trim(),
                type: ruleType,
                amount: cleanAmount,
                title: ruleTitle.trim(),
                category: ruleCategory,
                updatedAt: Date.now()
            }, { merge: true });

            // If editing and key identity (doc ID) changed, delete old doc ID
            if (editingRule?.id && editingRule.id !== newDocId) {
                await deleteDoc(doc(firestoreDb, 'users', user.uid, 'merchant_mappings', editingRule.id));
            }

            handleCancelEdit();
        } catch (err: any) {
            console.error("Failed to save rule", err);
            alert(`Failed to save rule: ${err?.message || "Unknown error"}`);
        } finally {
            setIsSavingRule(false);
        }
    };

    const handleDeleteRule = async (rule: MerchantMapping) => {
        if (!user || !rule.id) return;
        const desc = `${rule.merchantName} (${rule.type}${rule.amount > 0 ? ` ₹${rule.amount}` : ""})`;
        if (!window.confirm(`Delete rule for "${desc}"?`)) return;

        try {
            await deleteDoc(doc(firestoreDb, 'users', user.uid, 'merchant_mappings', rule.id));
            if (editingRule?.id === rule.id) {
                handleCancelEdit();
            }
        } catch (err: any) {
            console.error("Failed to delete rule", err);
            alert("Failed to delete rule.");
        }
    };

    const handleExportCsv = () => {
        if (!mappings || mappings.length === 0) {
            alert("No rules found to export.");
            return;
        }

        let csv = "merchantName,type,amount,title,category\n";
        for (const m of mappings) {
            const amtStr = m.amount > 0 ? (m.amount % 1 === 0 ? m.amount.toString() : m.amount.toFixed(2)) : "";
            csv += `${escapeCsv(m.merchantName)},${escapeCsv(m.type)},${amtStr},${escapeCsv(m.title)},${escapeCsv(m.category)}\n`;
        }

        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", "pocket_ledger_rules.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleDownloadSampleCsv = () => {
        const sampleCsv =
`merchantName,type,amount,title,category
Netflix,Debit,649,Netflix Premium 4K,Want
Netflix,Debit,,Netflix Subscription,Want
Zomato,Debit,,Food Delivery,Want
Zomato,Credit,,Food Refund,Other
Amazon,Debit,,Online Shopping,Want
Salary,Credit,50000,Monthly Salary,Need
`;
        const blob = new Blob([sampleCsv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", "pocket_ledger_sample_rules.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleImportCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user) return;

        try {
            const text = await file.text();
            const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
            if (lines.length === 0) {
                alert("The selected CSV file is empty.");
                return;
            }

            let headerLine = lines[0];
            if (headerLine.charCodeAt(0) === 0xFEFF) {
                headerLine = headerLine.substring(1);
            }

            const headers = parseCsvLine(headerLine);
            let merchantIdx = -1, typeIdx = -1, amountIdx = -1, titleIdx = -1, categoryIdx = -1;

            headers.forEach((h, i) => {
                const clean = h.trim().toLowerCase();
                if (clean === "merchantname" || clean === "merchant" || clean === "merchant_name") merchantIdx = i;
                else if (clean === "type" || clean === "cashflow" || clean === "direction") typeIdx = i;
                else if (clean === "amount" || clean === "amt") amountIdx = i;
                else if (clean === "title" || clean === "description" || clean === "name") titleIdx = i;
                else if (clean === "category") categoryIdx = i;
            });

            if (headers.length >= 5) {
                if (merchantIdx === -1) merchantIdx = 0;
                if (typeIdx === -1) typeIdx = 1;
                if (amountIdx === -1) amountIdx = 2;
                if (titleIdx === -1) titleIdx = 3;
                if (categoryIdx === -1) categoryIdx = 4;
            } else {
                if (merchantIdx === -1) merchantIdx = 0;
                if (typeIdx === -1) typeIdx = 1;
                if (titleIdx === -1) titleIdx = 2;
                if (categoryIdx === -1) categoryIdx = 3;
            }

            const parsedMappings: MerchantMapping[] = [];
            for (let i = 1; i < lines.length; i++) {
                const tokens = parseCsvLine(lines[i]);
                if (tokens.length === 0) continue;

                const merchant = merchantIdx < tokens.length ? tokens[merchantIdx]?.trim() : "";
                if (!merchant) continue;

                let type: TransactionType = "Debit";
                if (typeIdx >= 0 && typeIdx < tokens.length) {
                    const t = tokens[typeIdx]?.trim().toLowerCase();
                    if (t === "credit") type = "Credit";
                    else if (t === "transfer") type = "Transfer";
                }

                let amount = 0;
                if (amountIdx >= 0 && amountIdx < tokens.length) {
                    const amtStr = tokens[amountIdx]?.trim().replace(/,/g, "");
                    if (amtStr) {
                        const parsed = parseFloat(amtStr);
                        if (!isNaN(parsed)) amount = Math.round(parsed * 100) / 100;
                    }
                }

                let title = titleIdx >= 0 && titleIdx < tokens.length ? tokens[titleIdx]?.trim() : "";
                if (!title) title = merchant;

                let category = categoryIdx >= 0 && categoryIdx < tokens.length ? tokens[categoryIdx]?.trim() : "";
                if (!category) category = "Uncategorized";

                parsedMappings.push({
                    merchantName: merchant,
                    type,
                    amount,
                    title,
                    category,
                    updatedAt: Date.now()
                });
            }

            if (parsedMappings.length === 0) {
                alert("No valid rule entries found in CSV.");
                return;
            }

            // Write in batches of 450 to stay under Firestore's 500-op limit
            const chunkSize = 450;
            for (let i = 0; i < parsedMappings.length; i += chunkSize) {
                const chunk = parsedMappings.slice(i, i + chunkSize);
                const batch = writeBatch(firestoreDb);
                for (const item of chunk) {
                    const docId = buildRuleDocId(item.merchantName, item.type, item.amount);
                    const docRef = doc(firestoreDb, 'users', user.uid, 'merchant_mappings', docId);
                    batch.set(docRef, {
                        merchantName: item.merchantName,
                        type: item.type,
                        amount: item.amount,
                        title: item.title,
                        category: item.category,
                        updatedAt: item.updatedAt
                    }, { merge: true });
                }
                await batch.commit();
            }

            alert(`Successfully imported ${parsedMappings.length} rules!`);
        } catch (err: any) {
            console.error("Failed to import CSV", err);
            alert(`Failed to import CSV: ${err?.message || "Unknown error"}`);
        } finally {
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const handleClearAllRules = async () => {
        if (!user || !collections) return;
        const count = mappings?.length || 0;
        if (count === 0) {
            alert("No rules to clear.");
            return;
        }

        const confirmed = window.confirm(
            `Are you sure you want to clear all ${count} merchant rules?\n\nThis will remove all auto-categorization mappings from Firestore, and your Android app will sync this change.\n\nYour transactions and accounts will NOT be touched.`
        );
        if (!confirmed) return;

        try {
            const querySnapshot = await getDocs(collections.merchantMappings);
            const docs = querySnapshot.docs;
            const chunkSize = 450;
            for (let i = 0; i < docs.length; i += chunkSize) {
                const chunk = docs.slice(i, i + chunkSize);
                const batch = writeBatch(firestoreDb);
                for (const d of chunk) {
                    batch.delete(d.ref);
                }
                await batch.commit();
            }
            alert("All merchant rules have been cleared.");
            if (editingRule) handleCancelEdit();
        } catch (err: any) {
            console.error("Failed to clear rules", err);
            alert(`Failed to clear rules: ${err?.message || "Unknown error"}`);
        }
    };

    // Filter rules
    const filteredRules = (mappings || []).filter(m => {
        if (!rulesSearch.trim()) return true;
        const q = rulesSearch.toLowerCase();
        return (
            m.merchantName?.toLowerCase().includes(q) ||
            m.title?.toLowerCase().includes(q) ||
            m.category?.toLowerCase().includes(q) ||
            m.type?.toLowerCase().includes(q) ||
            String(m.amount).includes(q)
        );
    });

    return (
        <div className="p-4 md:p-8 space-y-8 animate-in fade-in duration-500 max-w-5xl mx-auto">
            <div>
                <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">Settings</h2>
                <p className="text-muted-foreground text-sm md:text-lg">
                    Manage your custom accounts, balances, and AI merchant categorization rules.
                </p>
            </div>

            {/* ======================================================== */}
            {/* Card 1: Source Accounts */}
            {/* ======================================================== */}
            <Card className="bg-card border-border text-foreground shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-4">
                    <div>
                        <CardTitle className="flex items-center gap-2 text-xl">
                            <Wallet className="w-5 h-5 text-primary" />
                            Source Accounts
                        </CardTitle>
                        <CardDescription className="text-muted-foreground mt-1">
                            Create diverse account buckets (e.g. 'Cash', 'HDFC Bank', 'Amex'). The dashboard tracks these dynamically.
                        </CardDescription>
                    </div>
                    <Button variant="outline" className="border-destructive text-destructive hover:bg-destructive/10" onClick={signOut}>
                        Sign Out
                    </Button>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Add New Account Form */}
                    <form onSubmit={handleAddAccount} className="flex flex-col sm:flex-row gap-3 items-end bg-background p-4 rounded-lg border border-border">
                        <div className="flex-1 w-full space-y-1">
                            <label className="text-sm text-muted-foreground font-medium">Account Name</label>
                            <Input
                                placeholder="e.g. HDFC Salary"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                className="bg-background border-border focus-visible:ring-primary"
                                required
                            />
                        </div>
                        <div className="flex-1 w-full space-y-1">
                            <label className="text-sm text-muted-foreground font-medium">Initial Balance (₹)</label>
                            <Input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                value={newBalance}
                                onChange={(e) => setNewBalance(e.target.value)}
                                className="bg-background border-border focus-visible:ring-primary"
                            />
                        </div>
                        <Button type="submit" className="w-full sm:w-auto bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-black font-bold border-0">
                            <Plus className="w-4 h-4 mr-2" />
                            Add Account
                        </Button>
                    </form>

                    {/* Accounts Table */}
                    <div className="rounded-md border border-border overflow-hidden">
                        <Table>
                            <TableHeader className="bg-background">
                                <TableRow className="border-border hover:bg-transparent">
                                    <TableHead className="text-muted-foreground">Name</TableHead>
                                    <TableHead className="text-muted-foreground text-right">Starting Balance</TableHead>
                                    <TableHead className="w-[80px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {!accounts || accounts.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-center text-muted-foreground py-6">
                                            No accounts configured yet.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    accounts.map((acc) => (
                                        <TableRow key={acc.id} className="border-border hover:bg-muted/50">
                                            <TableCell className="font-medium text-foreground">
                                                {acc.name}
                                            </TableCell>
                                            <TableCell className="text-right text-primary font-semibold">
                                                {formatCurrency(acc.initialBalance)}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-8 w-8"
                                                    onClick={() => acc.id && handleDeleteAccount(acc.id, acc.name)}
                                                    title="Delete Account"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* ======================================================== */}
            {/* Card 2: Merchant Rules & Categorization Database */}
            {/* ======================================================== */}
            <Card className="bg-card border-border text-foreground shadow-sm">
                <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4">
                    <div>
                        <CardTitle className="flex items-center gap-2 text-xl">
                            <Sparkles className="w-5 h-5 text-amber-400" />
                            Merchant Rules (AI DB)
                        </CardTitle>
                        <CardDescription className="text-muted-foreground mt-1">
                            Edit auto-categorization rules utilized by the Android app's SMS-AI service. Changes sync to your mobile device automatically.
                        </CardDescription>
                    </div>

                    {/* Toolbar Actions */}
                    <div className="flex flex-wrap items-center gap-2">
                        <input
                            type="file"
                            ref={fileInputRef}
                            accept=".csv,text/csv"
                            className="hidden"
                            onChange={handleImportCsv}
                        />
                        <Button
                            variant="outline"
                            size="sm"
                            className="border-border hover:bg-muted text-foreground text-xs"
                            onClick={handleDownloadSampleCsv}
                            title="Download sample CSV template"
                        >
                            <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
                            Sample CSV
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="border-border hover:bg-muted text-foreground text-xs"
                            onClick={handleExportCsv}
                            title="Export all rules to CSV"
                        >
                            <Download className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
                            Export CSV
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="border-border hover:bg-muted text-foreground text-xs"
                            onClick={() => fileInputRef.current?.click()}
                            title="Import rules from CSV file"
                        >
                            <Upload className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
                            Import CSV
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="border-destructive/40 text-destructive hover:bg-destructive/10 text-xs"
                            onClick={handleClearAllRules}
                            title="Clear all rules from database"
                        >
                            <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                            Clear All
                        </Button>
                    </div>
                </CardHeader>

                <CardContent className="space-y-6">
                    {/* Add / Edit Rule Form */}
                    <div ref={ruleFormRef} className="bg-background p-4 rounded-lg border border-border space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold flex items-center gap-2 text-foreground">
                                {editingRule ? (
                                    <>
                                        <Pencil className="w-4 h-4 text-amber-400" />
                                        Editing Rule: <span className="text-amber-400">{editingRule.merchantName}</span>
                                    </>
                                ) : (
                                    <>
                                        <Plus className="w-4 h-4 text-primary" />
                                        Add New Rule
                                    </>
                                )}
                            </span>
                            {editingRule && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleCancelEdit}
                                    className="h-7 text-xs text-muted-foreground hover:text-foreground"
                                >
                                    <X className="w-3.5 h-3.5 mr-1" />
                                    Cancel
                                </Button>
                            )}
                        </div>

                        <form onSubmit={handleSaveRule} className="space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                                {/* Merchant Name */}
                                <div className="space-y-1">
                                    <label className="text-xs text-muted-foreground font-medium">
                                        Merchant Name <span className="text-destructive">*</span>
                                    </label>
                                    <Input
                                        placeholder="e.g. Netflix"
                                        value={ruleMerchant}
                                        onChange={(e) => setRuleMerchant(e.target.value)}
                                        className="h-9 bg-background border-border focus-visible:ring-primary text-sm"
                                        required
                                    />
                                </div>

                                {/* Type */}
                                <div className="space-y-1">
                                    <label className="text-xs text-muted-foreground font-medium">Type</label>
                                    <select
                                        value={ruleType}
                                        onChange={(e) => setRuleType(e.target.value as TransactionType)}
                                        className="flex h-9 w-full rounded-md border border-border bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary text-foreground"
                                    >
                                        <option value="Debit">Debit</option>
                                        <option value="Credit">Credit</option>
                                        <option value="Transfer">Transfer</option>
                                    </select>
                                </div>

                                {/* Amount */}
                                <div className="space-y-1">
                                    <label className="text-xs text-muted-foreground font-medium">
                                        Amount (₹) <span className="text-muted-foreground/60">(0 = Any)</span>
                                    </label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        placeholder="0.00"
                                        value={ruleAmount}
                                        onChange={(e) => setRuleAmount(e.target.value)}
                                        className="h-9 bg-background border-border focus-visible:ring-primary text-sm"
                                    />
                                </div>

                                {/* Title */}
                                <div className="space-y-1">
                                    <label className="text-xs text-muted-foreground font-medium">
                                        Preferred Title <span className="text-destructive">*</span>
                                    </label>
                                    <Input
                                        placeholder="e.g. Netflix 4K"
                                        value={ruleTitle}
                                        onChange={(e) => setRuleTitle(e.target.value)}
                                        className="h-9 bg-background border-border focus-visible:ring-primary text-sm"
                                        required
                                    />
                                </div>

                                {/* Category */}
                                <div className="space-y-1">
                                    <label className="text-xs text-muted-foreground font-medium">Category</label>
                                    <select
                                        value={ruleCategory}
                                        onChange={(e) => setRuleCategory(e.target.value)}
                                        className="flex h-9 w-full rounded-md border border-border bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary text-foreground"
                                    >
                                        <option value="Need">Need</option>
                                        <option value="Want">Want</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 pt-1">
                                {editingRule && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={handleCancelEdit}
                                        className="border-border text-foreground"
                                    >
                                        Cancel
                                    </Button>
                                )}
                                <Button
                                    type="submit"
                                    size="sm"
                                    disabled={isSavingRule}
                                    className="bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-black font-bold border-0"
                                >
                                    {isSavingRule ? (
                                        "Saving..."
                                    ) : editingRule ? (
                                        <>
                                            <Pencil className="w-3.5 h-3.5 mr-1.5" />
                                            Update Rule
                                        </>
                                    ) : (
                                        <>
                                            <Plus className="w-3.5 h-3.5 mr-1.5" />
                                            Add Rule
                                        </>
                                    )}
                                </Button>
                            </div>
                        </form>
                    </div>

                    {/* Search & Counter Bar */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search merchant, title, category..."
                                value={rulesSearch}
                                onChange={(e) => setRulesSearch(e.target.value)}
                                className="pl-9 h-9 bg-background border-border text-sm"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <Badge variant="outline" className="border-border text-muted-foreground text-xs py-1 px-2.5">
                                {filteredRules.length} {filteredRules.length === 1 ? "rule" : "rules"}
                                {rulesSearch && mappings && ` of ${mappings.length}`}
                            </Badge>
                        </div>
                    </div>

                    {/* Rules Table */}
                    <div className="rounded-md border border-border overflow-hidden">
                        <Table>
                            <TableHeader className="bg-background">
                                <TableRow className="border-border hover:bg-transparent">
                                    <TableHead className="text-muted-foreground font-semibold">Merchant</TableHead>
                                    <TableHead className="text-muted-foreground font-semibold">Type</TableHead>
                                    <TableHead className="text-muted-foreground font-semibold">Amount</TableHead>
                                    <TableHead className="text-muted-foreground font-semibold">Preferred Title</TableHead>
                                    <TableHead className="text-muted-foreground font-semibold">Category</TableHead>
                                    <TableHead className="w-[100px] text-right text-muted-foreground font-semibold">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loadingMappings ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                                            Loading rules database...
                                        </TableCell>
                                    </TableRow>
                                ) : filteredRules.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                                            {rulesSearch ? (
                                                <span>No rules match "{rulesSearch}".</span>
                                            ) : (
                                                <div className="space-y-2">
                                                    <p>No merchant rules found in database.</p>
                                                    <p className="text-xs text-muted-foreground/80">
                                                        Add rules above or import a CSV file to train the categorization engine.
                                                    </p>
                                                </div>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredRules.map((rule) => {
                                        const isBeingEdited = editingRule?.id === rule.id;
                                        return (
                                            <TableRow
                                                key={rule.id}
                                                className={`border-border hover:bg-muted/40 transition-colors ${
                                                    isBeingEdited ? "bg-amber-500/10 border-l-4 border-l-amber-400" : ""
                                                }`}
                                            >
                                                {/* Merchant Name */}
                                                <TableCell className="font-semibold text-foreground">
                                                    {rule.merchantName}
                                                </TableCell>

                                                {/* Type */}
                                                <TableCell>
                                                    <Badge
                                                        variant="outline"
                                                        className={
                                                            rule.type === "Debit"
                                                                ? "bg-red-500/10 text-red-400 border-red-500/30"
                                                                : rule.type === "Credit"
                                                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                                                : "bg-blue-500/10 text-blue-400 border-blue-500/30"
                                                        }
                                                    >
                                                        {rule.type}
                                                    </Badge>
                                                </TableCell>

                                                {/* Amount */}
                                                <TableCell className="font-mono text-sm">
                                                    {rule.amount > 0 ? (
                                                        <span className="text-foreground font-medium">
                                                            {formatCurrency(rule.amount)}
                                                        </span>
                                                    ) : (
                                                        <span className="text-muted-foreground italic text-xs">
                                                            Any amount
                                                        </span>
                                                    )}
                                                </TableCell>

                                                {/* Preferred Title */}
                                                <TableCell className="text-foreground">
                                                    {rule.title}
                                                </TableCell>

                                                {/* Category */}
                                                <TableCell>
                                                    <Badge
                                                        variant="outline"
                                                        className={
                                                            rule.category === "Need"
                                                                ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                                                                : rule.category === "Want"
                                                                ? "bg-purple-500/10 text-purple-400 border-purple-500/30"
                                                                : "bg-zinc-500/10 text-zinc-400 border-zinc-500/30"
                                                        }
                                                    >
                                                        {rule.category || "Uncategorized"}
                                                    </Badge>
                                                </TableCell>

                                                {/* Actions */}
                                                <TableCell className="text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="text-muted-foreground hover:text-amber-400 hover:bg-amber-400/10 h-8 w-8"
                                                            onClick={() => handleEditRule(rule)}
                                                            title="Edit Rule"
                                                        >
                                                            <Pencil className="w-3.5 h-3.5" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-8 w-8"
                                                            onClick={() => handleDeleteRule(rule)}
                                                            title="Delete Rule"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
